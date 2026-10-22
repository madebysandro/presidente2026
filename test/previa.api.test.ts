/**
 * Aceite #66: GET /og.png desenha a prévia no Worker.
 * Seam: GET / e GET /og.png.
 */
import { runInDurableObject } from "cloudflare:test";
import { env } from "cloudflare:workers";
import { http, HttpResponse } from "msw";
import { beforeEach, describe, expect, it } from "vitest";
import dia0ContratanteUrl from "../fixtures/pesquisas-tse/fixture_dia0_contratante.zip?inline";
import dia0PesquisaUrl from "../fixtures/pesquisas-tse/fixture_dia0_pesquisa.zip?inline";
import type { Pesquisas } from "../src/pesquisas/pesquisas";
import { bytesDeDataUrl, instalarCdnPesquisas } from "./helpers/cdn-pesquisas";
import { fetchWorker } from "./helpers/fetch-worker";
import { network } from "./helpers/rede";

const CHAVE = "teste-chave-agente";

function stub(): DurableObjectStub<Pesquisas> {
	return env.PESQUISAS.getByName("singleton") as DurableObjectStub<Pesquisas>;
}

async function limpar(): Promise<void> {
	await runInDurableObject(stub(), async (_inst, state) => {
		await state.storage.deleteAll();
	});
}

function instalarCdn(): void {
	instalarCdnPesquisas({
		pesquisa: bytesDeDataUrl(dia0PesquisaUrl),
		contratante: bytesDeDataUrl(dia0ContratanteUrl),
		etagPesquisa: '"dia0-pesquisa"',
		etagContratante: '"dia0-contratante"',
		condicional304: false,
	});
}

function meta(html: string, nome: string): string | undefined {
	return html.match(new RegExp(`<meta property="${nome}" content="([^"]*)"`))?.[1];
}

function medidasPng(png: Uint8Array): { largura: number; altura: number } {
	const tipo = String.fromCharCode(png[12]!, png[13]!, png[14]!, png[15]!);
	expect(tipo).toBe("IHDR");
	const view = new DataView(png.buffer, png.byteOffset, png.byteLength);
	return { largura: view.getUint32(16), altura: view.getUint32(20) };
}

beforeEach(async () => {
	await limpar();
	instalarCdn();
	await stub().importarDoTse({ motivo: "teste" });
});

describe("imagem da prévia (#66)", () => {
	it("sem média, a home convida e /og.png responde 1200×630 abaixo de 300 KB", async () => {
		const html = await (await fetchWorker("http://presidente2026.test/")).text();
		expect(meta(html, "og:description")).toBe("Acompanhe as pesquisas do 2º turno");
		expect(meta(html, "og:image") ?? "").toMatch(
			/^http:\/\/presidente2026\.test\/og\.png\?v=sem-d\d+$/,
		);

		const imagem = await fetchWorker("http://presidente2026.test/og.png");
		expect(imagem.status).toBe(200);
		expect(imagem.headers.get("content-type")).toMatch(/^image\/png/);
		expect(imagem.headers.get("cache-control")).toContain("public");
		expect(imagem.headers.get("cache-control")).toContain("max-age=600");
		const bytes = new Uint8Array(await imagem.arrayBuffer());
		expect(bytes.byteLength).toBeGreaterThan(20 * 1024);
		expect(bytes.byteLength).toBeLessThan(300 * 1024);
		expect(medidasPng(bytes)).toEqual({ largura: 1200, altura: 630 });
	});

	it("com uma pesquisa publicada, a descrição acompanha a média e a segunda leitura também desenha", async () => {
		network.use(
			http.get("https://www.metropoles.com/brasil/datafolha-08", () =>
				HttpResponse.html("<p>Datafolha: Flávio 49% e Lula 45%.</p>"),
			),
		);
		const publicado = await fetchWorker(
			new Request("http://presidente2026.test/api/agente/resultados", {
				method: "POST",
				headers: {
					authorization: `Bearer ${CHAVE}`,
					"content-type": "application/json",
					"cf-connecting-ip": "203.0.113.70",
				},
				body: JSON.stringify({
					registro: "BR-00466/2026",
					totais: { flavio: 49, lula: 45, brancoNulo: 5, naoSabe: 1 },
					validosPublicados: { flavio: 52, lula: 48 },
					fonte: "https://www.metropoles.com/brasil/datafolha-08",
					margem: null,
					confianca: null,
					substituir: false,
				}),
			}),
		);
		expect(publicado.status).toBe(201);

		const html = await (await fetchWorker("http://presidente2026.test/")).text();
		expect(meta(html, "og:description")).toBe("Flávio 52,1% x Lula 47,9%");
		expect(meta(html, "og:image") ?? "").toContain("http://presidente2026.test/og.png?v=");
		expect(meta(html, "og:image") ?? "").not.toContain("sem-d");

		const primeira = await fetchWorker("http://presidente2026.test/og.png");
		const segunda = await fetchWorker("http://presidente2026.test/og.png?v=qualquer");
		expect(primeira.status).toBe(200);
		expect(segunda.status).toBe(200);
		expect(primeira.headers.get("content-type")).toMatch(/^image\/png/);
		const bytes = new Uint8Array(await segunda.arrayBuffer());
		expect(medidasPng(bytes)).toEqual({ largura: 1200, altura: 630 });
		expect(bytes.byteLength).toBeLessThan(300 * 1024);
	});
});
