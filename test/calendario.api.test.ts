/**
 * Aceite #11: suspensa some de publicadas, calendário, média e vêm aí.
 * Ambígua e estadual não entram no calendário.
 */
import { runInDurableObject } from "cloudflare:test";
import { env } from "cloudflare:workers";
import { http, HttpResponse } from "msw";
import { beforeEach, describe, expect, it } from "vitest";
import dia0ContratanteUrl from "../fixtures/pesquisas-tse/fixture_dia0_contratante.zip?inline";
import dia0PesquisaUrl from "../fixtures/pesquisas-tse/fixture_dia0_pesquisa.zip?inline";
import { documentoPesquisas } from "../src/pagina/documento";
import type { Pesquisas } from "../src/pesquisas/pesquisas";
import type { Changeset } from "../src/pesquisas/tipos";
import { bytesDeDataUrl, instalarCdnPesquisas } from "./helpers/cdn-pesquisas";
import { fetchWorker } from "./helpers/fetch-worker";
import { network } from "./helpers/rede";

const CHAVE = "teste-chave-agente";
const AGORA = new Date("2026-10-15T18:00:00-03:00");

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

async function importar(): Promise<Changeset> {
	instalarCdnPesquisas({
		pesquisa: dia0Pesquisa,
		contratante: dia0Contratante,
		etagPesquisa: '"dia0-pesquisa"',
		etagContratante: '"dia0-contratante"',
		condicional304: false,
	});
	return stub().importarDoTse({ motivo: "teste" });
}

function publicar(semente: Semente, ip: string) {
	network.use(http.get(semente.fonte, () => HttpResponse.html(semente.html)));
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

function inserirForaDoNacional(): Promise<void> {
	return runInDurableObject(stub(), async (_inst, state) => {
		state.storage.sql.exec(
			`INSERT INTO registros (
				registro, cnpj, instituto, contratantes_json, campo_inicio, campo_fim,
				liberacao, liberacao_efetiva, entrevistas, margem, confianca, classificacao, removido_do_tse
			) VALUES (?, '1', ?, '["x"]', '2026-10-10', '2026-10-12', '2026-10-12', '2026-10-12', 800, 2, 95, ?, 0)`,
			"BR-EST/2026",
			"Instituto Estadual",
			"estadual",
		);
		state.storage.sql.exec(
			`INSERT INTO registros (
				registro, cnpj, instituto, contratantes_json, campo_inicio, campo_fim,
				liberacao, liberacao_efetiva, entrevistas, margem, confianca, classificacao, removido_do_tse
			) VALUES (?, '1', ?, '["x"]', '2026-10-10', '2026-10-12', '2026-10-12', '2026-10-12', 800, 2, 95, ?, 0)`,
			"BR-AMB/2026",
			"Instituto Ambíguo",
			"ambigua",
		);
	});
}

beforeEach(async () => {
	await limpar();
});

describe("suspensa e fora do nacional no calendário (#11)", () => {
	it("pesquisa suspensa some de publicadas, vêm aí, média e do calendário", async () => {
		const changeset = await importar();
		expect(changeset.kind).toBe("aplicar");
		if (changeset.kind !== "aplicar") return;
		const estadual = changeset.upserts.find((registro) => registro.classificacao === "estadual");
		expect(estadual).toBeTruthy();
		await inserirForaDoNacional();
		for (const [i, semente] of CINCO.entries()) {
			const res = await publicar(semente, `203.0.113.${70 + i}`);
			expect(res.status, semente.registro).toBe(201);
		}
		await runInDurableObject(stub(), async (_inst, state) => {
			state.storage.sql.exec(
				"INSERT INTO suspensoes (registro, desde, motivo) VALUES (?, ?, ?)",
				"BR-08729/2026",
				"2026-10-15T12:00:00-03:00",
				"decisão da Justiça",
			);
			state.storage.sql.exec(
				"INSERT INTO suspensoes (registro, desde, motivo) VALUES (?, ?, ?)",
				"BR-00652/2026",
				"2026-10-15T12:00:00-03:00",
				"decisão da Justiça",
			);
		});

		const corpo = await stub().listarPublico({ agora: AGORA });
		const ids = [
			...corpo.publicadas,
			...corpo.liberadasSemNumero,
			...corpo.vemAi,
		].map((item) => item.registro);
		expect(ids).not.toContain("BR-08729/2026");
		expect(ids).not.toContain("BR-00652/2026");
		expect(ids).not.toContain("BR-EST/2026");
		expect(ids).not.toContain("BR-AMB/2026");
		expect(ids).not.toContain(estadual!.registro);
		expect(corpo.publicadas.map((item) => item.registro)).toContain("BR-02949/2026");
		expect(corpo.vemAi.map((item) => item.registro)).toContain("BR-00820/2026");
		expect(corpo.media?.registros).not.toContain("BR-08729/2026");
		expect(corpo.media?.n).toBe(3);

		const html = documentoPesquisas(corpo, AGORA);
		expect(html).toContain("BR-02949/2026");
		expect(html).toContain("BR-00820/2026");
		expect(html).toContain('class="a-vem');
		expect(html).not.toContain("BR-08729/2026");
		expect(html).not.toContain("BR-00652/2026");
		expect(html).not.toContain("BR-EST/2026");
		expect(html).not.toContain("BR-AMB/2026");
		expect(html).not.toContain("Instituto Estadual");
		expect(html).not.toContain("Instituto Ambíguo");
		expect(html).not.toContain(estadual!.registro);
		expect(html).not.toMatch(/undefined|NaN/);
	});
});
