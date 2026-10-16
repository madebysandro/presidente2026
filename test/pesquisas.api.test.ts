/**
 * Aceite #7 (sanidade do DO) e #8 (import TSE + GET /api/pesquisas).
 */
import { runInDurableObject } from "cloudflare:test";
import { env } from "cloudflare:workers";
import { beforeEach, describe, expect, it } from "vitest";
import cronFonte from "../crons/import-pesquisas-tse.ts?raw";
import { parseCsvTse } from "../src/pesquisas/csv";
import { linhaPesquisaNoCorte, montarAplicar } from "../src/pesquisas/importar";
import type { Pesquisas } from "../src/pesquisas/pesquisas";
import type { PayloadPesquisas, RegistroPesquisas } from "../src/pesquisas/tipos";
import {
	bytesDeDataUrl,
	instalarCdnPesquisas,
	pedidosCdn,
	URL_CONTRATANTE_TSE,
	URL_PESQUISA_TSE,
} from "./helpers/cdn-pesquisas";
import { fetchWorker } from "./helpers/fetch-worker";
import {
	LIBERADAS_EM_15_10,
	NACIONAIS,
	VEM_AI_EM_15_10,
} from "./helpers/nacionais-oracle";
import { selfComScheduled } from "./helpers/self-scheduled";
import dia0ContratanteUrl from "../fixtures/pesquisas-tse/fixture_dia0_contratante.zip?inline";
import dia0PesquisaUrl from "../fixtures/pesquisas-tse/fixture_dia0_pesquisa.zip?inline";
import dia1ContratanteUrl from "../fixtures/pesquisas-tse/fixture_dia1_contratante.zip?inline";
import dia1PesquisaUrl from "../fixtures/pesquisas-tse/fixture_dia1_pesquisa.zip?inline";

const ETAG_PESQUISA_0 = '"dia0-pesquisa"';
const ETAG_CONTRATANTE_0 = '"dia0-contratante"';
const ETAG_PESQUISA_1 = '"dia1-pesquisa"';
const ETAG_CONTRATANTE_1 = '"dia1-contratante"';
const AGORA_15_10 = new Date("2026-10-15T18:00:00-03:00");

const dia0Pesquisa = bytesDeDataUrl(dia0PesquisaUrl);
const dia0Contratante = bytesDeDataUrl(dia0ContratanteUrl);
const dia1Pesquisa = bytesDeDataUrl(dia1PesquisaUrl);
const dia1Contratante = bytesDeDataUrl(dia1ContratanteUrl);

function stubPesquisas(): DurableObjectStub<Pesquisas> {
	return env.PESQUISAS.getByName("singleton") as DurableObjectStub<Pesquisas>;
}

async function limparPesquisas(): Promise<void> {
	await runInDurableObject(stubPesquisas(), async (_inst, state) => {
		await state.storage.deleteAll();
	});
}

function ids(lista: readonly { registro: string }[]): string[] {
	return [...lista].map((item) => item.registro).sort();
}

function cartasPublicas(
	corpo: Pick<PayloadPesquisas, "liberadasSemNumero" | "vemAi">,
) {
	return [...corpo.liberadasSemNumero, ...corpo.vemAi]
		.map((carta) => ({
			registro: carta.registro,
			instituto: carta.instituto,
			contratantes: [...carta.contratantes],
			campoInicio: carta.campoInicio,
			campoFim: carta.campoFim,
			liberacaoEfetiva: carta.liberacaoEfetiva,
			entrevistas: carta.entrevistas,
		}))
		.sort((a, b) => (a.registro < b.registro ? -1 : a.registro > b.registro ? 1 : 0));
}

const CARTAS_ORACULO = [...NACIONAIS]
	.map((registro) => ({
		registro: registro.registro,
		instituto: registro.instituto,
		contratantes: [...registro.contratantes],
		campoInicio: registro.campoInicio,
		campoFim: registro.campoFim,
		liberacaoEfetiva: registro.liberacaoEfetiva,
		entrevistas: registro.entrevistas,
	}))
	.sort((a, b) => (a.registro < b.registro ? -1 : a.registro > b.registro ? 1 : 0));

beforeEach(async () => {
	await limparPesquisas();
});

