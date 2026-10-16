/**
 * Aceite #10: média e série em GET /api/pesquisas, com a data de referência da fase.
 */
import { runInDurableObject } from "cloudflare:test";
import { env } from "cloudflare:workers";
import { http, HttpResponse } from "msw";
import { beforeEach, describe, expect, it } from "vitest";
import type { Pesquisas } from "../src/pesquisas/pesquisas";
import type { PayloadPesquisas } from "../src/pesquisas/tipos";
import { bytesDeDataUrl, instalarCdnPesquisas } from "./helpers/cdn-pesquisas";
import { fetchWorker } from "./helpers/fetch-worker";
import { network } from "./helpers/rede";
import dia0ContratanteUrl from "../fixtures/pesquisas-tse/fixture_dia0_contratante.zip?inline";
import dia0PesquisaUrl from "../fixtures/pesquisas-tse/fixture_dia0_pesquisa.zip?inline";

const CHAVE = "teste-chave-agente";
const AGORA_15_10 = new Date("2026-10-15T18:00:00-03:00");

const dia0Pesquisa = bytesDeDataUrl(dia0PesquisaUrl);
const dia0Contratante = bytesDeDataUrl(dia0ContratanteUrl);

type Semente = {
	registro: string;
	fonte: string;
	html: string;
	totais: Record<string, number>;
	validosPublicados?: { flavio: number; lula: number };
};

const CINCO: Semente[] = [
	{
		registro: "BR-08134/2026",
		fonte: "https://sbtnews.sbt.com.br/poderdata-07",
		html: "<p>PoderData: Flávio 49% e Lula 44%.</p>",
		totais: { flavio: 49, lula: 44, brancoNulo: 5, naoSabe: 2 },
		validosPublicados: { flavio: 53, lula: 47 },
	},
	{
		registro: "BR-02949/2026",
		fonte: "https://www.metropoles.com/brasil/datafolha-08",
		html: "<p>Datafolha: Flávio 49% e Lula 45%.</p>",
		totais: { flavio: 49, lula: 45, brancoNulo: 5, naoSabe: 1 },
		validosPublicados: { flavio: 52, lula: 48 },
	},
	{
		registro: "BR-03663/2026",
		fonte: "https://www.brasildefato.com.br/atlas-08",
		html: "<p>AtlasIntel: Flávio 51,1% e Lula 45,7%.</p>",
		totais: { flavio: 51.1, lula: 45.7, brancoNuloNaoSabe: 3.2 },
		validosPublicados: { flavio: 52.8, lula: 47.2 },
	},
	{
		registro: "BR-01209/2026",
		fonte: "https://sbtnews.sbt.com.br/poderdata-12",
		html: "<p>PoderData: Flávio 48% e Lula 46%.</p>",
		totais: { flavio: 48, lula: 46, brancoNulo: 5, naoSabe: 2 },
		validosPublicados: { flavio: 51, lula: 49 },
	},
	{
		registro: "BR-08729/2026",
		fonte: "https://www.poder360.com.br/quaest-13",
		html: "<p>Quaest: Flávio 46% e Lula 44%.</p>",
		totais: { flavio: 46, lula: 44, brancoNulo: 9, naoSabe: 1 },
	},
];

function stub(): DurableObjectStub<Pesquisas> {
	return env.PESQUISAS.getByName("singleton") as DurableObjectStub<Pesquisas>;
}

async function limpar(): Promise<void> {
	await runInDurableObject(stub(), async (_inst, state) => {
		await state.storage.deleteAll();
	});
}

async function importar(): Promise<void> {
	instalarCdnPesquisas({
		pesquisa: dia0Pesquisa,
		contratante: dia0Contratante,
		etagPesquisa: '"dia0-pesquisa"',
		etagContratante: '"dia0-contratante"',
		condicional304: false,
	});
	await stub().importarDoTse({ motivo: "teste" });
}

function publicar(semente: Semente, ip: string) {
	network.use(
		http.get(semente.fonte, () =>
			HttpResponse.html(semente.html),
		),
	);
	return fetchWorker(
		new Request("http://presidente2026.test/api/agente/resultados", {
			method: "POST",
			headers: {
				authorization: `Bearer ${CHAVE}`,
				"content-type": "application/json",
				"cf-connecting-ip": ip,
			},
			body: JSON.stringify({
				registro: semente.registro,
				totais: semente.totais,
				validosPublicados: semente.validosPublicados ?? null,
				fonte: semente.fonte,
				margem: null,
				confianca: null,
				substituir: false,
			}),
		}),
	);
}

