import { DurableObject } from "cloudflare:workers";
import { URL_ZIP_CONTRATANTE, URL_ZIP_PESQUISA } from "./fontes";
import { parseCsvTse } from "./csv";
import {
	geradoEmBrasiliaDoCsv,
	linhaPesquisaNoCorte,
	montarAplicar,
	registrosDoTse,
} from "./importar";
import { chaveConfere } from "./chave";
import { confirmarHtml, lerFonte } from "./ler-fonte";
import { montarPublico } from "./montar-publico";
import type {
	AuditoriaAgente,
	Changeset,
	Classificacao,
	ContagensImport,
	MetaImport,
	MotivoImport,
	OrigemZip,
	PayloadPesquisas,
	RegistroPesquisas,
	ResultadoGuardado,
	TotaisPublicos,
} from "./tipos";
import { validosCalculados } from "./validos";
import {
	lerEnvio,
	motivosDoRegistro,
	urlFonteValida,
	type EnvioResultado,
	type MotivoRecusa,
	type RegistroParaResultado,
} from "./validar-resultado";
import type { RejeicaoLinha } from "./importar";
import { extrairCsvBrasil } from "./zip-brasil";

const MOTIVOS: ReadonlySet<string> = new Set(["cron", "primeiro_acesso", "teste"]);

type LinhaRegistro = {
	registro: string;
	cnpj: string;
	instituto: string;
	contratantes_json: string;
	campo_inicio: string;
	campo_fim: string;
	liberacao: string;
	liberacao_efetiva: string;
	entrevistas: number;
	margem: number | null;
	confianca: number | null;
	classificacao: string;
	removido_do_tse: number;
};

type LinhaMeta = {
	gerado_em: string | null;
	etag_pesquisa: string | null;
	etag_contratante: string | null;
	last_modified_pesquisa: string | null;
	last_modified_contratante: string | null;
	ultimo_import_em: string | null;
	nacional: number;
	estadual: number;
	ambigua: number;
};

type CorpoZip = {
	kind: "corpo";
	bytes: Uint8Array;
	etag: string | null;
	lastModified: string | null;
};

type BuscaZip = { kind: "nao_modificado" } | CorpoZip;

type LoteImport = {
	/** Meta lida antes do fetch; se mudar no lock, o lote é descartado. */
	metaBase: MetaImport | null;
	lidos: RegistroPesquisas[];
	rejeicoes: RejeicaoLinha[];
	origem: OrigemZip;
};

/**
 * Singleton SQLite do registro de pesquisas.
 * O cron e o GET convergem no mesmo upsert: rodar de novo não duplica linha.
 */
export class Pesquisas extends DurableObject<Env> {
	async ping(): Promise<{ ok: true }> {
		return { ok: true };
	}

	async obterEstado(): Promise<{ pronto: true; registros: number }> {
		this.garantirEsquema();
		return { pronto: true, registros: this.contarRegistros() };
	}

	async importarDoTse(opts: { motivo: MotivoImport }): Promise<Changeset> {
		if (!MOTIVOS.has(opts.motivo)) throw new Error("motivo inválido");
		this.garantirEsquema();
		const metaBase = this.lerMeta();
		const lote = await this.prepararLote(metaBase);
		if (lote === null) {
			return this.ctx.blockConcurrencyWhile(async () => {
				const meta = this.lerMeta();
				if (!meta) throw new Error("304 sem import anterior");
				return { kind: "nao_modificado" as const, meta };
			});
		}
		return this.ctx.blockConcurrencyWhile(async () =>
			this.aplicarLote(opts.motivo, lote),
		);
	}

	async garantirImportInicial(): Promise<void> {
		this.garantirEsquema();
		if (this.contarRegistros() > 0 || this.lerMeta() !== null) return;
		const lote = await this.prepararLote(null);
		if (lote === null) throw new Error("304 sem import anterior");
		await this.ctx.blockConcurrencyWhile(async () => {
			if (this.contarRegistros() === 0 && this.lerMeta() === null) {
				this.aplicarLote("primeiro_acesso", lote);
			}
		});
	}

