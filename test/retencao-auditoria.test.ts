/**
 * Aceite #23: a auditoria do agente não tem prazo de apagar antes de 31/12/2026.
 * Seam: fimRetencaoAuditoria — a data que o código e a nota de operação usam.
 */
import { describe, expect, it } from "vitest";
import { fimRetencaoAuditoria } from "../src/pesquisas/retencao";

describe("retenção da auditoria (#23)", () => {
	it("guarda até o fim de 31/12/2026 em Brasília e libera o dia seguinte", () => {
		expect(fimRetencaoAuditoria().toISOString()).toBe("2027-01-01T02:59:59.999Z");
		const antes = new Date("2026-12-31T23:00:00-03:00");
		const depois = new Date("2027-01-01T00:00:00-03:00");
		expect(antes.getTime()).toBeLessThanOrEqual(fimRetencaoAuditoria().getTime());
		expect(depois.getTime()).toBeGreaterThan(fimRetencaoAuditoria().getTime());
	});
});
