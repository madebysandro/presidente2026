/**
 * Aceite #18: o servidor decide a fase e a página (e o fragmento) seguem.
 * Seam: GET / e GET /?fragmento=1.
 */
import { env } from "cloudflare:workers";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import brZerado from "../fixtures/tse-6258-zerado/br.json" with { type: "json" };
import dia0ContratanteUrl from "../fixtures/pesquisas-tse/fixture_dia0_contratante.zip?inline";
import dia0PesquisaUrl from "../fixtures/pesquisas-tse/fixture_dia0_pesquisa.zip?inline";
import { ABERTURA_2T_MS } from "../src/apuracao/abertura";
import { corposNoiteVirada } from "../src/apuracao/noite-sintetica";
import { bytesDeDataUrl, instalarCdnPesquisas } from "./helpers/cdn-pesquisas";
import { fetchWorker } from "./helpers/fetch-worker";
import { forcarConsulta, limparPoller, stubPoller } from "./helpers/poller";
import { instalarTseFalso } from "./helpers/tse-falso";

/** A página lê o relógio de parede: na pausa do TSE (17h30–19h de 25/10) a faixa diz Pausada (#129). */
const FAIXA_AO_VIVO = /<strong data-faixa-rotulo>(?:Ao vivo|Pausada)<\/strong>/;

function instalarCdn() {
	instalarCdnPesquisas({
		pesquisa: bytesDeDataUrl(dia0PesquisaUrl),
		contratante: bytesDeDataUrl(dia0ContratanteUrl),
		etagPesquisa: '"dia0-pesquisa"',
		etagContratante: '"dia0-contratante"',
		condicional304: false,
	});
}

async function htmlPagina(): Promise<string> {
	const resposta = await fetchWorker(new Request("http://presidente2026.test/"));
	expect(resposta.status).toBe(200);
	expect(resposta.headers.get("content-type") ?? "").toMatch(/text\/html/);
	return resposta.text();
}

describe("GET / segue a fase do servidor (#18)", () => {
	let tse: ReturnType<typeof instalarTseFalso>;

	beforeEach(() => {
		instalarCdn();
		tse = instalarTseFalso();
	});

	afterEach(async () => {
		await limparPoller();
	});

	it("antes das 17h, com o arquivo zerado, a página diz Aguardando 17h", async () => {
		tse.usarNoiteSintetica([brZerado]);
		await stubPoller().fixarAgora(ABERTURA_2T_MS - 60 * 60 * 1000);
		await forcarConsulta();
		const html = await htmlPagina();
		expect(html).toContain("Aguardando 17h");
		expect(html).toContain("arquivo zerado");
		expect(html).toContain("até a votação");
		expect(html).not.toContain("Momentos da noite");
		expect(html).not.toMatch(/undefined|NaN/);
	});

	it("ao vivo o placar é a apuração, os lados não trocam e a virada aparece", async () => {
		tse.usarNoiteSintetica(corposNoiteVirada());
		await stubPoller().fixarAgora(ABERTURA_2T_MS + 60 * 60 * 1000);
		await forcarConsulta();
		tse.avancar();
		await forcarConsulta();

		const html = await htmlPagina();
		const h1 = html.match(/<h1[\s\S]*?<\/h1>/)?.[0] ?? "";
		expect(html).toMatch(FAIXA_AO_VIVO);
		expect(h1.indexOf("Flávio")).toBeGreaterThanOrEqual(0);
		expect(h1.indexOf("Flávio")).toBeLessThan(h1.indexOf("Lula"));
		expect(h1.indexOf('data-numero="22"')).toBeLessThan(h1.indexOf('data-numero="13"'));
		const largura = Number(html.match(/class="a-cabo-f" style="width:([\d.]+)%"/)?.[1]);
		expect(largura).toBeLessThan(50);
		expect(html).not.toContain("a-cabo-margem");
		expect(html).toContain("média das pesquisas");
		expect(html).toContain("virou de Flávio para Lula");
		expect(html).toContain('class="t-virada"');
		expect(html).toContain("Momentos da noite");
		expect(html).toContain("data-estimativas");
		expect(html).toContain('aria-label="Calendário das pesquisas, última semana"');
		expect(html).not.toMatch(/http-equiv="refresh"/i);
		expect(html).not.toMatch(/undefined|NaN/);

		const fragmento = await fetchWorker(
			new Request("http://presidente2026.test/?fragmento=1"),
		);
		expect(fragmento.status).toBe(200);
		expect(fragmento.headers.get("content-type") ?? "").toMatch(/json/);
		const corpo = (await fragmento.json()) as {
			fase: string;
			miolo: string;
			faixa: string;
		};
		expect(corpo.fase).toBe("ao_vivo");
		expect(corpo.faixa).toMatch(FAIXA_AO_VIVO);
		expect(corpo.miolo).toContain("virou de Flávio para Lula");
		expect(corpo.miolo).not.toContain("<!doctype");
		expect(JSON.stringify(corpo)).not.toMatch(/undefined|NaN/);

		const js = await env.ASSETS.fetch("https://presidente2026.test/js/ao-vivo.js");
		expect(js.status).toBe(200);
		const fonte = await js.text();
		expect(fonte).toContain("fragmento=1");
		expect(fonte).toContain("trocaMiolo");
		expect(fonte).toContain(".a-pesq.sel");
		expect(fonte).not.toContain("location.reload");
		expect(fonte).not.toContain("location.href");
	});

	it("encerrada tira as estimativas e não marca outra consulta", async () => {
		tse.definirVarianteSecoes({ padrao: "100,00", tf: "s" });
		await forcarConsulta();
		const html = await htmlPagina();
		expect(html).toContain("Encerrada");
		expect(html).toContain("Resultado final · 2º turno");
		expect(html).not.toContain("Próxima consulta");
		expect(html).not.toContain("data-estimativas");
		expect(html).toContain("Rever as três semanas");
		expect(html).not.toMatch(/undefined|NaN/);
	});
});