	/** Download + parse fora do lock. `null` = ambos 304. */
	private async prepararLote(meta: MetaImport | null): Promise<LoteImport | null> {
		const pesquisa = await buscarZip(
			URL_ZIP_PESQUISA,
			meta?.etagPesquisa ?? null,
			meta?.lastModifiedPesquisa ?? null,
		);
		const contratante = await buscarZip(
			URL_ZIP_CONTRATANTE,
			meta?.etagContratante ?? null,
			meta?.lastModifiedContratante ?? null,
		);
		if (pesquisa.kind === "nao_modificado" && contratante.kind === "nao_modificado") {
			return null;
		}
		const zipPesquisa = await corpoGarantido(URL_ZIP_PESQUISA, pesquisa);
		const zipContratante = await corpoGarantido(URL_ZIP_CONTRATANTE, contratante);
		const linhasPesquisa = parseCsvTse(await extrairCsvBrasil(zipPesquisa.bytes), {
			manter: linhaPesquisaNoCorte,
		});
		const protocolos = new Set(
			linhasPesquisa.map((linha) => linha.NR_PROTOCOLO_REGISTRO ?? ""),
		);
		const linhasContratante = parseCsvTse(
			await extrairCsvBrasil(zipContratante.bytes),
			{
				manter: (linha) =>
					protocolos.has(linha.NR_PROTOCOLO_REGISTRO ?? ""),
			},
		);
		const { lidos, rejeicoes } = registrosDoTse(linhasPesquisa, linhasContratante);
		return {
			metaBase: meta,
			lidos,
			rejeicoes,
			origem: {
				geradoEm: geradoEmBrasiliaDoCsv(linhasPesquisa),
				etagPesquisa: zipPesquisa.etag,
				etagContratante: zipContratante.etag,
				lastModifiedPesquisa: zipPesquisa.lastModified,
				lastModifiedContratante: zipContratante.lastModified,
			},
		};
	}

	private aplicarLote(motivo: MotivoImport, lote: LoteImport): Changeset {
		this.garantirEsquema();
		const metaAtual = this.lerMeta();
		if (!metaAindaEhBase(lote.metaBase, metaAtual)) {
			if (!metaAtual) throw new Error("meta sumiu durante o import");
			return { kind: "nao_modificado", meta: metaAtual };
		}
		const changeset = montarAplicar({
			anteriores: this.lerRegistros(),
			lidos: lote.lidos,
			rejeicoes: lote.rejeicoes,
			em: new Date().toISOString(),
			motivo,
			origem: lote.origem,
		});
		this.aplicar(changeset);
		return changeset;
	}

	async listarPublico(opts: { agora: Date }): Promise<PayloadPesquisas> {
		this.garantirEsquema();
		const agora = opts.agora instanceof Date ? opts.agora : new Date(opts.agora);
		if (Number.isNaN(agora.getTime())) throw new Error("agora inválido");
		return montarPublico(this.lerRegistros(), this.lerMeta(), agora, this.lerResultados());
	}

	async listarAuditoriaAgente(): Promise<AuditoriaAgente[]> {
		this.garantirEsquema();
		return this.lerAuditoriaAgente();
	}

