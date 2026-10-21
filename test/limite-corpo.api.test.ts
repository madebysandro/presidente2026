/**
 * Seam: POST /api/import, POST /api/agente/resultados, POST|DELETE /api/agente/suspensoes.
 */
import { env } from "cloudflare:workers";
import { runInDurableObject } from "cloudflare:test";
import { beforeEach, describe, expect, it } from "vitest";
import type { Pesquisas } from "../src/pesquisas/pesquisas";
import { fetchWorker } from "./helpers/fetch-worker";

const CHAVE_AGENTE = "teste-chave-agente";
const CHAVE_IMPORT = "teste-chave-import";
const TETO_AGENTE = 32 * 1024;
const TETO_IMPORT = 1_000_000;
const MARCADOR = "MARCADOR-NAO-GRAVAR";

function stub(): DurableObjectStub<Pesquisas> {
	return env.PESQUISAS.getByName("singleton") as DurableObjectStub<Pesquisas>;
}

beforeEach(async () => {
	await runInDurableObject(stub(), async (_inst, state) => {
		await state.storage.deleteAll();
	});
});

function fluxo(bytes: Uint8Array): ReadableStream<Uint8Array> {
	return new ReadableStream({
		start(controller) {
			controller.enqueue(bytes);
			controller.close();
		},
	});
}

function pedido(
	method: string,
	caminho: string,
	init: { bytes: Uint8Array; contentLength?: string | null; chave?: string | null; ip?: string },
): Request {
	const headers = new Headers({ "content-type": "application/json" });
	if (init.contentLength !== null) headers.set("content-length", init.contentLength ?? String(init.bytes.byteLength));
	if (init.chave) headers.set("authorization", `Bearer ${init.chave}`);
	if (init.ip) headers.set("cf-connecting-ip", init.ip);
	return new Request(`http://presidente2026.test${caminho}`, {
		method,
		headers,
		body: fluxo(init.bytes),
	});
}

const ROTAS = [
	{ method: "POST", caminho: "/api/import", teto: TETO_IMPORT, chave: CHAVE_IMPORT },
	{ method: "POST", caminho: "/api/agente/resultados", teto: TETO_AGENTE, chave: CHAVE_AGENTE },
	{ method: "POST", caminho: "/api/agente/suspensoes", teto: TETO_AGENTE, chave: CHAVE_AGENTE },
	{
		method: "DELETE",
		caminho: "/api/agente/suspensoes/BR-02949/2026",
		teto: TETO_AGENTE,
		chave: CHAVE_AGENTE,
	},
] as const;

describe("teto do corpo", () => {
	it("recusa 411 quando falta Content-Length", async () => {
		const bytes = new TextEncoder().encode(`{"m":"${MARCADOR}"}`);
		for (const rota of ROTAS) {
			const res = await fetchWorker(
				pedido(rota.method, rota.caminho, {
					bytes,
					contentLength: null,
					chave: rota.chave,
					ip: "203.0.113.201",
				}),
			);
			expect(res.status, rota.caminho).toBe(411);
			await expect(res.json()).resolves.toEqual({ erro: "content_length" });
		}
		const auditoria = await stub().listarAuditoriaAgente();
		expect(auditoria.every((entrada) => !entrada.corpo.includes(MARCADOR))).toBe(true);
	});

	it("recusa 413 quando o corpo passa do que o Content-Length declarou", async () => {
		const bytes = new TextEncoder().encode(`{"m":"${MARCADOR}-MENTIRA"}`);
		for (const rota of ROTAS) {
			const res = await fetchWorker(
				pedido(rota.method, rota.caminho, {
					bytes,
					contentLength: "1",
					chave: rota.chave,
					ip: "203.0.113.202",
				}),
			);
			expect(res.status, rota.caminho).toBe(413);
			await expect(res.json()).resolves.toEqual({ erro: "tamanho" });
		}
		const auditoria = await stub().listarAuditoriaAgente();
		expect(auditoria.every((entrada) => !entrada.corpo.includes(MARCADOR))).toBe(true);
	});

	it("recusa 413 quando o Content-Length passa do teto", async () => {
		const bytes = new Uint8Array([1]);
		for (const rota of ROTAS) {
			const res = await fetchWorker(
				pedido(rota.method, rota.caminho, {
					bytes,
					contentLength: String(rota.teto + 1),
					chave: rota.chave,
					ip: "203.0.113.203",
				}),
			);
			expect(res.status, rota.caminho).toBe(413);
			await expect(res.json()).resolves.toEqual({ erro: "tamanho" });
		}
	});
});

describe("401 e 429 sem corpo", () => {
	it("401 grava motivo e IP e não grava o corpo", async () => {
		const casos = [
			{ method: "POST", caminho: "/api/agente/resultados", ip: "203.0.113.211" },
			{ method: "POST", caminho: "/api/agente/suspensoes", ip: "203.0.113.212" },
			{ method: "DELETE", caminho: "/api/agente/suspensoes/BR-02949/2026", ip: "203.0.113.213" },
			{ method: "POST", caminho: "/api/import", ip: "203.0.113.214" },
		];
		for (const caso of casos) {
			const bytes = new TextEncoder().encode(`{"m":"${MARCADOR}","ip":"${caso.ip}"}`);
			const res = await fetchWorker(
				pedido(caso.method, caso.caminho, { bytes, chave: null, ip: caso.ip }),
			);
			expect(res.status, caso.caminho).toBe(401);
			await expect(res.json()).resolves.toEqual({ erro: "nao_autorizado" });
		}
		const auditoria = await stub().listarAuditoriaAgente();
		expect(auditoria).toHaveLength(casos.length);
		for (const caso of casos) {
			const entrada = auditoria.find((item) => item.ip === caso.ip);
			expect(entrada, caso.caminho).toMatchObject({
				status: 401,
				corpo: "",
				chaveValida: false,
				motivos: ["nao_autorizado"],
			});
		}
		expect(auditoria.every((entrada) => !entrada.corpo.includes(MARCADOR))).toBe(true);
	});

	it("POST /api/import usa o balde de 5 por IP e o 429 não grava o corpo", async () => {
		const ip = "203.0.113.220";
		for (let i = 0; i < 4; i++) {
			const res = await fetchWorker(
				new Request("http://presidente2026.test/api/agente", {
					headers: { "cf-connecting-ip": ip },
				}),
			);
			expect(res.status).toBe(200);
		}
		const bytes = new TextEncoder().encode(`{"m":"${MARCADOR}-429"}`);
		const quinta = await fetchWorker(
			pedido("POST", "/api/import", { bytes, chave: null, ip }),
		);
		expect(quinta.status).toBe(401);
		const sexta = await fetchWorker(
			pedido("POST", "/api/import", { bytes, chave: null, ip }),
		);
		expect(sexta.status).toBe(429);
		expect(sexta.headers.get("retry-after")).toBe("60");
		await expect(sexta.json()).resolves.toEqual({ erro: "limite" });
		const auditoria = await stub().listarAuditoriaAgente();
		const negadas = auditoria.filter((entrada) => entrada.rota === "/api/import");
		expect(negadas.map((entrada) => entrada.status)).toEqual([401, 429]);
		expect(negadas.every((entrada) => entrada.corpo === "" && entrada.ip === ip)).toBe(true);
		expect(negadas.find((entrada) => entrada.status === 429)?.motivos).toEqual(["limite"]);
		expect(auditoria.every((entrada) => !entrada.corpo.includes(MARCADOR))).toBe(true);
	});
});
