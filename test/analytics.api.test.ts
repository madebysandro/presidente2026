import { describe, expect, it } from "vitest";
import dia0ContratanteUrl from "../fixtures/pesquisas-tse/fixture_dia0_contratante.zip?inline";
import dia0PesquisaUrl from "../fixtures/pesquisas-tse/fixture_dia0_pesquisa.zip?inline";
import { bytesDeDataUrl, instalarCdnPesquisas } from "./helpers/cdn-pesquisas";
import { fetchWorker } from "./helpers/fetch-worker";

const BEACON =
	`<script defer src="https://static.cloudflareinsights.com/beacon.min.js" data-cf-beacon='{"token": "aef83da97b4846a5ae996d5d11524a11"}'></script>`;

const CSP = [
	"default-src 'self'",
	"script-src 'self' https://static.cloudflareinsights.com",
	"style-src 'self' 'unsafe-inline'",
	"img-src 'self' https://resultados.tse.jus.br",
	"media-src 'self'",
	"font-src 'self'",
	"connect-src 'self' https://cloudflareinsights.com",
	"frame-ancestors 'none'",
].join("; ");

function instalarDia0() {
	instalarCdnPesquisas({
		pesquisa: bytesDeDataUrl(dia0PesquisaUrl),
		contratante: bytesDeDataUrl(dia0ContratanteUrl),
		etagPesquisa: '"dia0-pesquisa"',
		etagContratante: '"dia0-contratante"',
		condicional304: false,
	});
}

describe("Web Analytics na página HTML", () => {
	it("inclui o beacon manual fora do miolo e a CSP só libera os hosts do beacon", async () => {
		instalarDia0();
		const res = await fetchWorker(new Request("http://presidente2026.test/"));
		expect(res.status).toBe(200);
		expect(res.headers.get("content-type") ?? "").toMatch(/text\/html/);
		const html = await res.text();
		const miolo = html.slice(
			html.indexOf('<div data-miolo>'),
			html.indexOf("</main>"),
		);
		expect(html).toContain(BEACON);
		expect(miolo).not.toContain("cloudflareinsights.com");
		expect(res.headers.get("content-security-policy")).toBe(CSP);
	});
});