	/**
	 * POST /api/agente/resultados.
	 * A taxa e a auditoria ficam no mesmo lock. A leitura da fonte fica fora.
	 */
	async receberResultado(input: {
		bearer: string | null;
		ip: string;
		corpo: string;
		agora: Date;
	}): Promise<RespostaResultado> {
		const agora = input.agora instanceof Date ? input.agora : new Date(input.agora);
		if (Number.isNaN(agora.getTime())) throw new Error("agora inválido");
		const segredo = this.env.CHAVE_AGENTE ?? "";
		const chaveValida =
			input.bearer != null && segredo.length > 0 && (await chaveConfere(input.bearer, segredo));
		const passagem = await this.ctx.blockConcurrencyWhile(async () => {
			this.garantirEsquema();
			const limite = chaveValida ? 30 : 5;
			const balde = chaveValida ? "chave" : `ip:${input.ip || "desconhecido"}`;
			if (!this.consumirTaxa(balde, limite, Date.now())) {
				this.gravarAuditoriaAgente({
					em: agora.toISOString(),
					ip: input.ip || "desconhecido",
					chaveValida,
					registro: registroDoCorpo(input.corpo),
					corpo: input.corpo,
					status: 429,
					motivos: [],
				});
				return { kind: "fim" as const, resposta: resposta429() };
			}
			if (!chaveValida) {
				this.gravarAuditoriaAgente({
					em: agora.toISOString(),
					ip: input.ip || "desconhecido",
					chaveValida: false,
					registro: registroDoCorpo(input.corpo),
					corpo: input.corpo,
					status: 401,
					motivos: ["nao_autorizado"],
				});
				return { kind: "fim" as const, resposta: resposta401() };
			}
			return { kind: "segue" as const };
		});
		if (passagem.kind === "fim") return passagem.resposta;

		let bruto: unknown;
		try {
			bruto = JSON.parse(input.corpo);
		} catch {
			bruto = null;
		}
		const lido = lerEnvio(bruto);
		const previa = this.ctx.blockConcurrencyWhile(async () => {
			this.garantirEsquema();
			return this.contextoRegistro(lido.registro);
		});
		const ctx = await previa;
		let htmlFonte: string | null = null;
		let falhaFonte: MotivoRecusa | null = null;
		if (lido.envio && ctx && urlFonteValida(lido.envio.fonte)) {
			const leitura = await lerFonte(lido.envio.fonte);
			if (!leitura.ok) {
				falhaFonte = { codigo: "fonte_inacessivel", detalhe: leitura.detalhe };
			} else {
				htmlFonte = leitura.html;
			}
		}
		return this.ctx.blockConcurrencyWhile(async () => {
			this.garantirEsquema();
			const deNovo = this.contextoRegistro(lido.registro);
			const finais = [...lido.motivos];
			if (lido.envio) finais.push(...motivosDoRegistro(lido.envio, deNovo, agora));
			else if (lido.registro && !deNovo) {
				finais.push({
					codigo: "registro_desconhecido",
					detalhe: "registro não está no último import",
				});
			}
			if (lido.envio && deNovo && urlFonteValida(lido.envio.fonte)) {
				if (falhaFonte) finais.push(falhaFonte);
				else if (
					htmlFonte != null &&
					!confirmarHtml(htmlFonte, deNovo.instituto, lido.envio.totais, lido.envio.validosPublicados)
				) {
					finais.push({
						codigo: "fonte_nao_confirma",
						detalhe: "a página não confirma o instituto e um par de números",
					});
				}
			}
			const unicos = dedupar(finais);
			if (!lido.envio || !deNovo || deNovo.removidoDoTse || deNovo.classificacao !== "nacional" || unicos.length > 0) {
				this.gravarAuditoriaAgente({
					em: agora.toISOString(),
					ip: input.ip || "desconhecido",
					chaveValida: true,
					registro: lido.registro,
					corpo: input.corpo,
					status: 422,
					motivos: unicos.map((m) => m.codigo),
				});
				return { status: 422 as const, corpo: { motivos: unicos } };
			}
			const calculados = validosCalculados(lido.envio.totais.flavio, lido.envio.totais.lula);
			if (!calculados) {
				const extra: MotivoRecusa = {
					codigo: "numeros_invalidos",
					detalhe: "não há votos válidos para calcular",
				};
				this.gravarAuditoriaAgente({
					em: agora.toISOString(),
					ip: input.ip || "desconhecido",
					chaveValida: true,
					registro: lido.registro,
					corpo: input.corpo,
					status: 422,
					motivos: ["numeros_invalidos"],
				});
				return { status: 422 as const, corpo: { motivos: [extra] } };
			}
			const substituido = deNovo.jaPublicado && lido.envio.substituir;
			this.gravarResultado(lido.envio, deNovo, calculados, agora.toISOString(), substituido);
			const status = substituido ? 200 : 201;
			this.gravarAuditoriaAgente({
				em: agora.toISOString(),
				ip: input.ip || "desconhecido",
				chaveValida: true,
				registro: lido.envio.registro,
				corpo: input.corpo,
				status,
				motivos: [],
			});
			return substituido
				? { status: 200 as const, corpo: { status: "substituido" as const } }
				: { status: 201 as const, corpo: { status: "publicado" as const } };
		});
	}

