/**
 * Aceite #15: o binding de Rate Limiting da plataforma entra na mesma decisão
 * que a auditoria. Sem o binding (testes), quem limita continua sendo o DO.
 */
import { describe, expect, it } from "vitest";
import { bindingDeixaPassar } from "../src/pesquisas/limite-plataforma";

describe("binding de taxa da plataforma (#15)", () => {
	it("sem binding deixa passar", async () => {
		await expect(bindingDeixaPassar(undefined, "203.0.113.8")).resolves.toBe(true);
	});

	it("binding que recusa não deixa passar", async () => {
		const binding = {
			limit: async () => ({ success: false }),
		};
		await expect(bindingDeixaPassar(binding, "203.0.113.8")).resolves.toBe(false);
	});

	it("binding que aceita deixa passar com a chave informada", async () => {
		let vista = "";
		const binding = {
			limit: async (opcoes: { key: string }) => {
				vista = opcoes.key;
				return { success: true };
			},
		};
		await expect(bindingDeixaPassar(binding, "chave")).resolves.toBe(true);
		expect(vista).toBe("chave");
	});
});