async function publicarTodas(sementes: Semente[]): Promise<void> {
	for (const [i, semente] of sementes.entries()) {
		const res = await publicar(semente, `203.0.113.${60 + i}`);
		expect(res.status, semente.registro).toBe(201);
	}
}

beforeEach(async () => {
	await limpar();
});

describe("média das pesquisas (#10)", () => {
	it("em 15/10 os 5 resultados iniciais dão Flávio 51,8 e Lula 48,2, com uma pesquisa por CNPJ", async () => {
		await importar();
		await publicarTodas(CINCO);
		const corpo = await stub().listarPublico({ agora: AGORA_15_10 });
		expect(corpo.hoje).toBe("2026-10-15");
		expect(corpo.fase).toBe("pesquisas");
		expect(corpo.media).toEqual({
			data: "2026-10-15",
			vf: 51.77,
			vl: 48.23,
			v: 3.55,
			n: 4,
			margem: 1.7,
			registros: [
				"BR-02949/2026",
				"BR-03663/2026",
				"BR-01209/2026",
				"BR-08729/2026",
			],
		});
		expect(corpo.media?.registros).not.toContain("BR-08134/2026");
		expect(corpo.serieMedia).toEqual([
			{ data: "2026-10-07", vf: 52.69, v: 5.38, n: 1 },
			{ data: "2026-10-08", vf: 52.54, v: 5.07, n: 3 },
			{ data: "2026-10-12", vf: 51.99, v: 3.99, n: 3 },
			{ data: "2026-10-13", vf: 51.77, v: 3.55, n: 4 },
		]);
	});

	it("pesquisa com fim de campo há 16 dias sai da média e continua publicada", async () => {
		await importar();
		await publicarTodas([CINCO[0]!, CINCO[4]!]);
		const corpo = await stub().listarPublico({
			agora: new Date("2026-10-23T12:00:00-03:00"),
		});
		expect(corpo.fase).toBe("pesquisas");
		expect(corpo.publicadas.map((p) => p.registro).sort()).toEqual([
			"BR-08134/2026",
			"BR-08729/2026",
		]);
		expect(corpo.media).toMatchObject({
			data: "2026-10-23",
			n: 1,
			registros: ["BR-08729/2026"],
		});
	});

	it("depois das 17h de 25/10 a média fica congelada nesse dia", async () => {
		await importar();
		await publicarTodas(CINCO);
		const aoVivo = await stub().listarPublico({
			agora: new Date("2026-10-26T12:00:00-03:00"),
		});
		expect(aoVivo.fase).toBe("ao_vivo");
		expect(aoVivo.media).toMatchObject({
			data: "2026-10-25",
			n: 2,
			registros: ["BR-01209/2026", "BR-08729/2026"],
		});
		const encerrada = await stub().listarPublico({
			agora: new Date("2026-10-26T12:00:00-03:00"),
			encerrada: true,
		});
		expect(encerrada.fase).toBe("encerrada");
		expect(encerrada.media?.data).toBe("2026-10-25");
	});

	it("pesquisa suspensa sai da média, da série e das publicadas", async () => {
		await importar();
		await publicarTodas(CINCO);
		await runInDurableObject(stub(), async (_inst, state) => {
			state.storage.sql.exec(
				"INSERT INTO suspensoes (registro, desde, motivo) VALUES (?, ?, ?)",
				"BR-08729/2026",
				"2026-10-15T12:00:00-03:00",
				"decisão da Justiça",
			);
		});
		const corpo = await stub().listarPublico({ agora: AGORA_15_10 });
		expect(corpo.publicadas.map((p) => p.registro)).not.toContain("BR-08729/2026");
		expect(corpo.media).toEqual({
			data: "2026-10-15",
			vf: 51.99,
			vl: 48.01,
			v: 3.99,
			n: 3,
			margem: 1.6,
			registros: ["BR-02949/2026", "BR-03663/2026", "BR-01209/2026"],
		});
		expect(corpo.serieMedia.map((p) => p.data)).not.toContain("2026-10-13");
	});

	it("GET /api/pesquisas inclui a fase no JSON", async () => {
		await importar();
		const res = await fetchWorker(new Request("http://presidente2026.test/api/pesquisas"));
		expect(res.status).toBe(200);
		const corpo = (await res.json()) as PayloadPesquisas;
		expect(["pesquisas", "ao_vivo", "encerrada"]).toContain(corpo.fase);
		expect(corpo.media).toBeNull();
		expect(corpo.serieMedia).toEqual([]);
	});
});