	async obterContagens(): Promise<ContagensImport> {
		this.garantirEsquema();
		return this.lerMeta()?.contagens ?? { nacional: 0, estadual: 0, ambigua: 0 };
	}

	async obterRegistro(registro: string): Promise<RegistroPesquisas | null> {
		this.garantirEsquema();
		return this.lerRegistros().find((item) => item.registro === registro) ?? null;
	}

	private garantirEsquema(): void {
		this.ctx.storage.sql.exec(`
			CREATE TABLE IF NOT EXISTS meta_import (
				id INTEGER PRIMARY KEY CHECK (id = 1),
				gerado_em TEXT,
				etag_pesquisa TEXT,
				etag_contratante TEXT,
				last_modified_pesquisa TEXT,
				last_modified_contratante TEXT,
				ultimo_import_em TEXT,
				nacional INTEGER NOT NULL,
				estadual INTEGER NOT NULL,
				ambigua INTEGER NOT NULL
			)
		`);
		this.ctx.storage.sql.exec(`
			CREATE TABLE IF NOT EXISTS registros (
				registro TEXT PRIMARY KEY,
				cnpj TEXT NOT NULL,
				instituto TEXT NOT NULL,
				contratantes_json TEXT NOT NULL,
				campo_inicio TEXT NOT NULL,
				campo_fim TEXT NOT NULL,
				liberacao TEXT NOT NULL,
				liberacao_efetiva TEXT NOT NULL,
				entrevistas INTEGER NOT NULL,
				margem REAL,
				confianca REAL,
				classificacao TEXT NOT NULL,
				removido_do_tse INTEGER NOT NULL
			)
		`);
		this.ctx.storage.sql.exec(`
			CREATE TABLE IF NOT EXISTS auditoria (
				id INTEGER PRIMARY KEY AUTOINCREMENT,
				em TEXT NOT NULL,
				tipo TEXT NOT NULL,
				registro TEXT,
				detalhe TEXT NOT NULL
			)
		`);
		this.ctx.storage.sql.exec(`
			CREATE TABLE IF NOT EXISTS resultados (
				registro TEXT PRIMARY KEY,
				totais_json TEXT NOT NULL,
				validos_publicados_json TEXT,
				vf REAL NOT NULL,
				vl REAL NOT NULL,
				v REAL NOT NULL,
				fonte TEXT NOT NULL,
				margem REAL NOT NULL,
				confianca REAL NOT NULL,
				cadastrado_em TEXT NOT NULL,
				substituido_em TEXT
			)
		`);
		this.ctx.storage.sql.exec(`
			CREATE TABLE IF NOT EXISTS resultados_historico (
				id INTEGER PRIMARY KEY AUTOINCREMENT,
				registro TEXT NOT NULL,
				corpo_json TEXT NOT NULL,
				em TEXT NOT NULL
			)
		`);
		this.ctx.storage.sql.exec(`
			CREATE TABLE IF NOT EXISTS suspensoes (
				registro TEXT PRIMARY KEY,
				desde TEXT NOT NULL,
				motivo TEXT NOT NULL
			)
		`);
		this.ctx.storage.sql.exec(`
			CREATE TABLE IF NOT EXISTS auditoria_agente (
				id INTEGER PRIMARY KEY AUTOINCREMENT,
				em TEXT NOT NULL,
				rota TEXT NOT NULL,
				metodo TEXT NOT NULL,
				ip TEXT NOT NULL,
				chave_valida INTEGER NOT NULL,
				registro TEXT,
				corpo TEXT NOT NULL,
				status INTEGER NOT NULL,
				motivos TEXT NOT NULL
			)
		`);
		this.ctx.storage.sql.exec(`
			CREATE TABLE IF NOT EXISTS taxa_agente (
				id TEXT PRIMARY KEY,
				inicio INTEGER NOT NULL,
				n INTEGER NOT NULL
			)
		`);
	}

