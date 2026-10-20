/**
 * Gráfico de duas linhas de intenção a partir das pesquisas publicadas.
 * Seam: htmlVantagem e o documento da página.
 */
import { env } from "cloudflare:workers";
import { describe, expect, it } from "vitest";
import { documentoPesquisas } from "../src/pagina/documento";
import { htmlVantagem } from "../src/pagina/grafico";
import type { PayloadPesquisas, PesquisaPublicada, PontoSerieMedia } from "../src/pesquisas/tipos";

const AGORA = new Date("2026-10-15T18:00:00-03:00");

function publicada(
	parcial: Pick<
		PesquisaPublicada,
		"registro" | "cnpj" | "instituto" | "campoInicio" | "campoFim" | "vf" | "vl" | "v"
	> &
		Partial<PesquisaPublicada>,
): PesquisaPublicada {
	return {
		contratantes: ["recursos próprios"],
		liberacao: parcial.campoFim,
		liberacaoEfetiva: parcial.campoFim,
		entrevistas: 2000,
		margem: 2,
		confianca: 95,
		totais: { flavio: 50, lula: 50, brancoNulo: 0, naoSabe: 0, brancoNuloNaoSabe: null },
		validosPublicados: null,
		fonte: "https://www.poder360.com.br/pesquisa",
		cadastradoEm: "2026-10-15T12:00:00.000Z",
		substituidoEm: null,
		...parcial,
	};
}

function payload(extra: Partial<PayloadPesquisas> = {}): PayloadPesquisas {
	return {
		hoje: "2026-10-15",
		fase: "pesquisas",
		atualizadoEm: "2026-10-15T21:00:00.000Z",
		registroTse: { geradoEm: null, etag: null },
		media: null,
		serieMedia: [],
		publicadas: [],
		liberadasSemNumero: [],
		vemAi: [],
		...extra,
	};
}

const DATAFOLHA = publicada({
	registro: "BR-02949/2026",
	cnpj: "60701190000104",
	instituto: "Datafolha",
	contratantes: ["Folha de S.Paulo", "TV Globo"],
	campoInicio: "2026-10-06",
	campoFim: "2026-10-08",
	liberacaoEfetiva: "2026-10-08",
	entrevistas: 2520,
	margem: 2,
	confianca: 95,
	totais: { flavio: 49, lula: 45, brancoNulo: 5, naoSabe: 1, brancoNuloNaoSabe: null },
	validosPublicados: { flavio: 52, lula: 48 },
	vf: 52.13,
	vl: 47.87,
	v: 4.26,
	fonte: "https://www.metropoles.com/brasil/datafolha-08",
});

const DATAFOLHA_2 = publicada({
	registro: "BR-04000/2026",
	cnpj: "60701190000104",
	instituto: "Datafolha",
	campoInicio: "2026-10-10",
	campoFim: "2026-10-12",
	vf: 51.2,
	vl: 48.8,
	v: 2.4,
});

const ATLAS = publicada({
	registro: "BR-03663/2026",
	cnpj: "33111222000155",
	instituto: "AtlasIntel",
	campoInicio: "2026-10-03",
	campoFim: "2026-10-09",
	entrevistas: 5000,
	margem: 1,
	confianca: 95,
	totais: { flavio: 45, lula: 51, brancoNulo: null, naoSabe: null, brancoNuloNaoSabe: 4 },
	vf: 46.88,
	vl: 53.12,
	v: -6.24,
	fonte: "https://www.poder360.com.br/atlas",
});

const SERIE: PontoSerieMedia[] = [
	{ data: "2026-10-08", vf: 52.13, v: 4.26, n: 1 },
	{ data: "2026-10-12", vf: 51.7, v: 3.4, n: 2 },
];

function pagina(): string {
	return documentoPesquisas(
		payload({
			publicadas: [ATLAS, DATAFOLHA, DATAFOLHA_2],
			serieMedia: SERIE,
		}),
		AGORA,
	);
}

