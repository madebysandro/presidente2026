/**
 * Aceite #10: veredito, legenda do cabo e próxima liberação a partir do JSON da API.
 */
import { env } from "cloudflare:workers";
import { describe, expect, it } from "vitest";
import { documentoPesquisas } from "../src/pagina/documento";
import {
	FLAVIO,
	LULA,
	contagemVotacao,
	htmlLegendaCabo,
	htmlProximaLiberacao,
	htmlTopo,
	htmlVeredito,
} from "../src/pagina/topo";
import type { FichaPublica, PayloadPesquisas } from "../src/pesquisas/tipos";

const AGORA = new Date("2026-10-15T18:16:00-03:00");

function ficha(parcial: Pick<FichaPublica, "registro" | "instituto" | "liberacaoEfetiva" | "campoFim">): FichaPublica {
	return {
		contratantes: ["recursos próprios"],
		campoInicio: "2026-10-13",
		entrevistas: 2000,
		...parcial,
	};
}

function payload(extra: Partial<PayloadPesquisas> = {}): PayloadPesquisas {
	return {
		hoje: "2026-10-15",
		fase: "pesquisas",
		atualizadoEm: "2026-10-15T21:16:00.000Z",
		registroTse: { geradoEm: null, etag: null },
		media: {
			data: "2026-10-15",
			vf: 51.77,
			vl: 48.23,
			v: 3.55,
			n: 4,
			margem: 1.7,
			registros: ["BR-02949/2026", "BR-03663/2026", "BR-01209/2026", "BR-08729/2026"],
		},
		serieMedia: [],
		publicadas: [],
		liberadasSemNumero: [],
		vemAi: [
			ficha({
				registro: "BR-00652/2026",
				instituto: "MDA",
				campoFim: "2026-10-15",
				liberacaoEfetiva: "2026-10-16",
			}),
			ficha({
				registro: "BR-03764/2026",
				instituto: "100% Cidades",
				campoFim: "2026-10-15",
				liberacaoEfetiva: "2026-10-16",
			}),
			ficha({
				registro: "BR-04258/2026",
				instituto: "PoderData",
				campoFim: "2026-10-15",
				liberacaoEfetiva: "2026-10-16",
			}),
			ficha({
				registro: "BR-05187/2026",
				instituto: "GERP",
				campoFim: "2026-10-16",
				liberacaoEfetiva: "2026-10-16",
			}),
		],
		...extra,
	};
}

