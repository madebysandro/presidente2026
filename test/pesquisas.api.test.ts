/**
 * Aceite #7: DO Pesquisas responde RPC de sanidade sem erro.
 */
import { env } from "cloudflare:workers";
import { describe, expect, it } from "vitest";
import type { Pesquisas } from "../src/pesquisas/pesquisas";

describe("DO Pesquisas — sanidade (#7)", () => {
	it("ping e obterEstado respondem sem erro", async () => {
		const stub = env.PESQUISAS.getByName(
			"singleton",
		) as DurableObjectStub<Pesquisas>;
		await expect(stub.ping()).resolves.toEqual({ ok: true });
		await expect(stub.obterEstado()).resolves.toEqual({
			pronto: true,
			registros: 0,
		});
	});
});
