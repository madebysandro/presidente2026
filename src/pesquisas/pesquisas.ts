import { DurableObject } from "cloudflare:workers";
import { env } from "void/env";
import { withRuntimeEnv } from "void/_env";
import { nomePoller } from "../config/poller-nome";
import { urlsRegistroTse } from "./fontes";
import { parseCsvTse } from "./csv";
import {
	geradoEmBrasiliaDoCsv,
	linhaPesquisaNoCorte,
	montarAplicar,
	registrosDoTse,
} from "./importar";
import { registrar } from "../log";
import { chaveConfere } from "./chave";
import { lerRecorte } from "./plano-b";
import { eventoImport } from "./log-import";
import { bindingDeixaPassar } from "./limite-plataforma";
import { confirmarHtml, lerFonte } from "./ler-fonte";
import { montarPublico } from "./montar-publico";
import { selecionarPendentes, type PendenteAgente } from "./pendentes";
import {
	lerCorpoSuspensao,
	lerMotivoReativacao,
	type RecusaSuspensao,
} from "./suspensao";
import type {
	AuditoriaAgente,
	Changeset,
	Classificacao,
	ContagensImport,
	ImportCongelado,
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
	motivoDaFonte,
	motivosDoRegistro,
	urlFonteValida,
	type EnvioResultado,
	type MotivoRecusa,
	type RegistroParaResultado,
} from "./validar-resultado";
import type { RejeicaoLinha } from "./importar";
import { extrairCsvBrasil } from "./zip-brasil";
import { IDADE_AUDITORIA_AGENTE_MS, TETO_LINHAS_AUDITORIA_AGENTE } from "./retencao";

const LIMITE_POR_CHAVE = 30;
const LIMITE_POR_IP = 5;

const MOTIVOS: ReadonlySet<string> = new Set(["cron", "primeiro_acesso", "teste", "plano_b"]);

