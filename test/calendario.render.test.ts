/**
 * Aceite #11: calendário 05/10–25/10, três estados e ficha no detalhe.
 */
import { env } from "cloudflare:workers";
import { describe, expect, it } from "vitest";
import { documentoPesquisas } from "../src/pagina/documento";
import type { FichaPublica, PayloadPesquisas, PesquisaPublicada } from "../src/pesquisas/tipos";

const AGORA = new Date("2026-10-15T18:00:00-03:00");

function diasRetaFinal(): string[] {
	const inicio = Date.UTC(2026, 9, 5);
	return Array.from({ length: 21 }, (_, i) =>
		new Date(inicio + i * 86_400_000).toISOString().slice(0, 10),
	);
}

function ficha(
	parcial: Pick<FichaPublica, "registro" | "instituto" | "liberacaoEfetiva" | "campoFim"> &
		Partial<FichaPublica>,
): FichaPublica {
	return {
		contratantes: ["recursos próprios"],
		campoInicio: "2026-10-13",
		entrevistas: 2000,
		...parcial,
	};
}

function publicada(
	parcial: Pick<
		PesquisaPublicada,
		"registro" | "instituto" | "liberacaoEfetiva" | "campoFim" | "campoInicio"
	> &
		Partial<PesquisaPublicada>,
): PesquisaPublicada {
	return {
		cnpj: "00000000000000",
		contratantes: ["recursos próprios"],
		liberacao: parcial.liberacaoEfetiva,
		entrevistas: 2000,
		margem: 2,
		confianca: 95,
		totais: { flavio: 50, lula: 50, brancoNulo: 0, naoSabe: 0, brancoNuloNaoSabe: null },
		validosPublicados: null,
		vf: 50,
		vl: 50,
		v: 0,
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

const ATLAS = publicada({
	registro: "BR-03663/2026",
	instituto: "AtlasIntel",
	campoInicio: "2026-10-03",
	campoFim: "2026-10-09",
	liberacaoEfetiva: "2026-10-09",
	entrevistas: 5000,
	margem: 1,
	confianca: 95,
	totais: { flavio: 51.1, lula: 45.7, brancoNulo: null, naoSabe: null, brancoNuloNaoSabe: 3.2 },
	vf: 52.79,
	vl: 47.21,
	v: 5.58,
	fonte: "http://folha.uol.com.br/atlas",
});

const QUAEST = publicada({
	registro: "BR-08729/2026",
	instituto: "Quaest",
	contratantes: ["Editora Globo", "TV Globo"],
	campoInicio: "2026-10-10",
	campoFim: "2026-10-13",
	liberacaoEfetiva: "2026-10-14",
	entrevistas: 2154,
	margem: 2,
	confianca: 95,
	totais: { flavio: 46, lula: 44, brancoNulo: 9, naoSabe: 1, brancoNuloNaoSabe: null },
	vf: 51.11,
	vl: 48.89,
	v: 2.22,
	fonte: "https://www.poder360.com.br/quaest-13",
});

const EVIL = publicada({
	registro: "BR-00001/2026",
	instituto: "Instituto Fantasma",
	campoInicio: "2026-10-01",
	campoFim: "2026-10-02",
	liberacaoEfetiva: "2026-10-06",
	fonte: "https://evil.example/fora",
	vf: 52.1,
	vl: 47.9,
});

function pagina(): string {
	return documentoPesquisas(
		payload({
			publicadas: [ATLAS, DATAFOLHA, EVIL, QUAEST],
			liberadasSemNumero: [
				ficha({
					registro: "BR-00466/2026",
					instituto: "A & B <i>",
					campoInicio: "2026-10-13",
					campoFim: "2026-10-15",
					liberacaoEfetiva: "2026-10-15",
				}),
			],
			vemAi: [
				ficha({
					registro: "BR-00652/2026",
					instituto: "MDA",
					campoInicio: "2026-10-13",
					campoFim: "2026-10-15",
					liberacaoEfetiva: "2026-10-16",
					entrevistas: 2002,
				}),
				ficha({
					registro: "BR-02510/2026",
					instituto: "Futura25",
					campoInicio: "2026-10-23",
					campoFim: "2026-10-25",
					liberacaoEfetiva: "2026-10-25",
				}),
			],
		}),
		AGORA,
	);
}

function celula(html: string, iso: string): string {
	const re = new RegExp(`<div class="a-dia[^"]*" data-d="${iso}">[\\s\\S]*?</div>`);
	return html.match(re)?.[0] ?? "";
}

function bloco(html: string, atributo: string): string {
	const re = new RegExp(`${atributo}>([\\s\\S]*?)</(?:section|template)>`);
	return html.match(re)?.[1] ?? "";
}

function regra(css: string, seletor: string): string {
	const i = css.indexOf(seletor);
	if (i < 0) return "";
	return css.slice(i, css.indexOf("}", i) + 1);
}

describe("calendário da reta final (#11)", () => {
	it("tem 21 quadrados de 5 a 25 de outubro e o dia 25 anuncia a apuração às 17h", () => {
		const html = pagina();
		const dias = diasRetaFinal();
		expect(dias).toHaveLength(21);
		expect(dias[0]).toBe("2026-10-05");
		expect(dias.at(-1)).toBe("2026-10-25");
		expect(html.match(/class="a-dia /g)).toHaveLength(21);
		for (const iso of dias) expect(html, iso).toContain(`data-d="${iso}"`);
		expect(html).toContain('aria-label="Calendário das pesquisas, de 5 a 25 de outubro"');
		expect(html).toContain('class="a-sem-tit">seg');
		expect(html).toContain('class="a-sem-tit">dom');
		const cinco = celula(html, "2026-10-05");
		expect(cinco).toContain(">5<small>segunda</small>");
		expect(cinco).toContain("vazio");
		const votacao = celula(html, "2026-10-25");
		expect(votacao).toContain("eleicao");
		expect(votacao).toContain("<b>Votação</b>");
		expect(votacao).toContain("apuração a partir das 17h");
		expect(votacao).toContain('class="a-vem a-item"');
		expect(votacao).toContain("Futura25");
		expect(votacao).toContain(
			'title="Futura25: campo de 23/10 a 25/10, registro BR-02510/2026"',
		);
		expect(votacao).not.toContain("vazio");
		expect(html).not.toMatch(/undefined|NaN/);
	});

	it("publicada, liberada sem número e futura têm estados visuais distintos", () => {
		const html = pagina();
		const publicadaDia = celula(html, "2026-10-08");
		expect(publicadaDia).toContain('class="a-pesq a-item');
		expect(publicadaDia).toContain("Datafolha");
		expect(publicadaDia).toContain("47,9 a 52,1");
		expect(publicadaDia).toContain('class="a-mini"');
		expect(publicadaDia).not.toContain("a-sem");
		expect(publicadaDia).not.toContain("a-vem");

		const sem = celula(html, "2026-10-15");
		expect(sem).toContain("hoje");
		expect(sem).toContain(">agora<");
		expect(sem).toContain('class="a-prog"');
		expect(sem).toContain("width:75%");
		expect(sem).toContain('class="a-sem a-item"');
		expect(sem).toContain("A &amp; B &lt;i&gt;");
		expect(sem).toContain("sem números ainda");
		expect(sem).not.toContain("A & B");
		expect(sem).not.toContain("vazio");

		const futura = celula(html, "2026-10-16");
		expect(futura).toContain("futuro");
		expect(futura).toContain('class="a-vem a-item"');
		expect(futura).toContain(
			'title="MDA: campo de 13/10 a 15/10, registro BR-00652/2026"',
		);
		expect(futura).not.toContain("a-pesq");
		expect(futura).not.toContain("a-sem");
	});

	it("o detalhe começa na última publicada e cada toque tem a ficha completa no vivo", () => {
		const html = pagina();
		const vivo = bloco(html, 'data-detalhe-vivo=""');
		expect(html).toContain('aria-live="polite"');
		expect(vivo).toContain("Quaest");
		expect(vivo).toContain("51,1");
		expect(vivo).toContain("48,9");
		expect(vivo).toContain('class="a-barra"');
		expect(vivo).toContain("divulgada em 14 de outubro");
		expect(vivo).toContain(
			"Votos válidos calculados dos totais (Lula 44%, Flávio 46%, brancos e nulos 9%, não sabem 1%)",
		);
		expect(vivo).not.toContain("o instituto publicou");
		expect(vivo).toContain("Quaest ouviu 2.154 eleitores de 10/10 a 13/10");
		expect(vivo).toContain("margem de erro de 2 pontos");
		expect(vivo).toContain("confiança de 95%");
		expect(vivo).toContain("Contratada por Editora Globo e TV Globo");
		expect(vivo).toContain("Registro no TSE BR-08729/2026");
		expect(vivo).toContain('href="https://www.poder360.com.br/quaest-13"');
		expect(vivo).toContain(">Ver fonte</a>");
		expect(vivo.indexOf('data-numero="13"')).toBeLessThan(vivo.indexOf('data-numero="22"'));
		expect(html).toContain('class="a-pesq a-item sel"');
		expect(html).toContain('data-registro="BR-08729/2026"');
		expect(html).toContain("/js/calendario.js");

		const datafolha = bloco(html, 'data-detalhe="BR-02949/2026"');
		expect(datafolha).toContain("Datafolha ouviu 2.520 eleitores de 06/10 a 08/10");
		expect(datafolha).toContain("divulgada em 8 de outubro");
		expect(datafolha).toContain("o instituto publicou 48 a 52");
		expect(datafolha).toContain("Contratada por Folha de S.Paulo e TV Globo");
		expect(datafolha).toContain('href="https://www.metropoles.com/brasil/datafolha-08"');
		expect(datafolha).toContain("52,1");
		expect(datafolha).toContain("47,9");

		const atlas = bloco(html, 'data-detalhe="BR-03663/2026"');
		expect(atlas).toContain("1 ponto");
		expect(atlas).not.toContain("1 pontos");
		expect(atlas).toContain("Feita com recursos próprios");
		expect(atlas).toContain("brancos, nulos e indecisos 3,2%");
		expect(atlas).not.toContain("Ver fonte");
		expect(atlas).not.toContain("folha.uol.com.br");

		const fantasma = bloco(html, 'data-detalhe="BR-00001/2026"');
		expect(fantasma).not.toContain("Ver fonte");
		expect(fantasma).not.toContain("evil.example");
	});

	it("a agenda esconde o dia vazio no celular e a legenda oferece rever as três semanas", async () => {
		const html = pagina();
		expect(celula(html, "2026-10-05")).toContain("vazio");
		expect(celula(html, "2026-10-15")).not.toContain("vazio");
		expect(celula(html, "2026-10-25")).not.toContain("vazio");
		expect(html).toContain("pesquisa divulgada");
		expect(html).toContain("registrada no TSE, ainda não divulgada");
		expect(html).toContain("liberada, números ainda não cadastrados");
		expect(html).toContain(
			'<button type="button" class="a-rever" data-rever="tres-semanas">Rever as três semanas</button>',
		);
		const cssRes = await env.ASSETS.fetch("https://presidente2026.test/css/tres-semanas.css");
		expect(cssRes.status).toBe(200);
		const css = await cssRes.text();
		const mobile = css.slice(css.indexOf("@media (max-width: 760px)"));
		expect(mobile).toMatch(/\.a-dia\.vazio[^{]*\{[^}]*display:\s*none/);
		expect(mobile).toMatch(/\.a-sem-tit[^{]*\{[^}]*display:\s*none/);
		expect(mobile).toMatch(/\.a-cal[^{]*\{[^}]*flex-direction:\s*column-reverse/);
		expect(css).toMatch(/overflow-x:\s*clip/);
		expect(css).toMatch(/\.a-dia\.eleicao[^{]*\{[^}]*background:\s*var\(--tinta\)/);
		expect(css).toMatch(/\.a-sem[^{]*\{[^}]*color:\s*var\(--suave\)/);
		expect(css).toMatch(/\.a-vem[^{]*\{[^}]*(dashed|linear-gradient)/);
	});

	it("no celular a reta final começa pelo dia mais recente e no desktop a grade cronológica fica", async () => {
		const html = pagina();
		const datas = [...html.matchAll(/class="a-dia [^"]*" data-d="(2026-10-\d{2})"/g)].map(
			(achado) => achado[1],
		);
		expect(datas).toEqual(diasRetaFinal());
		expect(datas[0]).toBe("2026-10-05");
		expect(datas.at(-1)).toBe("2026-10-25");

		const cssRes = await env.ASSETS.fetch("https://presidente2026.test/css/tres-semanas.css");
		expect(cssRes.status).toBe(200);
		const css = await cssRes.text();
		const base = regra(css, ".a-cal {");
		expect(base).toMatch(/grid-template-columns:\s*repeat\(7,\s*minmax\(0,\s*1fr\)\)/);
		expect(base).not.toMatch(/column-reverse/);

		const mobile = css.slice(css.indexOf("@media (max-width: 760px)"));
		const estreita = regra(mobile, ".a-cal {");
		expect(estreita).toMatch(/display:\s*flex/);
		expect(estreita).toMatch(/flex-direction:\s*column-reverse/);
		expect(estreita).not.toMatch(/repeat\(7/);
	});

	it("cards, barras e destaque põem Lula à esquerda e Flávio à direita, fixo (#139)", async () => {
		const html = pagina();
		const datafolha = celula(html, "2026-10-08");
		expect(datafolha).toContain('<span class="a-mini"><i style="width:47.87%"></i><i style="width:52.13%"></i></span>');
		expect(datafolha).toContain("<small>47,9 a 52,1</small>");
		expect(datafolha).toContain('aria-label="Datafolha: Lula 47,9%, Flávio 52,1%"');

		const vivo = bloco(html, 'data-detalhe-vivo=""');
		expect(vivo).toContain('<div class="a-barra"><i style="width:48.89%"></i><i style="width:51.11%"></i></div>');
		expect(vivo.indexOf('class="a-l"')).toBeGreaterThan(-1);
		expect(vivo.indexOf('class="a-l"')).toBeLessThan(vivo.indexOf('class="a-f"'));
		expect(vivo.indexOf("data-dvl")).toBeLessThan(vivo.indexOf("data-dvf"));

		const css = await (await env.ASSETS.fetch("https://presidente2026.test/css/tres-semanas.css")).text();
		expect(css).toMatch(/\.a-mini i:first-child, \.a-barra i:first-child \{ background: var\(--l\); \}/);
		expect(css).toMatch(/\.a-mini i:last-child, \.a-barra i:last-child \{ background: var\(--f\); \}/);
		expect(regra(css, ".a-leg-pub::before")).toMatch(/var\(--l\) 52%, var\(--f\) 52%/);
		expect(regra(css, ".a-det-num .a-l .a-mini-rosto")).toContain("margin-left: 0");
		expect(regra(css, ".a-det-num .a-f .a-mini-rosto")).toContain("margin-right: 0");

		const js = await (await env.ASSETS.fetch("https://presidente2026.test/js/calendario.js")).text();
		expect(js).toContain("fatias[0].style.width = `${deVl}%`;");
		expect(js).toContain("fatias[1].style.width = `${deVf}%`;");
	});
});