describe("render do topo (#10)", () => {
	it("o veredito traz Lula, o a e Flávio, com acento e uma casa (#139)", () => {
		const html = htmlVeredito(payload());
		const h1 = html.match(/<h1[\s\S]*?<\/h1>/)?.[0] ?? "";
		expect(h1).toContain("Flávio");
		expect(h1).toContain("Lula");
		expect(h1).toContain("51,8");
		expect(h1).toContain("48,2");
		expect(h1).toMatch(/>a</);
		expect(h1.indexOf(LULA.foto)).toBeLessThan(h1.indexOf(FLAVIO.foto));
		expect(h1.indexOf('data-numero="13"')).toBeLessThan(h1.indexOf('data-numero="22"'));
		expect(h1.indexOf('class="a-l"')).toBeLessThan(h1.indexOf('class="a-f"'));
		expect(html).toContain("4 institutos");
		expect(html).not.toMatch(/undefined|NaN/);
	});

	it("a legenda usa o singular 1 ponto e o plural com vírgula", () => {
		expect(htmlLegendaCabo(payload({ media: { ...payload().media!, margem: 1 } }))).toContain(
			"1 ponto para cada lado",
		);
		expect(htmlLegendaCabo(payload({ media: { ...payload().media!, margem: 1 } }))).not.toContain(
			"1 pontos",
		);
		expect(htmlLegendaCabo(payload())).toContain("1,7 pontos para cada lado");
	});

	it("a próxima liberação junta os nomes com vírgulas e e, até a 0h de Brasília", () => {
		const html = htmlProximaLiberacao(payload(), AGORA);
		expect(html).toContain("MDA, 100% Cidades, PoderData e GERP");
		expect(html).toContain("podem divulgar a partir de 16 de outubro");
		expect(html).toContain("em 5 h 44 min");
		expect(html).not.toMatch(/undefined|NaN/);
	});

	it("um instituto sozinho não ganha vírgula", () => {
		const html = htmlProximaLiberacao(
			payload({
				vemAi: [
					ficha({
						registro: "BR-00820/2026",
						instituto: "Alfa Inteligência",
						campoFim: "2026-10-19",
						liberacaoEfetiva: "2026-10-20",
					}),
				],
			}),
			AGORA,
		);
		expect(html).toContain("Alfa Inteligência pode divulgar a partir de 20 de outubro");
		expect(html).not.toContain(" e ");
	});

	it("os lados ficam Lula à esquerda e Flávio à direita, liderando um ou outro (#139)", () => {
		for (const [vf, vl, margem] of [
			[48.2, 51.8, "left:50.1%;width:3.4%"],
			[51.8, 48.2, "left:46.5%;width:3.4%"],
		] as const) {
			const html = htmlTopo(payload({ media: { ...payload().media!, vf, vl, v: vf - vl } }), AGORA);
			const cabo = html.slice(html.indexOf('class="a-cabo-linha"'), html.indexOf('class="a-cabo-leg"'));
			expect(cabo.indexOf('data-numero="13"')).toBeGreaterThan(-1);
			expect(cabo.indexOf('data-numero="13"')).toBeLessThan(cabo.indexOf('data-numero="22"'));
			expect(cabo).toContain("a-cabo-lf");
			expect(cabo).toContain(`style="width:${vf}%"`);
			expect(cabo).toContain(margem);
			const h1 = html.match(/<h1[\s\S]*?<\/h1>/)?.[0] ?? "";
			expect(h1.indexOf("Lula")).toBeLessThan(h1.indexOf("Flávio"));
		}
	});

	it("a vinheta abre com Lula à esquerda e Flávio à direita, como o cabo (#139)", async () => {
		const js = await (await env.ASSETS.fetch("https://presidente2026.test/js/movimento.js")).text();
		const vinheta = js.match(/function vinheta\(\) \{[\s\S]*?\n\}/)?.[0] ?? "";
		expect(vinheta.indexOf('"a-i-l"')).toBeGreaterThan(-1);
		expect(vinheta.indexOf('"a-i-l"')).toBeLessThan(vinheta.indexOf('"a-i-f"'));
		expect(vinheta).toMatch(/querySelector\("\.a-i-l"\), \[\{ clipPath: "inset\(0 100% 0 0\)" \}/);
		expect(vinheta).toMatch(/querySelector\("\.a-i-f"\), \[\{ clipPath: "inset\(0 0 0 100%\)" \}/);
		const css = await (await env.ASSETS.fetch("https://presidente2026.test/css/tres-semanas.css")).text();
		expect(css).toMatch(/\.a-i-l \{ background: var\(--l\); transform-origin: left; \}/);
		expect(css).toMatch(/\.a-i-f \{[^}]*flex: 1;[^}]*transform-origin: right;/);
	});

	it("na 0h de 25/10 a contagem chega a zero, sem NaN", () => {
		expect(contagemVotacao(new Date("2026-10-15T18:00:00-03:00"))).toEqual({
			dias: 9,
			relogio: "06:00:00",
		});
		const meiaNoite = new Date("2026-10-25T00:00:00-03:00");
		expect(contagemVotacao(meiaNoite)).toEqual({ dias: 0, relogio: "00:00:00" });
		const html = htmlTopo(payload({ media: null, vemAi: [] }), meiaNoite);
		expect(html).toContain("Presidente 2026, 2º turno");
		expect(html).toContain("00:00:00");
		expect(html).toContain("até a votação");
		expect(html).not.toMatch(/undefined|NaN/);
	});

	it("o documento da página não vaza undefined nem NaN", () => {
		const html = documentoPesquisas(payload(), AGORA);
		expect(html).toContain("Presidente 2026, 2º turno");
		expect(html).toContain("em 5 h 44 min");
		expect(html).toContain("/css/tres-semanas.css");
		expect(html).toContain("/js/relogio.js");
		expect(html).not.toMatch(/undefined|NaN/);
	});
});
