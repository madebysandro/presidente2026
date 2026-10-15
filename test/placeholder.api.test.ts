/**
 * Aceite #7: UI pública sem Tela 2 / Pará; placeholder + CSP.
 */
import { exports } from "cloudflare:workers";
import { describe, expect, it } from "vitest";

describe("Página pública placeholder (#7)", () => {
	it("serve marca + em breve com CSP base", async () => {
		const res = await exports.default.fetch(
			new Request("http://presidente2026.test/"),
		);
		expect(res.status).toBe(200);
		const html = await res.text();
		expect(html).toMatch(/Presidente 2026/);
		expect(html).toMatch(/Em breve/);
		expect(html).not.toMatch(/tela.?2|proporcionais|Governador|Pará/i);
		const csp = res.headers.get("content-security-policy") ?? "";
		expect(csp).toMatch(/default-src 'self'/);
		expect(csp).toMatch(/frame-ancestors 'none'/);
		expect(csp).toMatch(/img-src 'self' https:\/\/resultados\.tse\.jus\.br/);
	});

	it("rotas /api desconhecidas devolvem 404 curto", async () => {
		const res = await exports.default.fetch(
			new Request("http://presidente2026.test/api/tela2"),
		);
		expect(res.status).toBe(404);
		expect(await res.text()).toBe("não achei");
	});
});