function pontos(html: string): string[] {
	return html.match(/<span class="t-pt[\s\S]*?<\/span>/g) ?? [];
}

function attr(tag: string, nome: string): string {
	return tag.match(new RegExp(`\\s${nome}="([^"]*)"`))?.[1] ?? "";
}

describe("gráfico de duas linhas de intenção", () => {
	it("mostra um ponto de cada candidato e a média dia a dia até hoje", () => {
		const html = pagina();
		expect(html).toContain("Lula × Flávio, pesquisa a pesquisa");
		expect(html).toContain("faixa = margem de erro média");
		expect(html).toContain(">hoje<");
		expect(html).toContain('class="t-cinq"');
		expect(html).toContain("Toque num ponto para ver os números.");

		const lista = pontos(html);
		expect(lista).toHaveLength(6);
		const flavio = lista.filter((tag) => tag.includes("lado-f"));
		const lula = lista.filter((tag) => tag.includes("lado-l"));
		expect(flavio).toHaveLength(3);
		expect(lula).toHaveLength(3);
		expect(flavio.map((tag) => attr(tag, "data-registro")).sort()).toEqual([
			"BR-02949/2026",
			"BR-03663/2026",
			"BR-04000/2026",
		]);

		const mediaF = html.match(/<polyline class="t-media t-media-f"[^>]*>/)?.[0] ?? "";
		const mediaL = html.match(/<polyline class="t-media t-media-l"[^>]*>/)?.[0] ?? "";
		expect(mediaF).toContain('stroke-width="3.5"');
		expect(mediaF).toContain(
			'data-vf="52.13 49.5 49.5 49.5 48.44 48.44 48.44 48.44"',
		);
		expect(mediaL).toContain(
			'data-vl="47.87 50.5 50.5 50.5 51.56 51.56 51.56 51.56"',
		);
		expect(html).toContain("Flávio 48,4%");
		expect(html).toContain("Lula 51,6%");
		expect(html).toContain('class="t-faixa t-faixa-f"');
		expect(html).toContain('class="t-faixa t-faixa-l"');
		expect(html).not.toContain("BR-08729/2026");
		expect(html).not.toContain("BR-09623/2026");
		expect(html).not.toMatch(/undefined|NaN/);

		const datafolhaF = flavio.find((tag) => attr(tag, "data-registro") === "BR-02949/2026") ?? "";
		const datafolhaL = lula.find((tag) => attr(tag, "data-registro") === "BR-02949/2026") ?? "";
		expect(attr(datafolhaF, "data-x")).toBe(attr(datafolhaL, "data-x"));
		expect(Number(attr(datafolhaF, "data-y"))).toBeLessThan(Number(attr(datafolhaL, "data-y")));
		expect(html).toContain(">06/10<");
		expect(html).toContain('class="t-dia t-dia-miudo"');
		expect(html).toContain('style="left:81.82%">hoje');
	});

	it("desligar um instituto tira os pontos dele e recalcula a média", () => {
		const base = payload({
			publicadas: [ATLAS, DATAFOLHA, DATAFOLHA_2],
			serieMedia: SERIE,
		});
		const html = htmlVantagem(base, new Set([DATAFOLHA.cnpj]));
		const lista = pontos(html);
		expect(lista).toHaveLength(2);
		expect(lista.every((tag) => attr(tag, "data-cnpj") === ATLAS.cnpj)).toBe(true);
		expect(html).toContain("BR-02949/2026");
		expect(html).toContain("BR-04000/2026");

		const mediaF = html.match(/<polyline class="t-media t-media-f"[^>]*>/)?.[0] ?? "";
		expect(mediaF).toContain('data-vf="46.88 46.88 46.88 46.88 46.88 46.88 46.88"');
		expect(html).toContain("Flávio 46,9%");
		expect(html).toContain("Lula 53,1%");
		expect(html).toContain(`data-cnpj="${DATAFOLHA.cnpj}" aria-pressed="false"`);
		expect(html).toContain(`data-cnpj="${ATLAS.cnpj}" aria-pressed="true"`);
		expect(html).toContain("Datafolha");
		expect(html).toContain("AtlasIntel");
	});

	it("o ponto traz instituto, data, os dois percentuais e a margem", () => {
		const html = pagina();
		const datafolha = pontos(html).find((tag) => attr(tag, "data-registro") === "BR-02949/2026") ?? "";
		const rotulo = attr(datafolha, "aria-label");
		expect(rotulo).toContain("Datafolha, 08/10");
		expect(rotulo).toContain("Flávio 52,1%");
		expect(rotulo).toContain("Lula 47,9%");
		expect(rotulo).toContain("Margem ±2,0");
		expect(attr(datafolha, "data-instituto")).toBe("Datafolha");
		expect(attr(datafolha, "data-quando")).toBe("08/10");

		const atlas = pontos(html).find((tag) => attr(tag, "data-registro") === "BR-03663/2026") ?? "";
		expect(attr(atlas, "aria-label")).toContain("Margem ±1,0");
		expect(attr(atlas, "aria-label")).toContain("Flávio 46,9%");
		expect(attr(atlas, "aria-label")).toContain("Lula 53,1%");
	});

	it("registro ausente das publicadas não entra no gráfico nem no JSON do recálculo", () => {
		const html = pagina();
		const grafico = html.slice(html.indexOf('class="a-tend"'), html.indexOf('class="a-calc"'));
		expect(grafico).not.toContain("BR-08729/2026");
		expect(grafico).toContain('id="a-intencao-dados"');
		expect(grafico).toContain("BR-02949/2026");
		expect(grafico).toContain('"flavio":49');
		expect(grafico).toContain("2026-10-13");
	});

	it("sem pesquisas publicadas não desenha ponto nem NaN", () => {
		const html = htmlVantagem(payload());
		expect(pontos(html)).toHaveLength(0);
		expect(html).toContain("Ainda não há pesquisas publicadas neste gráfico.");
		expect(html).not.toMatch(/undefined|NaN/);
	});

	it("a seção Como calculamos deixa explícitos os 14 dias e que não é previsão", () => {
		const html = pagina();
		expect(html).toContain(">Como calculamos<");
		expect(html).toContain("últimos 14 dias");
		expect(html).toContain("média simples");
		expect(html).toContain("votos válidos, calculados a partir dos votos totais");
		expect(html).toContain("não prevê o resultado");
	});

	it("o rodapé cita o TSE e liga os dados abertos e o PesqEle", () => {
		const html = pagina();
		expect(html).toContain("Tribunal Superior Eleitoral");
		expect(html).toContain(
			'href="https://dadosabertos.tse.jus.br/dataset/pesquisas-eleitorais-2026"',
		);
		expect(html).toContain(">dados abertos</a>");
		expect(html).toContain(
			'href="https://pesqele-divulgacao.tse.jus.br/app/pesquisa/listar.xhtml"',
		);
		expect(html).toContain(">PesqEle</a>");
		expect(html).toContain("/js/grafico.js");
	});

	it("a página não oferece enquete nem vote aqui", () => {
		const html = pagina().toLowerCase();
		expect(html).not.toContain("enquete");
		expect(html).not.toContain("vote aqui");
		expect(html).not.toContain("vote agora");
	});

	it("em 390 px o bloco cabe na coluna e o navegador lembra o instituto desligado", async () => {
		const cssRes = await env.ASSETS.fetch("https://presidente2026.test/css/tres-semanas.css");
		expect(cssRes.status).toBe(200);
		const css = await cssRes.text();
		expect(css).toMatch(/overflow-x:\s*clip/);
		expect(css).toMatch(/\.a-plot[^{]*\{[^}]*minmax\(0,\s*1fr\)/);
		expect(css).toMatch(/\.a-chips[^{]*\{[^}]*flex-wrap:\s*wrap/);
		expect(css).toMatch(/\.a-area svg[^{]*\{[^}]*width:\s*100%/);
		expect(css).toMatch(/\.t-pt\.lado-f[^{]*\{[^}]*var\(--f\)/);
		expect(css).toMatch(/\.t-pt\.lado-l[^{]*\{[^}]*var\(--l\)/);
		expect(css).toMatch(/\.t-media-f[^{]*\{[^}]*stroke:\s*var\(--f\)/);
		expect(css).toMatch(/\.t-media-l[^{]*\{[^}]*stroke:\s*var\(--l\)/);
		expect(css).toMatch(/\.t-dia-miudo[^{]*\{[^}]*display:\s*none/);
		expect(css).toMatch(/\.t-cinq[^{]*\{[^}]*dashed/);

		const jsRes = await env.ASSETS.fetch("https://presidente2026.test/js/grafico.js");
		expect(jsRes.status).toBe(200);
		const js = await jsRes.text();
		expect(js).toContain("pesq-desligados");
		expect(js).toContain("localStorage.getItem");
		expect(js).toContain("localStorage.setItem");
		expect(js).toMatch(/try\s*\{/);
		expect(js).toContain("catch");
		expect(js).toContain("serieIntencao");
		expect(js).not.toContain("innerHTML");
		expect(pagina()).toContain('type="module" src="/js/grafico.js"');
	});
});
