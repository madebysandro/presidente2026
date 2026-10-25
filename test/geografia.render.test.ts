/**
 * Aceite #19: exterior, comparecimento, colégios e comparação dos turnos no HTML da página.
 * A grade de UFs saiu com o mapa do Brasil (#131).
 * Seam: htmlGeografia — o mesmo HTML que o documento ao vivo inclui.
 */
import { describe, expect, it } from "vitest";
import type {
	Cargo,
	ColegioPresidente,
	EstadoApuracao,
	UfPresidente,
} from "../src/dominio/tipos";
import { documentoPesquisas } from "../src/pagina/documento";
import { htmlGeografia, type VistaNoite } from "../src/pagina/geografia";
import type { PayloadPesquisas } from "../src/pesquisas/tipos";

const AGORA = new Date("2026-10-25T21:00:00.000Z");

function payload(): PayloadPesquisas {
	return {
		hoje: "2026-10-25",
		fase: "ao_vivo",
		atualizadoEm: "2026-10-25T21:00:00.000Z",
		registroTse: { geradoEm: null, etag: null },
		media: null,
		serieMedia: [],
		publicadas: [],
		liberadasSemNumero: [],
		vemAi: [],
	};
}

function uf(
	sigla: string,
	nome: string,
	votos22: number,
	votos13: number,
): UfPresidente {
	const validos = votos22 + votos13;
	return {
		uf: sigla,
		nome,
		hora: "18:40:00",
		apurado: 40,
		secoes: 100,
		secoesApuradas: 40,
		eleitorado: 1_000_000,
		validos,
		comparecimento: 70,
		candidatos: [
			{
				n: votos22 >= votos13 ? "22" : "13",
				nome: votos22 >= votos13 ? "FLAVIO" : "LULA",
				votos: Math.max(votos22, votos13),
				pct: validos ? (Math.max(votos22, votos13) / validos) * 100 : 0,
			},
			{
				n: votos22 >= votos13 ? "13" : "22",
				nome: votos22 >= votos13 ? "LULA" : "FLAVIO",
				votos: Math.min(votos22, votos13),
				pct: validos ? (Math.min(votos22, votos13) / validos) * 100 : 0,
			},
		],
	};
}

function estado(extra: Partial<EstadoApuracao> = {}): EstadoApuracao {
	return {
		versao: 3,
		consultadoEm: AGORA.getTime(),
		proximaConsulta: AGORA.getTime(),
		erro: null,
		fase: "ao_vivo",
		cargos: {},
		...extra,
	};
}

function vista(apuracao: EstadoApuracao): VistaNoite {
	return {
		fase: "ao_vivo",
		agora: AGORA,
		pesquisas: payload(),
		apuracao,
		historico: [],
	};
}

const COLEGIOS = [
	"São Paulo",
	"Rio de Janeiro",
	"Brasília",
	"Belo Horizonte",
	"Salvador",
	"Fortaleza",
	"Manaus",
	"Curitiba",
	"Recife",
	"Porto Alegre",
] as const;

function colegioSp(): ColegioPresidente {
	return {
		uf: "sp",
		cd: "71072",
		nome: "São Paulo",
		hora: "18:40:00",
		apurado: 50,
		eleitorado: 9_145_124,
		validos: 100,
		comparecimento: 70,
		candidatos: [
			{ n: "22", nome: "FLAVIO", votos: 40, pct: 40 },
			{ n: "13", nome: "LULA", votos: 58, pct: 58 },
		],
	};
}

