/**
 * Aceite #10: veredito, legenda do cabo e próxima liberação a partir do JSON da API.
 */
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
	it("o veredito traz Flávio, o a e Lula, com acento e uma casa", () => {
		const html = htmlVeredito(payload());
		const h1 = html.match(/<h1[\s\S]*?<\/h1>/)?.[0] ?? "";
		expect(h1).toContain("Flávio");
		expect(h1).toContain("Lula");
		expect(h1).toContain("51,8");
		expect(h1).toContain("48,2");
		expect(h1).toMatch(/>a</);
		expect(h1.indexOf(FLAVIO.foto)).toBeLessThan(h1.indexOf(LULA.foto));
		expect(h1.indexOf('data-numero="22"')).toBeLessThan(h1.indexOf('data-numero="13"'));
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

	it("os lados não trocam quando Lula está na frente", () => {
		const html = htmlTopo(
			payload({
				media: { ...payload().media!, vf: 48.2, vl: 51.8, v: -3.6 },
			}),
			AGORA,
		);
		const cabo = html.match(/class="a-cabo-linha"[\s\S]*?<\/div><\/div>/)?.[0] ?? html;
		expect(cabo.indexOf('data-numero="22"')).toBeLessThan(cabo.indexOf('data-numero="13"'));
		expect(cabo.indexOf(FLAVIO.foto)).toBeLessThan(cabo.indexOf(LULA.foto));
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