describe("DO Pesquisas — sanidade (#7)", () => {
	it("ping e obterEstado respondem sem erro", async () => {
		const stub = stubPesquisas();
		await expect(stub.ping()).resolves.toEqual({ ok: true });
		await expect(stub.obterEstado()).resolves.toEqual({
			pronto: true,
			registros: 0,
		});
	});
});

describe("import do TSE e GET /api/pesquisas (#8)", () => {
	it("parseCsvTse com manter descarta fora do corte na própria varredura", () => {
		const csv = [
			'"DS_CARGO";"DT_FIM_PESQUISA";"NR_PROTOCOLO_REGISTRO"',
			'"Senador";"2026-10-10";"BR000012026"',
			'"Presidente";"2026-10-01";"BR000022026"',
			'"Presidente";"2026-10-08";"BR000032026"',
			"",
		].join("\n");
		const rows = parseCsvTse(csv, { manter: linhaPesquisaNoCorte });
		expect(rows.map((r) => r.NR_PROTOCOLO_REGISTRO)).toEqual(["BR000032026"]);
	});

	it("classifica 57 linhas em 33 nacionais, 24 estaduais e 0 ambíguas, com ME/IC em 32", async () => {
		instalarCdnPesquisas({
			pesquisa: dia0Pesquisa,
			contratante: dia0Contratante,
			etagPesquisa: ETAG_PESQUISA_0,
			etagContratante: ETAG_CONTRATANTE_0,
			condicional304: false,
		});
		const changeset = await stubPesquisas().importarDoTse({ motivo: "teste" });
		expect(changeset.kind).toBe("aplicar");
		if (changeset.kind !== "aplicar") return;
		expect(changeset.upserts).toHaveLength(57);
		expect(changeset.meta.contagens).toEqual({
			nacional: 33,
			estadual: 24,
			ambigua: 0,
		});
		expect(changeset.meta.geradoEm).toBe("2026-10-15T05:46:43-03:00");
		expect(
			changeset.upserts.filter((registro) => registro.classificacao === "nacional"),
		).toHaveLength(33);
		expect(
			changeset.upserts.filter((registro) => registro.classificacao === "estadual"),
		).toHaveLength(24);
		expect(
			changeset.upserts.filter((registro) => registro.classificacao === "ambigua"),
		).toHaveLength(0);
		const comMargem = changeset.upserts.filter(
			(registro) =>
				registro.classificacao === "nacional" &&
				registro.margem != null &&
				registro.confianca != null,
		);
		expect(comMargem).toHaveLength(32);
		for (const esperado of NACIONAIS) {
			const achado = changeset.upserts.find(
				(registro) => registro.registro === esperado.registro,
			);
			expect(achado, esperado.registro).toMatchObject({
				instituto: esperado.instituto,
				contratantes: [...esperado.contratantes],
				campoInicio: esperado.campoInicio,
				campoFim: esperado.campoFim,
				liberacaoEfetiva: esperado.liberacaoEfetiva,
				entrevistas: esperado.entrevistas,
				margem: esperado.margem,
				confianca: esperado.confianca,
				classificacao: "nacional",
				removidoDoTse: false,
			});
		}
		expect(
			changeset.upserts.find((registro) => registro.registro === "BR-06957/2026"),
		).toMatchObject({ margem: null, confianca: null });
	});

	it("acha o CSV Brasil pelo diretório central quando a entrada não é a primeira", async () => {
		instalarCdnPesquisas({
			pesquisa: dia0Pesquisa,
			contratante: dia0Contratante,
			etagPesquisa: ETAG_PESQUISA_0,
			etagContratante: ETAG_CONTRATANTE_0,
			condicional304: false,
		});
		const changeset = await stubPesquisas().importarDoTse({ motivo: "teste" });
		expect(changeset.kind).toBe("aplicar");
		if (changeset.kind !== "aplicar") return;
		expect(changeset.upserts).toHaveLength(57);
		expect(
			changeset.upserts.some((registro) => registro.registro === "BR-02949/2026"),
		).toBe(true);
	});

	it("304 não reprocessa e conserva o dia anterior", async () => {
		instalarCdnPesquisas({
			pesquisa: dia0Pesquisa,
			contratante: dia0Contratante,
			etagPesquisa: ETAG_PESQUISA_0,
			etagContratante: ETAG_CONTRATANTE_0,
			condicional304: false,
		});
		const primeiro = await stubPesquisas().importarDoTse({ motivo: "teste" });
		expect(primeiro.kind).toBe("aplicar");
		instalarCdnPesquisas({
			pesquisa: dia1Pesquisa,
			contratante: dia1Contratante,
			etagPesquisa: ETAG_PESQUISA_0,
			etagContratante: ETAG_CONTRATANTE_0,
			condicional304: true,
		});
		const segundo = await stubPesquisas().importarDoTse({ motivo: "teste" });
		expect(segundo.kind).toBe("nao_modificado");
		expect(pedidosCdn.map((pedido) => pedido.ifNoneMatch)).toEqual([
			ETAG_PESQUISA_0,
			ETAG_CONTRATANTE_0,
		]);
		expect(pedidosCdn.map((pedido) => pedido.ifModifiedSince)).toEqual([
			"Thu, 15 Oct 2026 08:46:43 GMT",
			"Thu, 15 Oct 2026 08:46:43 GMT",
		]);
		const corpo = await stubPesquisas().listarPublico({ agora: AGORA_15_10 });
		expect(ids(corpo.liberadasSemNumero)).toContain("BR-02949/2026");
		expect(
			[...corpo.liberadasSemNumero, ...corpo.vemAi].find(
				(carta) => carta.registro === "BR-08134/2026",
			)?.entrevistas,
		).toBe(3000);
	});

	it("atualiza entrevista, inclui registro novo e tira quem sumiu do CSV", async () => {
		instalarCdnPesquisas({
			pesquisa: dia0Pesquisa,
			contratante: dia0Contratante,
			etagPesquisa: ETAG_PESQUISA_0,
			etagContratante: ETAG_CONTRATANTE_0,
			condicional304: false,
		});
		await stubPesquisas().importarDoTse({ motivo: "teste" });
		instalarCdnPesquisas({
			pesquisa: dia1Pesquisa,
			contratante: dia1Contratante,
			etagPesquisa: ETAG_PESQUISA_1,
			etagContratante: ETAG_CONTRATANTE_1,
			condicional304: false,
		});
		const changeset = await stubPesquisas().importarDoTse({ motivo: "teste" });
		expect(changeset.kind).toBe("aplicar");
		if (changeset.kind !== "aplicar") return;
		expect(changeset.remover).toEqual(["BR-02949/2026"]);
		expect(changeset.meta.contagens).toEqual({
			nacional: 33,
			estadual: 24,
			ambigua: 0,
		});
		expect(
			changeset.upserts.find((registro) => registro.registro === "BR-08134/2026"),
		).toMatchObject({ entrevistas: 9999, instituto: "PoderData" });
		expect(
			changeset.upserts.find((registro) => registro.registro === "BR-99999/2026"),
		).toMatchObject({
			instituto: "PoderData",
			contratantes: ["recursos próprios"],
			campoInicio: "2026-10-16",
			campoFim: "2026-10-18",
			liberacaoEfetiva: "2026-10-19",
			entrevistas: 1234,
			margem: 1.8,
			confianca: 95,
			classificacao: "nacional",
			removidoDoTse: false,
		});
		expect(
			changeset.auditoria.find((entrada) => entrada.tipo === "removido"),
		).toMatchObject({
			registro: "BR-02949/2026",
			detalhe: "sumiu do CSV",
		});
		const corpo = await stubPesquisas().listarPublico({ agora: AGORA_15_10 });
		const todos = [...corpo.liberadasSemNumero, ...corpo.vemAi];
		expect(todos.some((carta) => carta.registro === "BR-02949/2026")).toBe(false);
		expect(
			todos.find((carta) => carta.registro === "BR-08134/2026")?.entrevistas,
		).toBe(9999);
		expect(
			todos.find((carta) => carta.registro === "BR-99999/2026"),
		).toMatchObject({
			instituto: "PoderData",
			entrevistas: 1234,
			liberacaoEfetiva: "2026-10-19",
		});
		const auditoria = await runInDurableObject(stubPesquisas(), (_inst, state) =>
			state.storage.sql
				.exec<{ registro: string; detalhe: string }>(
					"SELECT registro, detalhe FROM auditoria WHERE tipo = 'removido' ORDER BY id",
				)
				.toArray(),
		);
		expect(auditoria).toEqual([
			{ registro: "BR-02949/2026", detalhe: "sumiu do CSV" },
		]);
	});

	it("separa liberadas e vêm aí em 15/10, com a liberação efetiva de Vetor e GERP", async () => {
		instalarCdnPesquisas({
			pesquisa: dia0Pesquisa,
			contratante: dia0Contratante,
			etagPesquisa: ETAG_PESQUISA_0,
			etagContratante: ETAG_CONTRATANTE_0,
			condicional304: false,
		});
		await stubPesquisas().importarDoTse({ motivo: "teste" });
		const corpo = await stubPesquisas().listarPublico({ agora: AGORA_15_10 });
		expect(corpo.hoje).toBe("2026-10-15");
		expect(corpo.publicadas).toEqual([]);
		expect(corpo.media).toBeNull();
		expect(corpo.serieMedia).toEqual([]);
		expect(ids(corpo.liberadasSemNumero)).toEqual([...LIBERADAS_EM_15_10].sort());
		expect(ids(corpo.vemAi)).toEqual([...VEM_AI_EM_15_10].sort());
		expect(cartasPublicas(corpo)).toEqual(CARTAS_ORACULO);
		expect(
			corpo.vemAi.find((carta) => carta.registro === "BR-06957/2026"),
		).toMatchObject({ liberacaoEfetiva: "2026-10-23", instituto: "Vetor" });
		expect(
			corpo.vemAi.find((carta) => carta.registro === "BR-05187/2026"),
		).toMatchObject({ liberacaoEfetiva: "2026-10-16", instituto: "GERP" });
	});

	it("GET /api/pesquisas lista só nacionais, sem números, com cache de 30s", async () => {
		instalarCdnPesquisas({
			pesquisa: dia0Pesquisa,
			contratante: dia0Contratante,
			etagPesquisa: ETAG_PESQUISA_0,
			etagContratante: ETAG_CONTRATANTE_0,
			condicional304: false,
		});
		await stubPesquisas().importarDoTse({ motivo: "teste" });
		const res = await fetchWorker(
			new Request("http://presidente2026.test/api/pesquisas"),
		);
		expect(res.status).toBe(200);
		expect(res.headers.get("cache-control")).toBe(
			"public, max-age=0, s-maxage=30",
		);
		const corpo = (await res.json()) as PayloadPesquisas;
		expect(corpo.publicadas).toEqual([]);
		expect(corpo.media).toBeNull();
		expect(corpo.serieMedia).toEqual([]);
		expect(corpo.registroTse).toEqual({
			geradoEm: "2026-10-15T05:46:43-03:00",
			etag: ETAG_PESQUISA_0,
		});
		expect(cartasPublicas(corpo)).toEqual(CARTAS_ORACULO);
		const amostra = corpo.liberadasSemNumero[0] ?? corpo.vemAi[0];
		expect(amostra).toBeDefined();
		expect(Object.keys(amostra!).sort()).toEqual([
			"campoFim",
			"campoInicio",
			"contratantes",
			"entrevistas",
			"instituto",
			"liberacaoEfetiva",
			"registro",
		]);
		const pedidosAntes = pedidosCdn.length;
		const deNovo = await fetchWorker(
			new Request("http://presidente2026.test/api/pesquisas"),
		);
		expect(deNovo.status).toBe(200);
		expect(pedidosCdn).toHaveLength(pedidosAntes);
	});

	it("o cron scheduled importa quando o banco está vazio", async () => {
		instalarCdnPesquisas({
			pesquisa: dia0Pesquisa,
			contratante: dia0Contratante,
			etagPesquisa: ETAG_PESQUISA_0,
			etagContratante: ETAG_CONTRATANTE_0,
			condicional304: false,
		});
		expect((await stubPesquisas().obterEstado()).registros).toBe(0);
		expect(cronFonte).toContain('["0 9 * * *", "0 15 * * *", "0 21 * * *"]');
		expect(cronFonte).toContain('motivo: "cron"');
		const resultado = await selfComScheduled().scheduled({
			cron: "0 9 * * *",
			scheduledTime: new Date("2026-10-16T09:00:00Z"),
		});
		expect(resultado.outcome).toBe("ok");
		expect((await stubPesquisas().obterEstado()).registros).toBe(57);
		expect(pedidosCdn.map((pedido) => pedido.url).sort()).toEqual(
			[URL_CONTRATANTE_TSE, URL_PESQUISA_TSE].sort(),
		);
		const corpo = await stubPesquisas().listarPublico({ agora: AGORA_15_10 });
		expect(corpo.registroTse.geradoEm).toBe("2026-10-15T05:46:43-03:00");
		expect(cartasPublicas(corpo)).toEqual(CARTAS_ORACULO);
	});

	it("corte vazio não revoga o ledger", () => {
		const anterior = {
			registro: "BR-02949/2026",
			cnpj: "07630546000175",
			instituto: "Datafolha",
			contratantes: ["Folha de S.Paulo"],
			campoInicio: "2026-10-06",
			campoFim: "2026-10-08",
			liberacao: "2026-10-08",
			liberacaoEfetiva: "2026-10-08",
			entrevistas: 2520,
			margem: 2,
			confianca: 95,
			classificacao: "nacional",
			removidoDoTse: false,
		} satisfies RegistroPesquisas;
		expect(() =>
			montarAplicar({
				anteriores: [anterior],
				lidos: [],
				em: "2026-10-16T12:00:00.000Z",
				motivo: "teste",
				origem: {
					geradoEm: null,
					etagPesquisa: null,
					etagContratante: null,
					lastModifiedPesquisa: null,
					lastModifiedContratante: null,
				},
			}),
		).toThrow("corte vazio");
	});

	it("linha rejeitada não vira removido_do_tse", () => {
		const anterior = {
			registro: "BR-08134/2026",
			cnpj: "1",
			instituto: "PoderData",
			contratantes: ["recursos próprios"],
			campoInicio: "2026-10-05",
			campoFim: "2026-10-07",
			liberacao: "2026-10-08",
			liberacaoEfetiva: "2026-10-08",
			entrevistas: 3000,
			margem: 1.8,
			confianca: 95,
			classificacao: "nacional",
			removidoDoTse: false,
		} satisfies RegistroPesquisas;
		const outro = {
			...anterior,
			registro: "BR-02949/2026",
			instituto: "Datafolha",
			entrevistas: 2520,
			margem: 2,
			confianca: 95,
		} satisfies RegistroPesquisas;
		const changeset = montarAplicar({
			anteriores: [anterior, outro],
			lidos: [outro],
			rejeicoes: [
				{ protocolo: "BR081342026", detalhe: "BR081342026: entrevistas inválidas" },
			],
			em: "2026-10-16T12:00:00.000Z",
			motivo: "teste",
			origem: {
				geradoEm: null,
				etagPesquisa: "e1",
				etagContratante: "e2",
				lastModifiedPesquisa: null,
				lastModifiedContratante: null,
			},
		});
		expect(changeset.remover).toEqual([]);
		expect(changeset.auditoria.some((a) => a.tipo === "rejeitado")).toBe(true);
		expect(changeset.auditoria.some((a) => a.tipo === "removido")).toBe(false);
	});

	it("o primeiro GET com banco vazio dispara o import", async () => {
		instalarCdnPesquisas({
			pesquisa: dia0Pesquisa,
			contratante: dia0Contratante,
			etagPesquisa: ETAG_PESQUISA_0,
			etagContratante: ETAG_CONTRATANTE_0,
			condicional304: false,
		});
		expect((await stubPesquisas().obterEstado()).registros).toBe(0);
		const res = await fetchWorker(
			new Request("http://presidente2026.test/api/pesquisas"),
		);
		expect(res.status).toBe(200);
		expect(res.headers.get("cache-control")).toBe(
			"public, max-age=0, s-maxage=30",
		);
		const corpo = (await res.json()) as PayloadPesquisas;
		expect(corpo.publicadas).toEqual([]);
		expect(corpo.media).toBeNull();
		expect(corpo.serieMedia).toEqual([]);
		expect(cartasPublicas(corpo)).toEqual(CARTAS_ORACULO);
		expect(pedidosCdn).toHaveLength(2);
		expect((await stubPesquisas().obterEstado()).registros).toBe(57);
	});
});