	private consumirTaxa(id: string, limite: number, agoraMs: number): boolean {
		const rows = this.ctx.storage.sql
			.exec<{ inicio: number; n: number }>(
				"SELECT inicio, n FROM taxa_agente WHERE id = ?",
				id,
			)
			.toArray();
		const row = rows[0];
		if (!row || agoraMs - Number(row.inicio) >= 60_000) {
			this.ctx.storage.sql.exec(
				`INSERT INTO taxa_agente (id, inicio, n) VALUES (?, ?, 1)
				ON CONFLICT(id) DO UPDATE SET inicio = excluded.inicio, n = 1`,
				id,
				agoraMs,
			);
			return true;
		}
		const n = Number(row.n) + 1;
		this.ctx.storage.sql.exec("UPDATE taxa_agente SET n = ? WHERE id = ?", n, id);
		return n <= limite;
	}

	private contextoRegistro(registro: string | null): RegistroParaResultado | null {
		if (!registro) return null;
		const achado = this.lerRegistros().find((item) => item.registro === registro);
		if (!achado) return null;
		const suspensa = this.ctx.storage.sql
			.exec<{ n: number }>("SELECT COUNT(*) AS n FROM suspensoes WHERE registro = ?", registro)
			.one();
		const publicado = this.ctx.storage.sql
			.exec<{ n: number }>("SELECT COUNT(*) AS n FROM resultados WHERE registro = ?", registro)
			.one();
		return {
			classificacao: achado.classificacao,
			removidoDoTse: achado.removidoDoTse,
			liberacaoEfetiva: achado.liberacaoEfetiva,
			campoFim: achado.campoFim,
			margem: achado.margem,
			confianca: achado.confianca,
			instituto: achado.instituto,
			suspensa: Number(suspensa.n) > 0,
			jaPublicado: Number(publicado.n) > 0,
		};
	}

	private gravarResultado(
		envio: EnvioResultado,
		registro: RegistroParaResultado,
		calculados: { vf: number; vl: number; v: number },
		em: string,
		substituir: boolean,
	): void {
		const margem = registro.margem ?? envio.margem;
		const confianca = registro.confianca ?? envio.confianca;
		if (margem == null || confianca == null) throw new Error("margem efetiva ausente");
		const anterior = substituir ? this.lerResultados().find((r) => r.registro === envio.registro) : undefined;
		this.ctx.storage.transactionSync(() => {
			if (anterior) {
				this.ctx.storage.sql.exec(
					"INSERT INTO resultados_historico (registro, corpo_json, em) VALUES (?, ?, ?)",
					envio.registro,
					JSON.stringify(anterior),
					em,
				);
			}
			this.ctx.storage.sql.exec(
				`INSERT INTO resultados (
					registro, totais_json, validos_publicados_json, vf, vl, v,
					fonte, margem, confianca, cadastrado_em, substituido_em
				) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
				ON CONFLICT(registro) DO UPDATE SET
					totais_json = excluded.totais_json,
					validos_publicados_json = excluded.validos_publicados_json,
					vf = excluded.vf,
					vl = excluded.vl,
					v = excluded.v,
					fonte = excluded.fonte,
					margem = excluded.margem,
					confianca = excluded.confianca,
					cadastrado_em = resultados.cadastrado_em,
					substituido_em = excluded.substituido_em`,
				envio.registro,
				JSON.stringify(envio.totais),
				envio.validosPublicados ? JSON.stringify(envio.validosPublicados) : null,
				calculados.vf,
				calculados.vl,
				calculados.v,
				envio.fonte,
				margem,
				confianca,
				anterior?.cadastradoEm ?? em,
				substituir ? em : null,
			);
		});
	}