const CONGELADO: ImportCongelado = { kind: "congelado" };
const CHAVE_ENCERRADA = "apuracao_encerrada";

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
 * Import estático de propósito: o Vite só empacota `void/env` quando vê o
 * specifier literal. Um `import()` com string em variável sobrevive cru no
 * chunk e o workerd tenta `assets/void/env` (500 em /api/agente, #50/#51).
 * O DO nativo não herda o escopo de env do request, então o binding entra
 * via `withRuntimeEnv`.
 */
function segredoAgente(bindings: Env): string {
	return withRuntimeEnv(bindings, () => {
		const valor = env.CHAVE_AGENTE;
		return typeof valor === "string" ? valor : "";
	});
}

function segredoImport(bindings: Env): string {
	return withRuntimeEnv(bindings, () => {
		const valor = env.CHAVE_IMPORT;
		return typeof valor === "string" ? valor : "";
	});
}

/**
 * Singleton SQLite do registro de pesquisas.
 * O cron e o GET convergem no mesmo upsert: rodar de novo não duplica linha.
 */
export class Pesquisas extends DurableObject<Env> {
	async ping(): Promise<{ ok: true }> {
		return { ok: true };
	}

	/** Aviso do poller (#86). Só abre → encerra; o ack sai depois da escrita, então ack = trava durável. */
	async congelar(): Promise<{ congelada: true }> {
		this.travar("aviso");
		return { congelada: true };
	}

	async alarm(): Promise<void> {
		await this.ctx.blockConcurrencyWhile(async () => {
			this.garantirEsquema();
			const agora = Date.now();
			this.podarAuditoriaAgente(agora);
			await this.programarAlarmeAuditoria(agora);
		});
	}

	async obterEstado(): Promise<{ pronto: true; registros: number }> {
		this.garantirEsquema();
		return { pronto: true, registros: this.contarRegistros() };
	}

	async importarDoTse(opts: { motivo: MotivoImport }): Promise<Changeset | ImportCongelado> {
		if (!MOTIVOS.has(opts.motivo)) throw new Error("motivo inválido");
		return medirImport(opts.motivo, async () => {
			if (await this.encerradaReconciliando()) return CONGELADO;
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
		});
	}

	/**
	 * Plano B: o JSON já veio classificado. Não baixa o ZIP.
	 * A chave do agente não passa; a chave de import não serve nas rotas do agente.
	 */
	async receberPlanoB(input: {
		bearer: string | null;
		corpo: string;
		ip: string;
		agora: Date;
	}): Promise<
		| { status: 200; corpo: { status: "aplicado"; upserts: number; removidos: number } }
		| { status: 401; corpo: { erro: "nao_autorizado" } }
		| { status: 429; corpo: { erro: "limite" } }
		| { status: 422; corpo: { erro: "recorte_invalido" } }
		| RespostaEncerrada
	> {
		const autorizado = await this.importAutorizado(input.bearer);
		const ip = input.ip.trim() || "desconhecido";
		const agora = input.agora instanceof Date ? input.agora : new Date(input.agora);
		const em = agora.toISOString();
		const portao = await this.ctx.blockConcurrencyWhile(() =>
			this.aplicarPortao({
				chaveValida: false,
				ip,
				em,
				rota: "/api/import",
				metodo: "POST",
				exigeChave: !autorizado,
			}),
		);
		if (portao !== "segue") return portao;
		const lido = lerRecorte(input.corpo);
		if ("erro" in lido) return { status: 422, corpo: { erro: "recorte_invalido" } };
		await this.encerradaReconciliando();
		const changeset = await medirImport("plano_b", async () => {
			this.garantirEsquema();
			return this.ctx.blockConcurrencyWhile(async () => {
				if (this.encerrada()) return CONGELADO;
				const aplicar = montarAplicar({
					anteriores: this.lerRegistros(),
					lidos: lido.registros,
					em: agora.toISOString(),
					motivo: "plano_b",
					origem: {
						geradoEm: lido.geradoEm,
						etagPesquisa: null,
						etagContratante: null,
						lastModifiedPesquisa: null,
						lastModifiedContratante: null,
					},
					escopo: "nacional",
				});
				this.aplicar(aplicar);
				return aplicar;
			});
		});
		if (changeset.kind === "congelado") return respostaEncerrada();
		if (changeset.kind !== "aplicar") throw new Error("plano B não devolve 304");
		return {
			status: 200,
			corpo: {
				status: "aplicado",
				upserts: changeset.upserts.length,
				removidos: changeset.remover.length,
			},
		};
	}

	async garantirImportInicial(): Promise<void> {
		this.garantirEsquema();
		if (this.contarRegistros() > 0 || this.lerMeta() !== null) return;
		// Já congelado: cada página vazia logaria `congelado` de novo.
		if (this.encerrada()) return;
		await medirImport("primeiro_acesso", async () => {
			if (await this.encerradaReconciliando()) return CONGELADO;
			const lote = await this.prepararLote(null);
			if (lote === null) throw new Error("304 sem import anterior");
			return this.ctx.blockConcurrencyWhile(async () => {
				if (this.contarRegistros() === 0 && this.lerMeta() === null) {
					return this.aplicarLote("primeiro_acesso", lote);
				}
				const meta = this.lerMeta();
				return meta ? { kind: "nao_modificado" as const, meta } : null;
			});
		});
	}

	/** Download + parse fora do lock. `null` = ambos 304. */
	private async prepararLote(meta: MetaImport | null): Promise<LoteImport | null> {
		const urls = urlsRegistroTse(this.env);
		const pesquisa = await buscarZip(
			urls.pesquisa,
			meta?.etagPesquisa ?? null,
			meta?.lastModifiedPesquisa ?? null,
		);
		const contratante = await buscarZip(
			urls.contratante,
			meta?.etagContratante ?? null,
			meta?.lastModifiedContratante ?? null,
		);
		if (pesquisa.kind === "nao_modificado" && contratante.kind === "nao_modificado") {
			return null;
		}
		const zipPesquisa = await corpoGarantido(urls.pesquisa, pesquisa);
		const zipContratante = await corpoGarantido(urls.contratante, contratante);
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

	/** Chame dentro do lock. O poller pode ter encerrado durante o download. */
	private aplicarLote(motivo: MotivoImport, lote: LoteImport): Changeset | ImportCongelado {
		if (this.encerrada()) return CONGELADO;
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

	async listarPublico(opts: { agora: Date; encerrada?: boolean }): Promise<PayloadPesquisas> {
		this.garantirEsquema();
		const agora = opts.agora instanceof Date ? opts.agora : new Date(opts.agora);
		if (Number.isNaN(agora.getTime())) throw new Error("agora inválido");
		const suspensos = this.lerSuspensos();
		const visiveis = this.lerRegistros().filter((registro) => !suspensos.has(registro.registro));
		return montarPublico(
			visiveis,
			this.lerMeta(),
			agora,
			this.lerResultados(),
			opts.encerrada === true,
		);
	}

	async listarAuditoriaAgente(): Promise<AuditoriaAgente[]> {
		this.garantirEsquema();
		return this.lerAuditoriaAgente();
	}

	/** GET /api/agente — sem chave; a taxa de quem não autentica é por IP. */
	async abrirInstrucoes(input: PedidoAgente): Promise<{ status: 200 } | RespostaNegacao> {
		const agora = relogioDe(input.agora);
		const chaveValida = await this.chaveConfereBearer(input.bearer);
		return this.ctx.blockConcurrencyWhile(async () => {
			const portao = await this.aplicarPortao({
				chaveValida,
				ip: input.ip,
				em: agora.toISOString(),
				rota: "/api/agente",
				metodo: "GET",
				exigeChave: false,
			});
			if (portao !== "segue") return portao;
			await this.gravarAuditoriaAgente({
				em: agora.toISOString(),
				ip: input.ip || "desconhecido",
				chaveValida,
				registro: null,
				corpo: "",
				status: 200,
				motivos: [],
				rota: "/api/agente",
				metodo: "GET",
			});
			return { status: 200 as const };
		});
	}

	/** GET /api/agente/pendentes */
	async listarPendentes(
		input: PedidoAgente,
	): Promise<{ status: 200; corpo: { pendentes: PendenteAgente[] } } | RespostaNegacao> {
		const agora = relogioDe(input.agora);
		const chaveValida = await this.chaveConfereBearer(input.bearer);
		return this.ctx.blockConcurrencyWhile(async () => {
			const portao = await this.aplicarPortao({
				chaveValida,
				ip: input.ip,
				em: agora.toISOString(),
				rota: "/api/agente/pendentes",
				metodo: "GET",
				exigeChave: true,
			});
			if (portao !== "segue") return portao;
			const pendentes = selecionarPendentes(
				this.lerRegistros(),
				this.lerResultados(),
				this.lerSuspensos(),
				agora,
			);
			await this.gravarAuditoriaAgente({
				em: agora.toISOString(),
				ip: input.ip || "desconhecido",
				chaveValida: true,
				registro: null,
				corpo: "",
				status: 200,
				motivos: [],
				rota: "/api/agente/pendentes",
				metodo: "GET",
			});
			return { status: 200 as const, corpo: { pendentes } };
		});
	}

	/** POST /api/agente/suspensoes */
	async suspender(input: PedidoAgente & { corpo: string }): Promise<RespostaSuspensao> {
		const agora = relogioDe(input.agora);
		const chaveValida = await this.chaveConfereBearer(input.bearer);
		return this.ctx.blockConcurrencyWhile(async () => {
			const portao = await this.aplicarPortaoEscrita({
				chaveValida,
				ip: input.ip,
				em: agora.toISOString(),
				rota: "/api/agente/suspensoes",
				metodo: "POST",
				registro: registroDoCorpo(input.corpo),
				corpo: input.corpo,
			});
			if (portao !== "segue") return portao;
			const lido = lerJson(input.corpo);
			const corpo = lerCorpoSuspensao(lido);
			if ("motivos" in corpo) {
				return await this.recusarSuspensao(agora, input.ip, registroDoCorpo(input.corpo), input.corpo, "POST", corpo.motivos);
			}
			const registro = this.registroAtivo(corpo.ok.registro);
			if (!registro) {
				return await this.recusarSuspensao(agora, input.ip, corpo.ok.registro, input.corpo, "POST", [
					{ codigo: "registro_desconhecido", detalhe: "registro não está no último import" },
				]);
			}
			const ja = this.suspensaExiste(registro.registro);
			this.ctx.storage.sql.exec(
				`INSERT INTO suspensoes (registro, desde, motivo, decisao_url) VALUES (?, ?, ?, ?)
				ON CONFLICT(registro) DO UPDATE SET
					desde = excluded.desde,
					motivo = excluded.motivo,
					decisao_url = excluded.decisao_url`,
				registro.registro,
				agora.toISOString(),
				corpo.ok.motivo,
				corpo.ok.decisaoUrl,
			);
			const status = ja ? (200 as const) : (201 as const);
			await this.gravarAuditoriaAgente({
				em: agora.toISOString(),
				ip: input.ip || "desconhecido",
				chaveValida: true,
				registro: registro.registro,
				corpo: input.corpo,
				status,
				motivos: [],
				rota: "/api/agente/suspensoes",
				metodo: "POST",
			});
			return { status, corpo: { status: "suspensa" as const } };
		});
	}

	/** DELETE /api/agente/suspensoes/{registro} */
	async reativar(
		input: PedidoAgente & { corpo: string; registro: string | null },
	): Promise<RespostaReativacao> {
		const agora = relogioDe(input.agora);
		const chaveValida = await this.chaveConfereBearer(input.bearer);
		return this.ctx.blockConcurrencyWhile(async () => {
			const portao = await this.aplicarPortaoEscrita({
				chaveValida,
				ip: input.ip,
				em: agora.toISOString(),
				rota: "/api/agente/suspensoes",
				metodo: "DELETE",
				registro: input.registro,
				corpo: input.corpo,
			});
			if (portao !== "segue") return portao;
			if (!input.registro) {
				return await this.recusarSuspensao(agora, input.ip, null, input.corpo, "DELETE", [
					{ codigo: "registro_desconhecido", detalhe: "registro ausente na URL" },
				]);
			}
			const motivo = lerMotivoReativacao(lerJson(input.corpo));
			if ("motivos" in motivo) {
				return await this.recusarSuspensao(agora, input.ip, input.registro, input.corpo, "DELETE", motivo.motivos);
			}
			if (!this.suspensaExiste(input.registro)) {
				return await this.recusarSuspensao(agora, input.ip, input.registro, input.corpo, "DELETE", [
					{ codigo: "nao_suspensa", detalhe: "não há suspensão para este registro" },
				]);
			}
			this.ctx.storage.sql.exec("DELETE FROM suspensoes WHERE registro = ?", input.registro);
			await this.gravarAuditoriaAgente({
				em: agora.toISOString(),
				ip: input.ip || "desconhecido",
				chaveValida: true,
				registro: input.registro,
				corpo: input.corpo,
				status: 200,
				motivos: [],
				rota: "/api/agente/suspensoes",
				metodo: "DELETE",
			});
			return { status: 200 as const, corpo: { status: "reativada" as const } };
		});
	}

	/** GET /api/agente/auditoria */
	async listarAuditoriaPublica(input: PedidoAuditoria): Promise<RespostaAuditoria> {
		const agora = relogioDe(input.agora);
		const chaveValida = await this.chaveConfereBearer(input.bearer);
		return this.ctx.blockConcurrencyWhile(async () => {
			const portao = await this.aplicarPortao({
				chaveValida,
				ip: input.ip,
				em: agora.toISOString(),
				rota: "/api/agente/auditoria",
				metodo: "GET",
				exigeChave: true,
			});
			if (portao !== "segue") return portao;
			const desde = lerDesde(input.desde);
			const depois = lerDepois(input.depois);
			const motivos: RecusaSuspensao[] = [];
			if ("erro" in desde) {
				motivos.push({ codigo: "desde_invalido", detalhe: "desde não é uma data" });
			}
			if ("erro" in depois) {
				motivos.push({ codigo: "depois_invalido", detalhe: "depois não é um cursor" });
			}
			if ("erro" in desde || "erro" in depois) {
				await this.gravarAuditoriaAgente({
					em: agora.toISOString(),
					ip: input.ip || "desconhecido",
					chaveValida: true,
					registro: null,
					corpo: input.consulta,
					status: 422,
					motivos: motivos.map((m) => m.codigo),
					rota: "/api/agente/auditoria",
					metodo: "GET",
				});
				return { status: 422 as const, corpo: { motivos } };
			}
			const limite = lerLimite(input.limite);
			const pagina = this.lerAuditoriaPagina(desde.iso, depois.id, limite);
			await this.gravarAuditoriaAgente({
				em: agora.toISOString(),
				ip: input.ip || "desconhecido",
				chaveValida: true,
				registro: null,
				corpo: input.consulta,
				status: 200,
				motivos: [],
				rota: "/api/agente/auditoria",
				metodo: "GET",
			});
			const ultima = pagina.entradas.at(-1);
			const proximo =
				pagina.temProxima && ultima
					? caminhoProximo(input.desde, ultima.id, limite)
					: null;
			return { status: 200 as const, corpo: { entradas: pagina.entradas, proximo } };
		});
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
		const agora = relogioDe(input.agora);
		const chaveValida = await this.chaveConfereBearer(input.bearer);
		const passagem = await this.ctx.blockConcurrencyWhile(async () => {
			const portao = await this.aplicarPortaoEscrita({
				chaveValida,
				ip: input.ip,
				em: agora.toISOString(),
				rota: "/api/agente/resultados",
				metodo: "POST",
				registro: registroDoCorpo(input.corpo),
				corpo: input.corpo,
			});
			if (portao === "segue") return { kind: "segue" as const };
			return { kind: "fim" as const, resposta: portao };
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
			const encerrada = await this.recusarSeEncerrada({
				ip: input.ip,
				em: agora.toISOString(),
				rota: "/api/agente/resultados",
				metodo: "POST",
				registro: lido.registro,
				corpo: input.corpo,
			});
			if (encerrada !== "segue") return encerrada;
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
				const confirma =
					htmlFonte != null &&
					confirmarHtml(
						htmlFonte,
						lido.envio.registro,
						deNovo.instituto,
						lido.envio.totais,
						lido.envio.validosPublicados,
					);
				const motivo = motivoDaFonte(htmlFonte, falhaFonte, confirma);
				if (motivo) finais.push(motivo);
			}
			const unicos = dedupar(finais);
			if (!lido.envio || !deNovo || deNovo.removidoDoTse || deNovo.classificacao !== "nacional" || unicos.length > 0) {
				await this.gravarAuditoriaAgente({
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
				await this.gravarAuditoriaAgente({
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
			await this.gravarAuditoriaAgente({
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

	async agenteAutorizado(bearer: string | null): Promise<boolean> {
		return this.chaveConfereBearer(bearer);
	}

	async importAutorizado(bearer: string | null): Promise<boolean> {
		if (bearer == null) return false;
		const importSecreto = segredoImport(this.env);
		const agenteSecreto = segredoAgente(this.env);
		const importOk = importSecreto.length > 0 && (await chaveConfere(bearer, importSecreto));
		const agenteOk = agenteSecreto.length > 0 && (await chaveConfere(bearer, agenteSecreto));
		return importOk && !agenteOk;
	}

	private async chaveConfereBearer(bearer: string | null): Promise<boolean> {
		const segredo = segredoAgente(this.env);
		return bearer != null && segredo.length > 0 && (await chaveConfere(bearer, segredo));
	}

	/** Chame dentro do lock. */
	private async aplicarPortao(input: {
		chaveValida: boolean;
		ip: string;
		em: string;
		rota: string;
		metodo: string;
		exigeChave: boolean;
	}): Promise<"segue" | RespostaNegacao> {
		this.garantirEsquema();
		const ip = input.ip || "desconhecido";
		const limite = input.chaveValida ? LIMITE_POR_CHAVE : LIMITE_POR_IP;
		const balde = input.chaveValida ? "chave" : `ip:${ip}`;
		const binding = input.chaveValida ? this.env.LIMITE_AGENTE_CHAVE : this.env.LIMITE_AGENTE_IP;
		if (!(await bindingDeixaPassar(binding, balde))) {
			await this.gravarNegacao({ em: input.em, ip, status: 429, rota: input.rota, metodo: input.metodo, chaveValida: input.chaveValida });
			return resposta429();
		}
		if (!this.consumirTaxa(balde, limite, Date.now())) {
			await this.gravarNegacao({ em: input.em, ip, status: 429, rota: input.rota, metodo: input.metodo, chaveValida: input.chaveValida });
			return resposta429();
		}
		if (input.exigeChave && !input.chaveValida) {
			await this.gravarNegacao({ em: input.em, ip, status: 401, rota: input.rota, metodo: input.metodo, chaveValida: false });
			return resposta401();
		}
		return "segue";
	}

	private async recusarSuspensao(
		agora: Date,
		ip: string,
		registro: string | null,
		corpo: string,
		metodo: "POST" | "DELETE",
		motivos: RecusaSuspensao[],
	): Promise<{ status: 422; corpo: { motivos: RecusaSuspensao[] } }> {
		await this.gravarAuditoriaAgente({
			em: agora.toISOString(),
			ip: ip || "desconhecido",
			chaveValida: true,
			registro,
			corpo,
			status: 422,
			motivos: motivos.map((motivo) => motivo.codigo),
			rota: "/api/agente/suspensoes",
			metodo,
		});
		return { status: 422, corpo: { motivos } };
	}

	/** Trava local, gravada pelo aviso do poller. Leitura síncrona: escrita nenhuma depende do poller no ar. */
	private encerrada(): boolean {
		return this.ctx.storage.kv.get(CHAVE_ENCERRADA) === true;
	}

	/** Monotônica e idempotente: só a primeira gravação deixa rastro no log. */
	private travar(origem: "aviso" | "reconciliacao"): void {
		if (this.encerrada()) return;
		this.ctx.storage.kv.put(CHAVE_ENCERRADA, true);
		registrar({ evento: "trava", resultado: "gravada", origem });
	}

	/**
	 * Pull dos imports, fora do lock: cobre o aviso perdido. Poller fora não
	 * derruba o import; loga e segue sem trava. Nunca nas rotas do agente.
	 */
	private async encerradaReconciliando(): Promise<boolean> {
		if (this.encerrada()) return true;
		try {
			const poller = this.env.POLLER.getByName(nomePoller(String(this.env.ELEICAO_FEDERAL)));
			if (await poller.apuracaoEncerrada()) this.travar("reconciliacao");
		} catch (erro) {
			registrar({
				evento: "trava",
				resultado: "erro",
				origem: "reconciliacao",
				erro: erro instanceof Error ? erro.message : String(erro),
			});
		}
		return this.encerrada();
	}

	/** Chame dentro do lock. Portão das escritas do agente: com a apuração encerrada, 409 na auditoria. */
	private async aplicarPortaoEscrita(
		input: EscritaAgente & { chaveValida: boolean },
	): Promise<"segue" | RespostaNegacao | RespostaEncerrada> {
		const portao = await this.aplicarPortao({ ...input, exigeChave: true });
		if (portao !== "segue") return portao;
		return this.recusarSeEncerrada(input);
	}

	/** Chame dentro do lock. */
	private async recusarSeEncerrada(input: EscritaAgente): Promise<"segue" | RespostaEncerrada> {
		if (!this.encerrada()) return "segue";
		await this.gravarAuditoriaAgente({
			em: input.em,
			ip: input.ip || "desconhecido",
			chaveValida: true,
			registro: input.registro,
			corpo: input.corpo,
			status: 409,
			motivos: ["apuracao_encerrada"],
			rota: input.rota,
			metodo: input.metodo,
		});
		return respostaEncerrada();
	}

	private registroAtivo(registro: string): RegistroPesquisas | null {
		const achado = this.lerRegistros().find((item) => item.registro === registro);
		if (!achado || achado.removidoDoTse) return null;
		return achado;
	}

	private suspensaExiste(registro: string): boolean {
		const row = this.ctx.storage.sql
			.exec<{ n: number }>("SELECT COUNT(*) AS n FROM suspensoes WHERE registro = ?", registro)
			.one();
		return Number(row.n) > 0;
	}

	private lerAuditoriaPagina(
		desdeIso: string | null,
		depois: number,
		limite: number,
	): { entradas: EntradaAuditoriaPublica[]; temProxima: boolean } {
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
				FROM auditoria_agente
				WHERE (? IS NULL OR em >= ?) AND id > ?
				ORDER BY id
				LIMIT ?`,
				desdeIso,
				desdeIso,
				depois,
				limite + 1,
			)
			.toArray();
		const temProxima = rows.length > limite;
		const entradas = rows.slice(0, limite).map((row) => ({
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
		return { entradas, temProxima };
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
				motivo TEXT NOT NULL,
				decisao_url TEXT
			)
		`);
		this.garantirDecisaoUrl();
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

	private garantirDecisaoUrl(): void {
		const cols = this.ctx.storage.sql
			.exec<{ name: string }>("PRAGMA table_info(suspensoes)")
			.toArray();
		if (!cols.some((col) => col.name === "decisao_url")) {
			this.ctx.storage.sql.exec("ALTER TABLE suspensoes ADD COLUMN decisao_url TEXT");
		}
	}

	private async gravarNegacao(entrada: {
		em: string;
		ip: string;
		status: 401 | 429;
		rota: string;
		metodo: string;
		chaveValida?: boolean;
	}): Promise<void> {
		await this.gravarAuditoriaAgente({
			em: entrada.em,
			ip: entrada.ip,
			chaveValida: entrada.chaveValida === true,
			registro: null,
			corpo: "",
			status: entrada.status,
			motivos: [entrada.status === 401 ? "nao_autorizado" : "limite"],
			rota: entrada.rota,
			metodo: entrada.metodo,
		});
	}

	private async gravarAuditoriaAgente(entrada: {
		em: string;
		ip: string;
		chaveValida: boolean;
		registro: string | null;
		corpo: string;
		status: number;
		motivos: string[];
		rota?: string;
		metodo?: string;
	}): Promise<void> {
		const agora = Date.now();
		this.ctx.storage.transactionSync(() => {
			this.ctx.storage.sql.exec(
				`INSERT INTO auditoria_agente (
					em, rota, metodo, ip, chave_valida, registro, corpo, status, motivos
				) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
				entrada.em,
				entrada.rota ?? "/api/agente/resultados",
				entrada.metodo ?? "POST",
				entrada.ip,
				entrada.chaveValida ? 1 : 0,
				entrada.registro?.slice(0, 120) ?? null,
				entrada.corpo.slice(0, 8000),
				entrada.status,
				JSON.stringify(entrada.motivos),
			);
			this.podarAuditoriaAgente(agora);
		});
		await this.programarAlarmeAuditoria(agora);
	}

	private podarAuditoriaAgente(agoraMs: number): void {
		const corte = new Date(agoraMs - IDADE_AUDITORIA_AGENTE_MS).toISOString();
		this.ctx.storage.sql.exec("DELETE FROM auditoria_agente WHERE em < ?", corte);
		const n = Number(
			this.ctx.storage.sql.exec<{ n: number }>("SELECT COUNT(*) AS n FROM auditoria_agente").one().n,
		);
		if (n <= TETO_LINHAS_AUDITORIA_AGENTE) return;
		const excesso = n - TETO_LINHAS_AUDITORIA_AGENTE;
		const limite = this.ctx.storage.sql
			.exec<{ id: number }>(
				"SELECT id FROM auditoria_agente ORDER BY id ASC LIMIT 1 OFFSET ?",
				excesso - 1,
			)
			.one();
		this.ctx.storage.sql.exec("DELETE FROM auditoria_agente WHERE id <= ?", limite.id);
	}

	private async programarAlarmeAuditoria(agoraMs: number): Promise<void> {
		const antiga = this.ctx.storage.sql
			.exec<{ em: string }>("SELECT em FROM auditoria_agente ORDER BY em ASC LIMIT 1")
			.toArray()[0];
		if (!antiga) {
			await this.ctx.storage.deleteAlarm();
			return;
		}
		const vence = Date.parse(antiga.em) + IDADE_AUDITORIA_AGENTE_MS;
		const quando = Math.max(vence, agoraMs + 60_000);
		await this.ctx.storage.setAlarm(quando);
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

	private lerSuspensos(): Set<string> {
		const rows = this.ctx.storage.sql
			.exec<{ registro: string }>("SELECT registro FROM suspensoes")
			.toArray();
		return new Set(rows.map((row) => row.registro));
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

/** Um evento por import. `null` = nada foi feito, nada a registrar. */
async function medirImport<T extends Changeset | ImportCongelado | null>(
	motivo: MotivoImport,
	importar: () => Promise<T>,
): Promise<T> {
	const inicio = Date.now();
	try {
		const changeset = await importar();
		if (changeset) registrar(eventoImport(motivo, changeset, Date.now() - inicio));
		return changeset;
	} catch (erro) {
		registrar(eventoImport(motivo, { kind: "erro", erro }, Date.now() - inicio));
		throw erro;
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
	return (await buscarZip(url, null, null)) as CorpoZip;
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

type EscritaAgente = {
	ip: string;
	em: string;
	rota: "/api/agente/resultados" | "/api/agente/suspensoes";
	metodo: "POST" | "DELETE";
	registro: string | null;
	corpo: string;
};

/** Depois do encerramento, o arquivo do 2º turno não muda mais (#86). */
type RespostaEncerrada = {
	status: 409;
	corpo: { erro: "apuracao_encerrada"; detalhe: string };
};

export type RespostaResultado =
	| { status: 201; corpo: { status: "publicado" } }
	| { status: 200; corpo: { status: "substituido" } }
	| { status: 401; corpo: { erro: "nao_autorizado" } }
	| { status: 429; corpo: { erro: "limite" } }
	| { status: 422; corpo: { motivos: MotivoRecusa[] } }
	| RespostaEncerrada;

type PedidoAgente = {
	bearer: string | null;
	ip: string;
	agora: Date;
};

type RespostaNegacao =
	| { status: 401; corpo: { erro: "nao_autorizado" } }
	| { status: 429; corpo: { erro: "limite" } };

type RespostaSuspensao =
	| { status: 201; corpo: { status: "suspensa" } }
	| { status: 200; corpo: { status: "suspensa" } }
	| RespostaNegacao
	| { status: 422; corpo: { motivos: RecusaSuspensao[] } }
	| RespostaEncerrada;

type RespostaReativacao =
	| { status: 200; corpo: { status: "reativada" } }
	| RespostaNegacao
	| { status: 422; corpo: { motivos: RecusaSuspensao[] } }
	| RespostaEncerrada;

type PedidoAuditoria = PedidoAgente & {
	desde: string | null;
	depois: string | null;
	limite: string | null;
	consulta: string;
};

type EntradaAuditoriaPublica = {
	id: number;
	em: string;
	rota: string;
	metodo: string;
	ip: string;
	chaveValida: boolean;
	registro: string | null;
	corpo: string;
	status: number;
	motivos: string[];
};

type RespostaAuditoria =
	| { status: 200; corpo: { entradas: EntradaAuditoriaPublica[]; proximo: string | null } }
	| RespostaNegacao
	| { status: 422; corpo: { motivos: RecusaSuspensao[] } };

function relogioDe(agora: Date): Date {
	const data = agora instanceof Date ? agora : new Date(agora);
	if (Number.isNaN(data.getTime())) throw new Error("agora inválido");
	return data;
}

function lerJson(corpo: string): unknown {
	try {
		return JSON.parse(corpo) as unknown;
	} catch {
		return null;
	}
}

function lerDesde(desde: string | null): { iso: string | null } | { erro: true } {
	if (desde == null || desde.trim() === "") return { iso: null };
	const data = new Date(desde);
	if (Number.isNaN(data.getTime())) return { erro: true };
	return { iso: data.toISOString() };
}

function lerDepois(depois: string | null): { id: number } | { erro: true } {
	if (depois == null || depois.trim() === "") return { id: 0 };
	if (!/^\d+$/.test(depois)) return { erro: true };
	const id = Number(depois);
	if (!Number.isSafeInteger(id)) return { erro: true };
	return { id };
}

function lerLimite(limite: string | null): number {
	if (limite == null || limite.trim() === "") return 500;
	if (!/^\d+$/.test(limite)) return 500;
	const n = Number(limite);
	if (!Number.isSafeInteger(n) || n < 1) return 500;
	return Math.min(500, n);
}

function caminhoProximo(desde: string | null, depois: number, limite: number): string {
	const q = new URLSearchParams();
	if (desde) q.set("desde", desde);
	q.set("depois", String(depois));
	if (limite !== 500) q.set("limite", String(limite));
	return `/api/agente/auditoria?${q.toString()}`;
}

function respostaEncerrada(): RespostaEncerrada {
	return {
		status: 409,
		corpo: {
			erro: "apuracao_encerrada",
			detalhe: "a apuração do 2º turno foi encerrada; pesquisas e resultados estão congelados",
		},
	};
}

function resposta401(): RespostaNegacao {
	return { status: 401, corpo: { erro: "nao_autorizado" } };
}

function resposta429(): RespostaNegacao {
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
		const chave = `${motivo.codigo}\0${motivo.detalhe}`;
		if (vistos.has(chave)) continue;
		vistos.add(chave);
		saida.push(motivo);
	}
	return saida;
}
