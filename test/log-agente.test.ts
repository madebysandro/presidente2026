import { describe, expect, it } from "vitest";
import { eventoAgente } from "../src/pesquisas/pedido-agente";

const BASE = "https://presidente2026.win";

describe("evento de log do agente", () => {
	it("leva método, rota sem query e status", () => {
		expect(
			eventoAgente({ method: "GET", url: `${BASE}/api/agente/auditoria?desde=2026-10-01&limite=50` }, 200),
		).toEqual({ evento: "agente", metodo: "GET", rota: "/api/agente/auditoria", status: 200 });
	});

	it("troca o registro da suspensão pelo parâmetro do template", () => {
		expect(
			eventoAgente({ method: "DELETE", url: `${BASE}/api/agente/suspensoes/BR-01234%2F2026` }, 401),
		).toEqual({
			evento: "agente",
			metodo: "DELETE",
			rota: "/api/agente/suspensoes/:registro",
			status: 401,
		});
	});

	it("a raiz e as coleções ficam como estão", () => {
		expect(eventoAgente({ method: "GET", url: `${BASE}/api/agente` }, 429).rota).toBe("/api/agente");
		expect(eventoAgente({ method: "POST", url: `${BASE}/api/agente/suspensoes` }, 201).rota).toBe(
			"/api/agente/suspensoes",
		);
	});

	it("não carrega bearer, IP, query nem corpo do pedido", () => {
		const bearer = "chave-secreta-do-agente-123";
		const ip = "203.0.113.77";
		const pedido = new Request(`${BASE}/api/agente/resultados?token=${bearer}`, {
			method: "POST",
			headers: { authorization: `Bearer ${bearer}`, "cf-connecting-ip": ip },
			body: JSON.stringify({ registro: "BR-09999/2026", ip }),
		});
		const texto = JSON.stringify(eventoAgente(pedido, 201));
		expect(texto).not.toContain(bearer);
		expect(texto).not.toContain(ip);
		expect(texto).not.toContain("token");
		expect(texto).not.toContain("BR-09999");
	});
});