	private gravarAuditoriaAgente(entrada: {
		em: string;
		ip: string;
		chaveValida: boolean;
		registro: string | null;
		corpo: string;
		status: number;
		motivos: string[];
	}): void {
		this.ctx.storage.sql.exec(
			`INSERT INTO auditoria_agente (
				em, rota, metodo, ip, chave_valida, registro, corpo, status, motivos
			) VALUES (?, '/api/agente/resultados', 'POST', ?, ?, ?, ?, ?, ?)`,
			entrada.em,
			entrada.ip,
			entrada.chaveValida ? 1 : 0,
			entrada.registro?.slice(0, 120) ?? null,
			entrada.corpo.slice(0, 8000),
			entrada.status,
			JSON.stringify(entrada.motivos),
		);
	}

	private lerAuditoriaAgente(): AuditoriaAgente[] {
		const rows = this.ctx.storage.sql
			.exec<{
				id: number;
				em: string;
				rota: string;
				metodo: string;
				ip: string;
				chave_valida: number;
				registro: string | null;
				corpo: string;
				status: number;
				motivos: string;
			}>(
				`SELECT id, em, rota, metodo, ip, chave_valida, registro, corpo, status, motivos
				FROM auditoria_agente ORDER BY id`,
			)
			.toArray();
		return rows.map((row) => ({
			id: Number(row.id),
			em: row.em,
			rota: row.rota,
			metodo: row.metodo,
			ip: row.ip,
			chaveValida: Number(row.chave_valida) === 1,
			registro: row.registro,
			corpo: row.corpo,
			status: Number(row.status),
			motivos: JSON.parse(row.motivos) as string[],
		}));
	}

	private lerResultados(): ResultadoGuardado[] {
		const rows = this.ctx.storage.sql
			.exec<{
				registro: string;
				totais_json: string;
				validos_publicados_json: string | null;
				vf: number;
				vl: number;
				v: number;
				fonte: string;
				margem: number;
				confianca: number;
				cadastrado_em: string;
				substituido_em: string | null;
			}>(
				`SELECT registro, totais_json, validos_publicados_json, vf, vl, v,
					fonte, margem, confianca, cadastrado_em, substituido_em
				FROM resultados`,
			)
			.toArray();
		return rows.map((row) => ({
			registro: row.registro,
			totais: JSON.parse(row.totais_json) as TotaisPublicos,
			validosPublicados: row.validos_publicados_json
				? (JSON.parse(row.validos_publicados_json) as { flavio: number; lula: number })
				: null,
			vf: Number(row.vf),
			vl: Number(row.vl),
			v: Number(row.v),
			fonte: row.fonte,
			margem: Number(row.margem),
			confianca: Number(row.confianca),
			cadastradoEm: row.cadastrado_em,
			substituidoEm: row.substituido_em,
		}));
	}

