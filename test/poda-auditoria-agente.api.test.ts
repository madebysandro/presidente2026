/**
 * Seam: alarme do Durable Object e GET /api/agente/pendentes.
 */
import { env } from "cloudflare:workers";
import { runInDurableObject } from "cloudflare:test";
import { beforeEach, describe, expect, it } from "vitest";
import type { Pesquisas } from "../src/pesquisas/pesquisas";
import { IDADE_AUDITORIA_AGENTE_MS, TETO_LINHAS_AUDITORIA_AGENTE } from "../src/pesquisas/retencao";
import { fetchWorker } from "./helpers/fetch-worker";

function stub(): DurableObjectStub<Pesquisas> {
	return env.PESQUISAS.getByName("singleton") as DurableObjectStub<Pesquisas>;
}

beforeEach(async () => {
	await runInDurableObject(stub(), async (_inst, state) => {
		await state.storage.deleteAll();
	});
});

function inserir(state: DurableObjectState, em: string, n: number): void {
	for (let i = 0; i < n; i++) {
		state.storage.sql.exec(
			`INSERT INTO auditoria_agente (
				em, rota, metodo, ip, chave_valida, registro, corpo, status, motivos
			) VALUES (?, '/api/agente', 'GET', '203.0.113.9', 1, null, '', 200, '[]')`,
			em,
		);
	}
}

describe("poda da auditoria do agente", () => {
	it("o alarme apaga linha velha e o que passa do teto", async () => {
		await stub().obterEstado();
		const recente = new Date().toISOString();
		const velha = new Date(Date.now() - IDADE_AUDITORIA_AGENTE_MS - 86_400_000).toISOString();
		await runInDurableObject(stub(), async (_inst, state) => {
			inserir(state, recente, TETO_LINHAS_AUDITORIA_AGENTE + 3);
			inserir(state, velha, 1);
		});
		await runInDurableObject(stub(), async (inst) => {
			await inst.alarm();
		});
		const linhas = await stub().listarAuditoriaAgente();
		expect(linhas).toHaveLength(TETO_LINHAS_AUDITORIA_AGENTE);
		expect(linhas.every((linha) => linha.em === recente)).toBe(true);
	});

	it("a escrita apaga a linha que já passou da idade", async () => {
		await stub().obterEstado();
		const velha = new Date(Date.now() - IDADE_AUDITORIA_AGENTE_MS - 86_400_000).toISOString();
		await runInDurableObject(stub(), async (_inst, state) => {
			inserir(state, velha, 1);
		});
		const res = await fetchWorker(
			new Request("http://presidente2026.test/api/agente/pendentes", {
				headers: { "cf-connecting-ip": "203.0.113.231" },
			}),
		);
		expect(res.status).toBe(401);
		const linhas = await stub().listarAuditoriaAgente();
		expect(linhas.map((linha) => linha.em)).not.toContain(velha);
		expect(linhas).toHaveLength(1);
		expect(linhas[0]).toMatchObject({ status: 401, corpo: "", ip: "203.0.113.231" });
	});
});
