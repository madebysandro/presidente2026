/**
 * Aceite #19: regiões agregadas e a UF que virou, no HTML da página.
 * Seam: htmlGeografia — o mesmo HTML que o documento ao vivo inclui.
 */
import { describe, expect, it } from "vitest";
import { liderDeVotos, votosUf1t } from "../src/apuracao/referencia-1t";
import { SIGLAS_UF } from "../src/config/ufs";
import type {
	Cargo,
	ColegioPresidente,
	EstadoApuracao,
	RegiaoApuracao,
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

function regiao(
	nome: string,
	pct22: number,
	pct13: number,
	virou: boolean,
): RegiaoApuracao {
	const lider = pct13 > pct22 ? "13" : "22";
	return {
		nome,
		apurado: 40,
		validos: 1_000,
		candidatos: [
			{ n: "22", nome: "FLAVIO", votos: pct22, pct: pct22 },
			{ n: "13", nome: "LULA", votos: pct13, pct: pct13 },
		],
		lider,
		lider1t: virou ? (lider === "13" ? "22" : "13") : lider,
		virou,
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

describe("estados e regiões (#19)", () => {
	it("mostra a região agregada e marca só a UF que virou", () => {
		const html = htmlGeografia(
			vista(
				estado({
					ufs: {
						ba: uf("ba", "Bahia", 30, 70),
						sp: uf("sp", "São Paulo", 60, 40),
						zz: uf("zz", "Exterior", 55, 45),
					},
					analise: {
						regioes: [
							regiao("Nordeste", 39, 61, true),
							regiao("Sudeste", 55, 45, false),
						],
						ufsQueViraram: [
							{ uf: "ba", nome: "Bahia", lider: "13", lider1t: "22" },
						],
					},
				}),
			),
		);

		const nordeste = html.match(/data-regiao="Nordeste"[\s\S]*?<\/li>/)?.[0] ?? "";
		expect(nordeste).toContain("Nordeste");
		expect(nordeste).toContain("Lula");
		expect(nordeste).toContain("61,00%");
		expect(nordeste).toContain("39,00%");
		expect(nordeste).toContain("viraram");

		const sudeste = html.match(/data-regiao="Sudeste"[\s\S]*?<\/li>/)?.[0] ?? "";
		expect(sudeste).toContain("Flávio");
		expect(sudeste).toContain("55,00%");
		expect(sudeste).not.toContain("viraram");

		const bahia = html.match(/data-uf="ba"[\s\S]*?<\/div>/)?.[0] ?? "";
		expect(bahia).toContain("BA");
		expect(bahia).toContain("Lula");
		expect(bahia).toContain("viraram");

		const saoPaulo = html.match(/data-uf="sp"[\s\S]*?<\/div>/)?.[0] ?? "";
		expect(saoPaulo).toContain("SP");
		expect(saoPaulo).toContain("Flávio");
		expect(saoPaulo).not.toContain("viraram");

		const exterior = html.match(/data-uf="zz"[\s\S]*?<\/div>/)?.[0] ?? "";
		expect(exterior).toContain("EXT");
		expect(exterior).toContain("Flávio");

		expect(html).toContain("Flávio 1 · Lula 1 UFs lideradas · 1 viraram");
		expect(bahia).not.toContain("a-uf-1t");
		expect(html).toContain("Grade de UFs em 7 colunas");
		for (const sigla of SIGLAS_UF) expect(html).toContain(`data-uf="${sigla}"`);
		expect(html).not.toMatch(/undefined|NaN/);
	});

	it("sem seções apuradas, a grade mostra o 1º turno apagado", () => {
		let flavio = 0;
		let lula = 0;
		for (const sigla of SIGLAS_UF) {
			if (sigla === "zz") continue;
			const lider = liderDeVotos(votosUf1t(sigla));
			if (lider === "22") flavio += 1;
			if (lider === "13") lula += 1;
		}
		const html = htmlGeografia(vista(estado()));
		expect(html).toContain(`Flávio liderou em ${flavio} UFs e Lula em ${lula}`);
		expect(html).toContain("apagado, até as primeiras seções");
		expect(html.match(/a-uf-1t/g)).toHaveLength(SIGLAS_UF.length);
		expect(html).not.toMatch(/undefined|NaN/);
	});
});

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
		expect(saoPaulo).toContain("2º turno Flávio 40,00% · Lula 58,00%");
		expect(saoPaulo).toContain("1º turno Flávio 42,13% · Lula 46,58%");
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

	it("empilha exterior, comparecimento, estados, colégios e comparação", () => {
		const html = htmlGeografia(vista(estado()));
		const ordem = ["exterior", "comparecimento", "estados", "colegios", "transferencia"];
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
		expect(html.indexOf('data-geo="estados"')).toBeGreaterThan(html.indexOf('data-geo="comparecimento"'));
		expect(html.indexOf('data-geo="colegios"')).toBeGreaterThan(html.indexOf('data-geo="estados"'));
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