	private aplicar(changeset: Extract<Changeset, { kind: "aplicar" }>): void {
		const meta = changeset.meta;
		this.ctx.storage.transactionSync(() => {
			for (const registro of changeset.upserts) {
				this.ctx.storage.sql.exec(
					`INSERT INTO registros (
						registro, cnpj, instituto, contratantes_json,
						campo_inicio, campo_fim, liberacao, liberacao_efetiva,
						entrevistas, margem, confianca, classificacao, removido_do_tse
					) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0)
					ON CONFLICT(registro) DO UPDATE SET
						cnpj = excluded.cnpj,
						instituto = excluded.instituto,
						contratantes_json = excluded.contratantes_json,
						campo_inicio = excluded.campo_inicio,
						campo_fim = excluded.campo_fim,
						liberacao = excluded.liberacao,
						liberacao_efetiva = excluded.liberacao_efetiva,
						entrevistas = excluded.entrevistas,
						margem = excluded.margem,
						confianca = excluded.confianca,
						classificacao = excluded.classificacao,
						removido_do_tse = 0`,
					registro.registro,
					registro.cnpj,
					registro.instituto,
					JSON.stringify(registro.contratantes),
					registro.campoInicio,
					registro.campoFim,
					registro.liberacao,
					registro.liberacaoEfetiva,
					registro.entrevistas,
					registro.margem,
					registro.confianca,
					registro.classificacao,
				);
			}
			for (const registro of changeset.remover) {
				this.ctx.storage.sql.exec(
					"UPDATE registros SET removido_do_tse = 1 WHERE registro = ?",
					registro,
				);
			}
			for (const entrada of changeset.auditoria) {
				this.ctx.storage.sql.exec(
					"INSERT INTO auditoria (em, tipo, registro, detalhe) VALUES (?, ?, ?, ?)",
					entrada.em,
					entrada.tipo,
					entrada.registro,
					entrada.detalhe,
				);
			}
			this.ctx.storage.sql.exec(
				`INSERT INTO meta_import (
					id, gerado_em, etag_pesquisa, etag_contratante,
					last_modified_pesquisa, last_modified_contratante,
					ultimo_import_em, nacional, estadual, ambigua
				) VALUES (1, ?, ?, ?, ?, ?, ?, ?, ?, ?)
				ON CONFLICT(id) DO UPDATE SET
					gerado_em = excluded.gerado_em,
					etag_pesquisa = excluded.etag_pesquisa,
					etag_contratante = excluded.etag_contratante,
					last_modified_pesquisa = excluded.last_modified_pesquisa,
					last_modified_contratante = excluded.last_modified_contratante,
					ultimo_import_em = excluded.ultimo_import_em,
					nacional = excluded.nacional,
					estadual = excluded.estadual,
					ambigua = excluded.ambigua`,
				meta.geradoEm,
				meta.etagPesquisa,
				meta.etagContratante,
				meta.lastModifiedPesquisa,
				meta.lastModifiedContratante,
				meta.ultimoImportEm,
				meta.contagens.nacional,
				meta.contagens.estadual,
				meta.contagens.ambigua,
			);
		});
	}

	private contarRegistros(): number {
		const row = this.ctx.storage.sql
			.exec<{ n: number }>("SELECT COUNT(*) AS n FROM registros")
			.one();
		return Number(row.n);
	}

	private lerMeta(): MetaImport | null {
		const rows = this.ctx.storage.sql
			.exec<LinhaMeta>(
				`SELECT gerado_em, etag_pesquisa, etag_contratante,
					last_modified_pesquisa, last_modified_contratante,
					ultimo_import_em, nacional, estadual, ambigua
				FROM meta_import WHERE id = 1`,
			)
			.toArray();
		const row = rows[0];
		if (!row) return null;
		return {
			geradoEm: row.gerado_em,
			etagPesquisa: row.etag_pesquisa,
			etagContratante: row.etag_contratante,
			lastModifiedPesquisa: row.last_modified_pesquisa,
			lastModifiedContratante: row.last_modified_contratante,
			ultimoImportEm: row.ultimo_import_em,
			contagens: {
				nacional: Number(row.nacional),
				estadual: Number(row.estadual),
				ambigua: Number(row.ambigua),
			},
		};
	}

	private lerRegistros(): RegistroPesquisas[] {
		const rows = this.ctx.storage.sql
			.exec<LinhaRegistro>(
				`SELECT registro, cnpj, instituto, contratantes_json,
					campo_inicio, campo_fim, liberacao, liberacao_efetiva,
					entrevistas, margem, confianca, classificacao, removido_do_tse
				FROM registros`,
			)
			.toArray();
		return rows.map((row) => ({
			registro: row.registro,
			cnpj: row.cnpj,
			instituto: row.instituto,
			contratantes: lerContratantes(row.contratantes_json),
			campoInicio: row.campo_inicio,
			campoFim: row.campo_fim,
			liberacao: row.liberacao,
			liberacaoEfetiva: row.liberacao_efetiva,
			entrevistas: Number(row.entrevistas),
			margem: numeroOuNulo(row.margem),
			confianca: numeroOuNulo(row.confianca),
			classificacao: lerClassificacao(row.classificacao),
			removidoDoTse: Number(row.removido_do_tse) === 1,
		}));
	}
}

