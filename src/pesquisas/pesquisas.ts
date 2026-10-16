import { DurableObject } from "cloudflare:workers";
import { URL_ZIP_CONTRATANTE, URL_ZIP_PESQUISA } from "./fontes";
import { parseCsv } from "./csv";
import { geradoEmDoCsv, montarAplicar, registrosDoTse } from "./importar";
import { montarPublico } from "./montar-publico";
import type {
	Changeset,
	Classificacao,
	ContagensImport,
	MetaImport,
	MotivoImport,
	PayloadPesquisas,
	RegistroPesquisas,
} from "./tipos";
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
		const meta = this.lerMeta();
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
			if (!meta) throw new Error("304 sem import anterior");
			return { kind: "nao_modificado", meta };
		}
		const zipPesquisa = await corpoGarantido(URL_ZIP_PESQUISA, pesquisa);
		const zipContratante = await corpoGarantido(URL_ZIP_CONTRATANTE, contratante);
		const linhasPesquisa = parseCsv(await extrairCsvBrasil(zipPesquisa.bytes));
		const linhasContratante = parseCsv(await extrairCsvBrasil(zipContratante.bytes));
		const changeset = montarAplicar({
			anteriores: this.lerRegistros(),
			lidos: registrosDoTse(linhasPesquisa, linhasContratante),
			em: new Date().toISOString(),
			motivo: opts.motivo,
			origem: {
				geradoEm: geradoEmDoCsv(linhasPesquisa),
				etagPesquisa: zipPesquisa.etag,
				etagContratante: zipContratante.etag,
				lastModifiedPesquisa: zipPesquisa.lastModified,
				lastModifiedContratante: zipContratante.lastModified,
			},
		});
		this.aplicar(changeset);
		return changeset;
	}

	async garantirImportInicial(): Promise<void> {
		this.garantirEsquema();
		if (this.contarRegistros() === 0 && this.lerMeta() === null) {
			await this.importarDoTse({ motivo: "primeiro_acesso" });
		}
	}

	async listarPublico(opts: { agora: Date }): Promise<PayloadPesquisas> {
		this.garantirEsquema();
		const agora = opts.agora instanceof Date ? opts.agora : new Date(opts.agora);
		if (Number.isNaN(agora.getTime())) throw new Error("agora inválido");
		return montarPublico(this.lerRegistros(), this.lerMeta(), agora);
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
	const headers: Record<string, string> = {};
	if (etag) headers["if-none-match"] = etag;
	if (lastModified) headers["if-modified-since"] = lastModified;
	const resposta = await fetch(url, { headers, cache: "no-store" });
	if (resposta.status === 304) return { kind: "nao_modificado" };
	if (!resposta.ok) throw new Error(`TSE respondeu ${resposta.status} para ${url}`);
	return {
		kind: "corpo",
		bytes: new Uint8Array(await resposta.arrayBuffer()),
		etag: resposta.headers.get("etag"),
		lastModified: resposta.headers.get("last-modified"),
	};
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