describe("colégios, exterior e transferência (#19)", () => {
	it("lista os 10 colégios fixos com o 1º e o 2º turno", () => {
		const html = htmlGeografia(
			vista(estado({ colegios: { "71072": colegioSp() } })),
		);
		const bloco = html.match(/data-geo="colegios"[\s\S]*?<\/section>/)?.[0] ?? "";
		let anterior = -1;
		for (const nome of COLEGIOS) {
			const indice = bloco.indexOf(nome);
			expect(indice).toBeGreaterThan(anterior);
			anterior = indice;
		}
		const saoPaulo = bloco.match(/data-colegio="71072"[\s\S]*?<\/li>/)?.[0] ?? "";
		expect(saoPaulo).toContain("2º turno Lula 58,00% · Flávio 40,00%");
		expect(saoPaulo).toContain("1º turno Lula 46,58% · Flávio 42,13%");
		expect(html).not.toMatch(/undefined|NaN/);
	});

	it("dá cartão ao exterior, com comparecimento e aviso quando está zerado", () => {
		const zerado = htmlGeografia(vista(estado()));
		const cartaoZerado = zerado.match(/data-geo="exterior"[\s\S]*?<\/section>/)?.[0] ?? "";
		expect(cartaoZerado).toContain("data-aviso-exterior");
		expect(cartaoZerado).toContain("O exterior costuma apurar por último");
		expect(cartaoZerado).toContain("37,31%");
		expect(cartaoZerado).toContain("43,49%");
		expect(cartaoZerado).toContain("47,57%");

		const comVotos = htmlGeografia(
			vista(
				estado({
					ufs: {
						zz: {
							uf: "zz",
							nome: "Exterior",
							hora: "19:00:00",
							apurado: 12,
							secoes: 100,
							secoesApuradas: 12,
							eleitorado: 900_000,
							validos: 1_000,
							comparecimento: 40.1,
							candidatos: [
								{ n: "22", nome: "FLAVIO", votos: 500, pct: 50 },
								{ n: "13", nome: "LULA", votos: 480, pct: 48 },
							],
						},
					},
				}),
			),
		);
		const cartao = comVotos.match(/data-geo="exterior"[\s\S]*?<\/section>/)?.[0] ?? "";
		expect(cartao).not.toContain("data-aviso-exterior");
		expect(cartao).toContain("Flávio lidera no 2º turno");
		expect(cartao).toContain("50,00%");
		expect(cartao).toContain("43,49%");
		expect(cartao).toContain("47,57%");
		expect(cartao).toContain("40,10%");
		expect(cartao).toContain("37,31%");
		expect(cartao).toContain("+2,79 p.p.");
		expect(cartao.indexOf('data-lado="13"')).toBeGreaterThan(-1);
		expect(cartao.indexOf('data-lado="13"')).toBeLessThan(cartao.indexOf('data-lado="22"'));
		expect(comVotos).not.toMatch(/undefined|NaN/);
	});

	it("compara a composição do eleitorado nos dois turnos, sem estimar transferência (#16)", () => {
		const html = htmlGeografia(
			vista(
				estado({
					analise: {
						comparacao: {
							primeiro: {
								flavio: 35.35,
								lula: 33.94,
								outros: 5.93,
								brancosNulos: 3.77,
								abstencao: 21.08,
							},
							segundo: {
								flavio: 40,
								lula: 36,
								outros: 0,
								brancosNulos: 4,
								abstencao: 20,
							},
							estimativa: {
								selo: "ESTIMATIVA",
								flavioVotos: 1_200_000,
								lulaVotos: -300_000,
								fonteVotos: 2_000_000,
							},
						},
					},
				}),
			),
		);
		const bloco = html.match(/data-geo="transferencia"[\s\S]*?<\/section>/)?.[0] ?? "";
		expect(bloco).toContain("Do 1º ao 2º turno");
		expect(bloco).toContain("Composição do eleitorado");
		expect(bloco).toContain("35,35%");
		expect(bloco).toContain('data-composicao="2"');
		expect(bloco).not.toContain("Para onde foram os votos?");
		expect(bloco).not.toContain("ESTIMATIVA");
		expect(bloco).not.toContain("1.200.000");
		expect(bloco).not.toMatch(/transferência oficial/i);
		expect(bloco).not.toMatch(/segundo o TSE/i);
		expect(html).not.toMatch(/undefined|NaN/);
	});

	it("não lê o arquivo zerado do Brasil como queda de comparecimento", () => {
		const zerado: Cargo = {
			id: "presidente",
			titulo: "Presidente",
			local: "Brasil",
			vagas: 1,
			apurado: 0,
			hora: "00:00:00",
			qe: null,
			totais: {
				eleitorado: 150_238_779,
				eleitoradoApurado: 0,
				comparecimento: 0,
				abstencao: 0,
				validos: 0,
				legenda: 0,
				brancos: 0,
				nulos: 0,
			},
			candidatos: [
				{
					n: "22",
					nome: "FLAVIO",
					partido: "PL",
					agr: "PL",
					votos: 0,
					pct: 0,
					pos: 1,
					eleito: false,
					situacao: "",
					valido: true,
					foto: "",
				},
				{
					n: "13",
					nome: "LULA",
					partido: "PT",
					agr: "PT",
					votos: 0,
					pct: 0,
					pos: 2,
					eleito: false,
					situacao: "",
					valido: true,
					foto: "",
				},
			],
		};
		const html = htmlGeografia(vista(estado({ cargos: { presidente: zerado } })));
		const brasil = html.match(/data-escopo="brasil"[\s\S]*?<\/li>/)?.[0] ?? "";
		expect(brasil).toContain("1º turno comparecimento 78,92%");
		expect(brasil).toContain("2º turno ainda sem comparecimento");
		expect(brasil).not.toContain("0,00%");
		expect(brasil).not.toContain("−78,92");
	});

	it("mostra a diferença de comparecimento e de abstenção", () => {
		const html = htmlGeografia(
			vista(
				estado({
					cargos: {
						presidente: {
							id: "presidente",
							titulo: "Presidente",
							local: "Brasil",
							vagas: 1,
							apurado: 40,
							hora: "18:40:00",
							qe: null,
							totais: {
								eleitorado: 150_000_000,
								eleitoradoApurado: 70_000_000,
								comparecimento: 74.2,
								abstencao: 25.8,
								validos: 60_000_000,
								legenda: 0,
								brancos: 2,
								nulos: 3,
							},
							candidatos: [
								{
									n: "13",
									nome: "LULA",
									partido: "PT",
									agr: "PT",
									votos: 32_000_000,
									pct: 53.5,
									pos: 1,
									eleito: false,
									situacao: "",
									valido: true,
									foto: "",
								},
							],
						},
					},
				}),
			),
		);
		const brasil = html.match(/data-escopo="brasil"[\s\S]*?<\/li>/)?.[0] ?? "";
		expect(brasil).toContain("diferença −4,72 p.p. no comparecimento");
		expect(brasil).toContain("+4,72 p.p. na abstenção");
	});

	it("empilha exterior, comparecimento, colégios e comparação, sem a grade de UFs (#131)", () => {
		const html = htmlGeografia(vista(estado()));
		expect(html).not.toContain('data-geo="estados"');
		const ordem = ["exterior", "comparecimento", "colegios", "transferencia"];
		let anterior = -1;
		for (const id of ordem) {
			const indice = html.indexOf(`data-geo="${id}"`);
			expect(indice).toBeGreaterThan(anterior);
			anterior = indice;
		}
		expect(html).toContain("Comparecimento e abstenção");
		expect(html).toContain("78,92%");
		expect(html).not.toMatch(/undefined|NaN/);
	});
});