async function buscarZip(
	url: string,
	etag: string | null,
	lastModified: string | null,
): Promise<BuscaZip> {
	const condicional = await fetchZipOnce(url, etag, lastModified);
	if (condicional.kind !== "talvez_stale") return condicional;
	// CDN: IMS igual → 304 com ETag corrente ≠ enviado. Um GET sem validators.
	const incondicional = await fetchZipOnce(url, null, null);
	if (incondicional.kind === "talvez_stale") {
		throw new Error(`TSE devolveu 304 sem validators em ${url}`);
	}
	return incondicional;
}

type BuscaZipBruta = BuscaZip | { kind: "talvez_stale" };

async function fetchZipOnce(
	url: string,
	etag: string | null,
	lastModified: string | null,
): Promise<BuscaZipBruta> {
	const headers: Record<string, string> = {};
	if (etag) headers["if-none-match"] = etag;
	if (lastModified) headers["if-modified-since"] = lastModified;
	const resposta = await fetch(url, { headers, cache: "no-store" });
	if (resposta.status === 304) {
		const etagResposta = resposta.headers.get("etag");
		if (etag && etagResposta && etagResposta === etag) {
			return { kind: "nao_modificado" };
		}
		return { kind: "talvez_stale" };
	}
	if (!resposta.ok) throw new Error(`TSE respondeu ${resposta.status} para ${url}`);
	return {
		kind: "corpo",
		bytes: new Uint8Array(await resposta.arrayBuffer()),
		etag: resposta.headers.get("etag"),
		lastModified: resposta.headers.get("last-modified"),
	};
}

function metaAindaEhBase(
	base: MetaImport | null,
	atual: MetaImport | null,
): boolean {
	if (base === null) return atual === null;
	if (atual === null) return false;
	return (
		base.etagPesquisa === atual.etagPesquisa &&
		base.etagContratante === atual.etagContratante &&
		base.lastModifiedPesquisa === atual.lastModifiedPesquisa &&
		base.lastModifiedContratante === atual.lastModifiedContratante
	);
}

/** Se só um dos ZIPs mudou, o outro 304 não traz bytes. Busca esse de novo. */
async function corpoGarantido(url: string, busca: BuscaZip): Promise<CorpoZip> {
	if (busca.kind === "corpo") return busca;
	const deNovo = await buscarZip(url, null, null);
	if (deNovo.kind === "nao_modificado") {
		throw new Error(`TSE não devolveu o ZIP ${url}`);
	}
	return deNovo;
}

function lerContratantes(json: string): string[] {
	const valor = JSON.parse(json) as unknown;
	if (!Array.isArray(valor) || valor.some((item) => typeof item !== "string")) {
		throw new Error("contratantes inválidos");
	}
	return valor;
}

function lerClassificacao(valor: string): Classificacao {
	if (valor === "nacional" || valor === "estadual" || valor === "ambigua") return valor;
	throw new Error(`classificação inválida: ${valor}`);
}

function numeroOuNulo(valor: number | null): number | null {
	if (valor == null) return null;
	return Number(valor);
}

export type RespostaResultado =
	| { status: 201; corpo: { status: "publicado" } }
	| { status: 200; corpo: { status: "substituido" } }
	| { status: 401; corpo: { erro: "nao_autorizado" } }
	| { status: 429; corpo: { erro: "limite" } }
	| { status: 422; corpo: { motivos: MotivoRecusa[] } };

function resposta401(): RespostaResultado {
	return { status: 401, corpo: { erro: "nao_autorizado" } };
}

function resposta429(): RespostaResultado {
	return { status: 429, corpo: { erro: "limite" } };
}

function registroDoCorpo(corpo: string): string | null {
	try {
		const bruto = JSON.parse(corpo) as unknown;
		if (typeof bruto === "object" && bruto !== null && "registro" in bruto) {
			const registro = (bruto as { registro?: unknown }).registro;
			return typeof registro === "string" ? registro : null;
		}
	} catch {
		return null;
	}
	return null;
}

function dedupar(motivos: MotivoRecusa[]): MotivoRecusa[] {
	const vistos = new Set<string>();
	const saida: MotivoRecusa[] = [];
	for (const motivo of motivos) {
		if (vistos.has(motivo.codigo)) continue;
		vistos.add(motivo.codigo);
		saida.push(motivo);
	}
	return saida;
}
