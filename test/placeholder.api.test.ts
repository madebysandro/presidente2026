/**
 * Aceite #7 (CSP, sem Tela 2) e #10 (topo da fase pesquisas no lugar do placeholder).
 */
import { describe, expect, it } from "vitest";
import dia0ContratanteUrl from "../fixtures/pesquisas-tse/fixture_dia0_contratante.zip?inline";
import dia0PesquisaUrl from "../fixtures/pesquisas-tse/fixture_dia0_pesquisa.zip?inline";
import { bytesDeDataUrl, instalarCdnPesquisas } from "./helpers/cdn-pesquisas";
import { fetchWorker } from "./helpers/fetch-worker";

describe("Página pública (#7, #10)", () => {
	it("serve o topo das pesquisas com CSP e nosniff, sem Tela 2", async () => {
		instalarCdnPesquisas({
			pesquisa: bytesDeDataUrl(dia0PesquisaUrl),
			contratante: bytesDeDataUrl(dia0ContratanteUrl),
			etagPesquisa: '"dia0-pesquisa"',
			etagContratante: '"dia0-contratante"',
			condicional304: false,
		});
		const res = await fetchWorker(new Request("http://presidente2026.test/"));
		expect(res.status).toBe(200);
		expect(res.headers.get("content-type") ?? "").toMatch(/text\/html/);
		const html = await res.text();
		expect(html).toMatch(/Presidente 2026, 2º turno/);
		expect(html).toContain("até a votação");
		expect(html).not.toMatch(/undefined|NaN/);
		expect(html).not.toMatch(/Em breve/);
		expect(html).not.toMatch(/tela.?2|proporcionais|Governador|Pará/i);
		const csp = res.headers.get("content-security-policy") ?? "";
		expect(csp).toMatch(/default-src 'self'/);
		expect(csp).toMatch(/frame-ancestors 'none'/);
		expect(csp).toMatch(/img-src 'self' https:\/\/resultados\.tse\.jus\.br/);
		expect(res.headers.get("x-content-type-options")).toBe("nosniff");
	});

	it("GET / responde com cache-control no-cache (#62)", async () => {
		instalarCdnPesquisas({
			pesquisa: bytesDeDataUrl(dia0PesquisaUrl),
			contratante: bytesDeDataUrl(dia0ContratanteUrl),
			etagPesquisa: '"dia0-pesquisa"',
			etagContratante: '"dia0-contratante"',
			condicional304: false,
		});
		const res = await fetchWorker(new Request("http://presidente2026.test/"));
		expect(res.status).toBe(200);
		expect(res.headers.get("content-type") ?? "").toMatch(/text\/html/);
		expect(res.headers.get("cache-control")).toBe("no-cache");
	});

	it("GET /api/tela2 devolve 404 JSON (não HTML)", async () => {
		const res = await fetchWorker(
			new Request("http://presidente2026.test/api/tela2", {
				headers: { accept: "text/html" },
			}),
		);
		expect(res.status).toBe(404);
		expect(res.headers.get("content-type") ?? "").toMatch(/application\/json/);
		await expect(res.json()).resolves.toEqual({ error: "não achei" });
	});
});