describe("página ao vivo (#19)", () => {
	it("coloca a geografia depois do duelo e antes do calendário", () => {
		const html = documentoPesquisas(payload(), AGORA, {
			apuracao: estado({ fase: "ao_vivo" }),
			historico: [],
		});
		expect(html.indexOf("a-placar")).toBeGreaterThan(-1);
		expect(html.indexOf('data-geo="exterior"')).toBeGreaterThan(html.indexOf("a-placar"));
		expect(html.indexOf('data-geo="comparecimento"')).toBeGreaterThan(html.indexOf('data-geo="exterior"'));
		expect(html.indexOf('data-geo="colegios"')).toBeGreaterThan(html.indexOf('data-geo="comparecimento"'));
		expect(html.indexOf('data-geo="transferencia"')).toBeGreaterThan(html.indexOf('data-geo="colegios"'));
		expect(html.indexOf("última semana")).toBeGreaterThan(html.indexOf('data-geo="transferencia"'));
		expect(html).not.toMatch(/undefined|NaN/);
	});

	it("não entra na fase de pesquisas", () => {
		const html = documentoPesquisas(
			{ ...payload(), fase: "pesquisas", hoje: "2026-10-16" },
			new Date("2026-10-16T15:00:00-03:00"),
		);
		expect(html).not.toContain("data-geo=");
		expect(html).not.toContain("Estados e regiões");
	});
});

describe("um padrão só para sem 2º turno (#129 W6)", () => {
	const SEM2 = '<span class="a-sem2">sem 2º</span>';

	it("exterior e colégio sem 2º turno levam o mesmo token", () => {
		const html = htmlGeografia(vista(estado({ ufs: { sp: uf("sp", "São Paulo", 60, 40) } })));

		const exterior = html.match(/data-geo="exterior"[\s\S]*?<\/section>/)?.[0] ?? "";
		const flavioExt = exterior.match(/data-lado="22"[\s\S]*?<\/li>/)?.[0] ?? "";
		expect(flavioExt).toContain(SEM2);
		expect(flavioExt).not.toContain("—");
		expect(flavioExt).toContain("1º turno");

		const colegio = html.match(/data-colegio="71072"[\s\S]*?<\/li>/)?.[0] ?? "";
		expect(colegio).toContain(`<span data-turno="2">${SEM2}</span>`);
		expect(html).not.toMatch(/undefined|NaN/);
	});

	it("o token usa a régua de fundo", async () => {
		const { env } = await import("cloudflare:workers");
		const css = await (await env.ASSETS.fetch("https://presidente2026.test/css/tres-semanas.css")).text();
		const regra = css.match(/\n\.a-sem2\s*\{([^}]*)\}/)?.[1] ?? "";
		expect(regra).toMatch(/background:\s*var\(--regua\)/);
	});
});
