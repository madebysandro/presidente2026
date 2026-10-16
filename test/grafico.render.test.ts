/**
 * Aceite #12: gráfico da vantagem a partir do JSON (série + filtros).
 * Seam: htmlVantagem e o documento da página, sem olhar geometria interna.
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

describe("gráfico da vantagem a partir do JSON (#12)", () => {
	it("mostra a linha da média e um ponto por pesquisa na cor do líder daquela pesquisa", () => {
		const html = pagina();
		const lista = pontos(html);
		expect(lista).toHaveLength(3);

		const porRegistro = new Map(lista.map((tag) => [attr(tag, "data-registro"), tag]));
		expect([...porRegistro.keys()].sort()).toEqual([
			"BR-02949/2026",
			"BR-03663/2026",
			"BR-04000/2026",
		]);
		expect(porRegistro.get("BR-02949/2026")).toContain("lado-f");
		expect(porRegistro.get("BR-04000/2026")).toContain("lado-f");
		expect(porRegistro.get("BR-03663/2026")).toContain("lado-l");
		expect(porRegistro.get("BR-03663/2026")).not.toContain("lado-f");

		const media = html.match(/<path class="t-media"[^>]*>/)?.[0] ?? "";
		expect(media).toContain('stroke-width="3"');
		expect(media).toContain('data-datas="2026-10-08 2026-10-12"');
		expect(html).toContain("média Flávio +3,4");
		expect(html).toContain("Flávio +");
		expect(html).toContain(">empate<");
		expect(html).toContain("Lula +");
		expect(html).toContain(">hoje<");
		expect(html).not.toContain("BR-08729/2026");
		expect(html).not.toMatch(/undefined|NaN/);

		const flavio = porRegistro.get("BR-02949/2026") ?? "";
		const lula = porRegistro.get("BR-03663/2026") ?? "";
		expect(Number(attr(flavio, "data-y"))).toBeLessThan(Number(attr(lula, "data-y")));
		expect(Number(attr(flavio, "data-x"))).toBeLessThan(
			Number(attr(porRegistro.get("BR-04000/2026") ?? "", "data-x")),
		);
	});

	it("desligar um instituto esconde só os pontos e a linha dele, sem apagar o resto", () => {
		const base = payload({
			publicadas: [ATLAS, DATAFOLHA, DATAFOLHA_2],
			serieMedia: SERIE,
		});
		const html = htmlVantagem(base, new Set([DATAFOLHA.cnpj]));
		const lista = pontos(html);
		expect(lista).toHaveLength(3);

		const doInstituto = lista.filter((tag) => attr(tag, "data-cnpj") === DATAFOLHA.cnpj);
		const outros = lista.filter((tag) => attr(tag, "data-cnpj") !== DATAFOLHA.cnpj);
		expect(doInstituto).toHaveLength(2);
		expect(outros).toHaveLength(1);
		for (const tag of doInstituto) expect(tag).toContain(" off");
		expect(outros[0]).not.toContain(" off");

		const linha = html.match(/<path class="t-inst[^"]*"[^>]*>/)?.[0] ?? "";
		expect(linha).toContain(`data-cnpj="${DATAFOLHA.cnpj}"`);
		expect(linha).toContain(" off");
		expect(html.match(/<path class="t-inst/g)).toHaveLength(1);
		expect(html.match(/<path class="t-media"[^>]*>/)?.[0] ?? "").not.toContain(" off");

		expect(html).toContain(`data-cnpj="${DATAFOLHA.cnpj}" aria-pressed="false"`);
		expect(html).toContain(`data-cnpj="${ATLAS.cnpj}" aria-pressed="true"`);
		expect(html).toContain("Datafolha");
		expect(html).toContain("AtlasIntel");
	});

	it("o ponto traz os números e a ficha no title", () => {
		const html = pagina();
		const datafolha = pontos(html).find((tag) => attr(tag, "data-registro") === "BR-02949/2026") ?? "";
		const title = attr(datafolha, "title");
		expect(title).toContain("campo até 08/10");
		expect(title).toContain("Flávio 52,1%");
		expect(title).toContain("Lula 47,9%");
		expect(title).toContain("Datafolha ouviu 2.520 eleitores de 06/10 a 08/10");
		expect(title).toContain("margem de erro de 2 pontos");
		expect(title).toContain("confiança de 95%");
		expect(title).toContain("Contratada por Folha de S.Paulo e TV Globo");
		expect(title).toContain("Registro no TSE BR-02949/2026");

		const atlas = pontos(html).find((tag) => attr(tag, "data-registro") === "BR-03663/2026") ?? "";
		const titleAtlas = attr(atlas, "title");
		expect(titleAtlas).toContain("1 ponto");
		expect(titleAtlas).not.toContain("1 pontos");
		expect(titleAtlas).toContain("Feita com recursos próprios");
		expect(titleAtlas).toContain("Flávio 46,9%");
		expect(titleAtlas).toContain("Lula 53,1%");
	});

	it("registro ausente do JSON não vira ponto nem data da série", () => {
		const html = pagina();
		const grafico = html.slice(html.indexOf('class="a-tend"'), html.indexOf('class="a-calc"'));
		expect(grafico).not.toContain("BR-08729/2026");
		expect(grafico).not.toContain("2026-10-13");
		expect(grafico).toContain('data-datas="2026-10-08 2026-10-12"');
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
		expect(css).toMatch(/\.a-graf[^{]*\{[^}]*minmax\(0,\s*1fr\)/);
		expect(css).toMatch(/\.a-chips[^{]*\{[^}]*flex-wrap:\s*wrap/);
		expect(css).toMatch(/\.a-plot svg[^{]*\{[^}]*width:\s*100%/);
		expect(css).toMatch(/\.t-pt\.lado-f[^{]*\{[^}]*background:\s*var\(--f\)/);
		expect(css).toMatch(/\.t-pt\.lado-l[^{]*\{[^}]*background:\s*var\(--l\)/);
		expect(css).toMatch(/opacity\s*350ms/);
		expect(css).toMatch(/\.t-media[^{]*\{[^}]*stroke:\s*var\(--tinta\)/);

		const jsRes = await env.ASSETS.fetch("https://presidente2026.test/js/grafico.js");
		expect(jsRes.status).toBe(200);
		const js = await jsRes.text();
		expect(js).toContain("pesq-desligados");
		expect(js).toContain("localStorage.getItem");
		expect(js).toContain("localStorage.setItem");
		expect(js).toMatch(/try\s*\{/);
		expect(js).toContain("catch");
		expect(js).toContain('classList.toggle("off"');
		expect(js).not.toContain("innerHTML");
		expect(js).not.toContain("grafico.innerHTML");
	});
});
