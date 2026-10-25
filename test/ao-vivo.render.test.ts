/**
 * Aceite #18: faixa, placar, cabo, gráfico, momentos e estimativas.
 * Seam: funções puras de render (o HTML que a página e o fragmento devolvem).
 */
import { env } from "cloudflare:workers";
import { describe, expect, it } from "vitest";
import { ABERTURA_2T_MS } from "../src/apuracao/abertura";
import { PAUSA_TSE } from "../src/apuracao/pausa-tse";
import type { Cargo, EstadoApuracao, Leitura, MomentoNoite } from "../src/dominio/tipos";
import {
	htmlCaboApuracao,
	htmlEstimativas,
	htmlFaixa,
	htmlGraficoNoite,
	htmlMomentos,
	htmlPlacar,
	relogioDaPagina,
	type VistaNoite,
} from "../src/pagina/ao-vivo";
import { documentoPesquisas } from "../src/pagina/documento";
import type { FichaPublica, PayloadPesquisas, PesquisaPublicada } from "../src/pesquisas/tipos";

const AGORA = new Date("2026-10-25T22:30:00.000Z");

function payload(extra: Partial<PayloadPesquisas> = {}): PayloadPesquisas {
	return {
		hoje: "2026-10-25",
		fase: "ao_vivo",
		atualizadoEm: "2026-10-25T21:00:00.000Z",
		registroTse: { geradoEm: null, etag: null },
		media: {
			data: "2026-10-25",
			vf: 51.77,
			vl: 48.23,
			v: 3.54,
			n: 4,
			margem: 1.7,
			registros: ["BR-01209/2026"],
		},
		serieMedia: [],
		publicadas: [],
		liberadasSemNumero: [],
		vemAi: [],
		...extra,
	};
}

function candidato(n: string, votos: number, pct: number): Cargo["candidatos"][number] {
	return {
		n,
		nome: n === "22" ? "FLAVIO BOLSONARO" : "LULA",
		partido: n === "22" ? "PL" : "PT",
		agr: n,
		votos,
		pct,
		pos: n === "22" ? 1 : 2,
		eleito: false,
		situacao: "",
		valido: true,
		foto: "",
	};
}

function cargo(parcial: Partial<Cargo> = {}): Cargo {
	return {
		id: "presidente",
		titulo: "Presidente",
		local: "Brasil",
		vagas: 1,
		apurado: 48,
		hora: "18:40:00",
		qe: null,
		totais: {
			eleitorado: 10_000_000,
			eleitoradoApurado: 4_800_000,
			comparecimento: 70,
			abstencao: 30,
			validos: 8_500_000,
			legenda: 0,
			brancos: 1,
			nulos: 1,
		},
		candidatos: [candidato("22", 4_000_000, 47.06), candidato("13", 4_500_000, 52.94)],
		...parcial,
	};
}

function estado(extra: Partial<EstadoApuracao> = {}): EstadoApuracao {
	return {
		versao: 2,
		consultadoEm: AGORA.getTime() - 120_000,
		proximaConsulta: AGORA.getTime() + 90_000,
		erro: null,
		fase: "ao_vivo",
		encerrada: false,
		cargos: { presidente: cargo() },
		analise: {
			viradas: [
				{ de: "22", para: "13", hora: "18:40:00", ap: 50, t: 50 },
				{ de: "13", para: "22", hora: "19:50:00", ap: 80, t: 80 },
			],
			momentos: [
				{ tipo: "abre", hora: "17:20:00", ap: 12, n: "22", margemPp: 9.1 },
				{ tipo: "virada", hora: "18:40:00", ap: 50, de: "22", para: "13" },
				{ tipo: "virada", hora: "19:50:00", ap: 80, de: "13", para: "22" },
			] satisfies MomentoNoite[],
			majoritarias: {
				presidente: {
					defensor: { n: "13", nome: "LULA", votos: 4_500_000, pct: 52.94 },
					perseguidor: { n: "22", nome: "FLAVIO BOLSONARO", votos: 4_000_000, pct: 47.06 },
					vantagemVotos: 500_000,
					vantagemPp: 5.88,
					evolucaoVantagemPp: [],
					validosAApurar: 12_500_000,
					margemParaVirarPp: 8.5,
					foraDeAlcance: false,
					primeiroTurno: null,
					tendencias: [{ n: "22", nome: "FLAVIO BOLSONARO", ppPor10pct: 1.2 }],
				},
			},
		},
		...extra,
	};
}

function leitura(ap: number, pct22: number, pct13: number, hora: string): Leitura {
	return {
		t: ap,
		c: {
			presidente: {
				ap,
				hora,
				vv: 100,
				comp: 70,
				bra: 1,
				nul: 1,
				c: {
					"22": [pct22, pct22, 1],
					"13": [pct13, pct13, 2],
				},
			},
		},
	};
}

const HISTORICO: Leitura[] = [
	leitura(20, 60, 40, "17:20:00"),
	leitura(50, 45, 55, "18:40:00"),
	leitura(80, 55, 45, "19:50:00"),
];

function vista(extra: Partial<VistaNoite> = {}): VistaNoite {
	return {
		fase: "ao_vivo",
		agora: AGORA,
		pesquisas: payload(),
		apuracao: estado(),
		historico: HISTORICO,
		...extra,
	};
}

describe("faixa de status (#18)", () => {
	it("antes das 17h diz Aguardando 17h e, com o arquivo zerado, diz isso", () => {
		const vazia = htmlFaixa(
			vista({
				fase: "pesquisas",
				apuracao: estado({
					fase: "pesquisas",
					consultadoEm: null,
					proximaConsulta: null,
					cargos: {},
				}),
			}),
		);
		expect(vazia).toContain("Aguardando 17h");
		expect(vazia).toContain("Primeiros resultados às 17:00");
		expect(vazia).toContain("Próxima consulta às 17h");
		expect(vazia).not.toContain("arquivo zerado");

		const zerado = htmlFaixa(
			vista({
				fase: "pesquisas",
				apuracao: estado({
					fase: "pesquisas",
					cargos: {
						presidente: cargo({
							apurado: 0,
							hora: "00:00:00",
							candidatos: [candidato("22", 0, 0), candidato("13", 0, 0)],
						}),
					},
				}),
			}),
		);
		expect(zerado).toContain("Aguardando 17h");
		expect(zerado).toContain("arquivo zerado");
		expect(zerado).not.toMatch(/undefined|NaN/);
	});

	it("ao vivo mostra a hora do TSE, a idade e a próxima consulta", () => {
		const html = htmlFaixa(vista());
		expect(html).toContain("Ao vivo");
		expect(html).toContain("Dados do TSE 18:40:00 · há 2 min");
		expect(html).toContain("Próxima consulta em 1 min 30 s");
		expect(html).toContain("data-proxima-em=");
		expect(html).not.toMatch(/\sdata-proxima[\s="]/);
		expect(html).not.toMatch(/undefined|NaN/);
	});

	it("leitura com menos de um minuto diz agora há pouco", () => {
		const html = htmlFaixa(
			vista({
				apuracao: estado({ consultadoEm: AGORA.getTime() - 30_000 }),
			}),
		);
		expect(html).toContain("agora há pouco");
	});

	it("encerrada não promete outra consulta", () => {
		const html = htmlFaixa(
			vista({
				fase: "encerrada",
				apuracao: estado({
					fase: "encerrada",
					encerrada: true,
					proximaConsulta: null,
				}),
			}),
		);
		expect(html).toContain("Encerrada");
		expect(html).toContain("Resultado final · 2º turno");
		expect(html).not.toContain("Próxima consulta");
		expect(html).not.toContain("Aguardando 17h");
		expect(html).not.toMatch(/undefined|NaN/);
	});

	it("uma consulta a dias mostra a data em Brasília, não milhares de minutos", () => {
		const agora = new Date("2026-10-16T15:00:00-03:00").getTime();
		const html = htmlFaixa(
			vista({
				fase: "pesquisas",
				agora: new Date(agora),
				apuracao: estado({
					fase: "pesquisas",
					proximaConsulta: ABERTURA_2T_MS,
					cargos: {},
				}),
			}),
		);
		expect(html).toContain("Próxima consulta 25/10, 17:00");
		expect(html).not.toMatch(/\d{4,} min/);

		const emHoras = htmlFaixa(
			vista({
				apuracao: estado({ proximaConsulta: AGORA.getTime() + 2 * 3_600_000 + 5 * 60_000 }),
			}),
		);
		expect(emHoras).toContain("Próxima consulta em 2 h 05 min");
	});
});

describe("pausa do TSE até 19h (#124)", () => {
	const FIM = Date.parse(PAUSA_TSE.fim);

	it("dentro da pausa a faixa diz que a apuração parou e volta às 19h, sem contagem genérica", () => {
		const agora = new Date("2026-10-25T18:00:00-03:00");
		const html = htmlFaixa(
			vista({
				agora,
				apuracao: estado({ consultadoEm: agora.getTime() - 120_000, proximaConsulta: FIM }),
			}),
		);
		expect(html).not.toContain(">Ao vivo<");
		expect(html).toContain("Apuração do TSE pausada até 19h");
		expect(html).toContain("Próxima consulta às 19h (Belém/Brasília)");
		expect(html).toContain(`data-pausa-ate="${FIM}"`);
		expect(html).not.toContain("Próxima consulta em");
		expect(html).not.toMatch(/undefined|NaN/);
	});

	it("depois das 19h volta a hora do TSE e a contagem normal", () => {
		const agora = new Date("2026-10-25T19:05:00-03:00");
		const html = htmlFaixa(
			vista({
				agora,
				apuracao: estado({ consultadoEm: agora.getTime() - 120_000, proximaConsulta: agora.getTime() + 90_000 }),
			}),
		);
		expect(html).toContain("Dados do TSE 18:40:00 · há 2 min");
		expect(html).toContain("Próxima consulta em 1 min 30 s");
		expect(html).not.toContain("pausada");
		expect(html).not.toContain("data-pausa");
	});

	it("encerrada não fala de pausa", () => {
		const html = htmlFaixa(
			vista({
				fase: "encerrada",
				agora: new Date("2026-10-25T18:00:00-03:00"),
				apuracao: estado({ fase: "encerrada", encerrada: true, proximaConsulta: null }),
			}),
		);
		expect(html).toContain("Resultado final · 2º turno");
		expect(html).not.toContain("pausada");
	});
});

describe("placar e cabo da apuração (#18)", () => {
	it("com Lula na frente, Flávio continua à esquerda e o cabo não tem faixa de margem", () => {
		const placar = htmlPlacar(vista());
		const h1 = placar.match(/<h1[\s\S]*?<\/h1>/)?.[0] ?? "";
		expect(h1.indexOf("Flávio")).toBeGreaterThanOrEqual(0);
		expect(h1.indexOf("Flávio")).toBeLessThan(h1.indexOf("Lula"));
		expect(h1.indexOf('data-numero="22"')).toBeLessThan(h1.indexOf('data-numero="13"'));
		expect(h1).toContain("47,06");
		expect(h1).toContain("52,94");
		expect(placar).toContain("4.000.000");
		expect(placar).toContain("4.500.000");
		expect(placar).toContain("votos válidos");
		expect(placar).toContain("48,00% das seções");

		const cabo = htmlCaboApuracao(vista());
		expect(cabo).not.toContain("a-cabo-margem");
		expect(cabo).toContain('class="a-cabo-f" style="width:47.06%"');
		expect(cabo).toContain('class="a-cabo-media" style="left:51.77%"');
		expect(cabo).toContain("média das pesquisas");
		expect(cabo).toContain("25 de outubro");
		expect(cabo).toContain("51,8%");
		expect(cabo).not.toMatch(/undefined|NaN/);
	});

	it("o balanço não zera a fatia do Flávio no cabo da apuração (#127)", async () => {
		const cabo = htmlCaboApuracao(vista());
		expect(cabo).not.toContain("data-base");
		expect(cabo).not.toContain("data-margem");

		const jsRes = await env.ASSETS.fetch("https://presidente2026.test/js/movimento.js");
		expect(jsRes.status).toBe(200);
		const js = await jsRes.text();
		const balanco = js.match(/function balanco\(\) \{[\s\S]*?\n\}/)?.[0] ?? "";
		expect(balanco).toMatch(/hasAttribute\("data-base"\)/);
		expect(balanco).toMatch(/hasAttribute\("data-margem"\)/);
		expect(balanco.indexOf("hasAttribute")).toBeLessThan(balanco.indexOf("animate("));
	});

	it("arquivo zerado não inventa um placar", () => {
		const v = vista({
			apuracao: estado({
				cargos: {
					presidente: cargo({
						apurado: 0,
						candidatos: [candidato("22", 0, 0), candidato("13", 0, 0)],
					}),
				},
			}),
		});
		expect(htmlPlacar(v)).toContain("arquivo zerado");
		expect(htmlPlacar(v)).not.toContain("47,06");
		expect(htmlCaboApuracao(v)).not.toContain("a-cabo-f");
		expect(htmlCaboApuracao(v)).toContain("média das pesquisas");
	});
});

describe("gráfico, momentos e estimativas (#18)", () => {
	it("o gráfico vai de 0 a 100% das seções, sombreia o que falta e marca as viradas", () => {
		const html = htmlGraficoNoite(vista());
		expect(html).toContain(">0%<");
		expect(html).toContain(">100%<");
		expect(html).toContain('class="t-apurar" x="75.20" width="16.80"');
		expect(html).toContain('d="M24.80,8.00L50.00,71.00L75.20,29.00"');
		expect(html).toContain('class="t-virada" style="left:50.00%"');
		expect(html).toContain('class="t-virada" style="left:75.20%"');
		expect(html).not.toMatch(/undefined|NaN/);
	});

	it("sem leituras a área inteira ainda vai ser apurada", () => {
		const html = htmlGraficoNoite(vista({ historico: [] }));
		expect(html).toContain('class="t-apurar" x="8.00" width="84.00"');
		expect(html).toContain("2ª leitura");
		const encerrada = htmlGraficoNoite(
			vista({
				fase: "encerrada",
				historico: [],
				apuracao: estado({ fase: "encerrada", encerrada: true }),
			}),
		);
		expect(encerrada).not.toContain("t-apurar");
	});

	it("a primeira leitura já sombreia o que falta e marca virada", () => {
		const html = htmlGraficoNoite(
			vista({ historico: [leitura(12, 55, 45, "17:20:00")] }),
		);
		expect(html).toContain('class="t-apurar" x="18.08" width="73.92"');
		expect(html).toContain('d="M18.08,8.00h0"');
		const ponto = html.match(/<path[^>]*d="M18\.08,8\.00h0"[^>]*>/)?.[0] ?? "";
		expect(ponto).toContain('stroke-linecap="round"');
		expect(ponto).toContain('vector-effect="non-scaling-stroke"');
		expect(html).not.toContain("<circle");
		expect(html).toContain('class="t-virada" style="left:50.00%"');
		expect(html).not.toContain("2ª leitura");
		expect(html).not.toMatch(/undefined|NaN/);
	});

	it("os momentos da noite nomeiam a virada sem trocar os lados no texto", () => {
		const html = htmlMomentos(vista());
		expect(html).toContain("Momentos da noite");
		expect(html).toContain("virou de Flávio para Lula, 50,00% das seções");
		expect(html).toContain("virou de Lula para Flávio, 80,00% das seções");
		expect(html).toContain("a noite abre com Flávio");
		expect(html).not.toMatch(/undefined|NaN/);
	});

	it("as estimativas aparecem ao vivo e somem quando encerra", () => {
		const html = htmlEstimativas(vista());
		expect(html).toContain("Válidos que faltam");
		expect(html).toContain("12.500.000");
		expect(html).toContain("Para virar");
		expect(html).toContain("8,5 p.p.");
		expect(html).toContain("Flávio +1,2 p.p. a cada 10% de seções");
		expect(html).not.toMatch(/vencer no 1/i);

		const fora = htmlEstimativas(
			vista({
				apuracao: estado({
					analise: {
						majoritarias: {
							presidente: {
								defensor: { n: "22", nome: "FLAVIO", votos: 1, pct: 60 },
								perseguidor: { n: "13", nome: "LULA", votos: 1, pct: 40 },
								vantagemVotos: 1,
								vantagemPp: 20,
								evolucaoVantagemPp: [],
								validosAApurar: 100,
								margemParaVirarPp: 140,
								foraDeAlcance: true,
								primeiroTurno: null,
								tendencias: [],
							},
						},
					},
				}),
			}),
		);
		expect(fora).toContain("fora de alcance");
		expect(fora).toContain("aguardando mais leituras");

		expect(
			htmlEstimativas(
				vista({
					fase: "encerrada",
					apuracao: estado({ fase: "encerrada", encerrada: true }),
				}),
			),
		).toBe("");
	});
});

describe("página composta (#18)", () => {
	it("ao vivo troca o veredito pelo placar, encolhe o calendário para a última semana e não recarrega a página", () => {
		const html = documentoPesquisas(payload(), AGORA, {
			apuracao: estado(),
			historico: HISTORICO,
		});
		expect(html).toContain("Ao vivo");
		expect(html).toContain("47,06");
		expect(html).not.toContain("até a votação");
		expect(html).not.toContain("a-cabo-margem");
		expect(html).toContain("Momentos da noite");
		expect(html).toContain('aria-label="Calendário das pesquisas, última semana"');
		expect(html.match(/class="a-dia /g)).toHaveLength(7);
		expect(html).toContain('data-d="2026-10-19"');
		expect(html).not.toContain('data-d="2026-10-18"');
		expect(html).toContain('data-d="2026-10-25"');
		expect(html.indexOf("Momentos da noite")).toBeLessThan(html.indexOf("última semana"));
		expect(html).toContain('data-estimativas');
		expect(html).toContain("/js/ao-vivo.js");
		expect(html).not.toMatch(/http-equiv="refresh"/i);
		expect(html).not.toMatch(/undefined|NaN/);
	});

	it("ao vivo a última semana deixa as pesquisas anteriores acessíveis", () => {
		const antiga: PesquisaPublicada = {
			registro: "BR-02949/2026",
			cnpj: "00000000000000",
			instituto: "Datafolha",
			contratantes: ["Folha"],
			campoInicio: "2026-10-06",
			campoFim: "2026-10-08",
			liberacao: "2026-10-08",
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
			cadastradoEm: "2026-10-08T18:00:00.000Z",
			substituidoEm: null,
		};
		const html = documentoPesquisas(payload({ publicadas: [antiga] }), AGORA, {
			apuracao: estado(),
			historico: HISTORICO,
		});
		expect(html).toContain('class="a-anteriores"');
		expect(html).toContain("Pesquisas de antes da última semana");
		expect(html).toContain('data-registro="BR-02949/2026"');
		expect(html).toContain('data-detalhe="BR-02949/2026"');
		expect(html).not.toContain('data-d="2026-10-08"');
		expect(html.match(/class="a-dia /g)).toHaveLength(7);

		const semNumero: FichaPublica = {
			registro: "BR-00001/2026",
			instituto: "Quaest",
			contratantes: ["recursos próprios"],
			campoInicio: "2026-10-01",
			campoFim: "2026-10-05",
			liberacaoEfetiva: "2026-10-06",
			entrevistas: 1000,
		};
		const futura: FichaPublica = {
			registro: "BR-00002/2026",
			instituto: "AtlasIntel",
			contratantes: ["recursos próprios"],
			campoInicio: "2026-10-07",
			campoFim: "2026-10-09",
			liberacaoEfetiva: "2026-10-10",
			entrevistas: 1500,
		};
		const comFichas = documentoPesquisas(
			payload({ publicadas: [antiga], liberadasSemNumero: [semNumero], vemAi: [futura] }),
			AGORA,
			{ apuracao: estado(), historico: HISTORICO },
		);
		const bloco = comFichas.match(/<div class="a-anteriores">[\s\S]*?<\/div>/)?.[0] ?? "";
		expect(bloco).toContain("Quaest");
		expect(bloco).toContain("sem números ainda");
		expect(bloco).toContain("AtlasIntel");
		expect(comFichas).not.toContain('data-d="2026-10-06"');
		expect(comFichas).not.toContain('data-d="2026-10-10"');
	});

	it("encerrada tira o bloco de estimativas e mantém as pesquisas acessíveis", () => {
		const html = documentoPesquisas(payload({ fase: "encerrada" }), AGORA, {
			apuracao: estado({ fase: "encerrada", encerrada: true, proximaConsulta: null }),
			historico: HISTORICO,
		});
		expect(html).toContain("Encerrada");
		expect(html).not.toContain("data-estimativas");
		expect(html).toContain("Rever as três semanas");
		expect(html).toContain('data-d="2026-10-25"');
	});

	it("antes das 17h a página de pesquisas continua e a faixa avisa a espera", () => {
		const html = documentoPesquisas(
			payload({ fase: "pesquisas", hoje: "2026-10-16", media: null }),
			new Date("2026-10-16T15:00:00-03:00"),
		);
		expect(html).toContain("Aguardando 17h");
		expect(html).toContain("até a votação");
		expect(html).not.toContain("Momentos da noite");
		expect(html.match(/class="a-dia /g)).toHaveLength(21);
		expect(html).not.toMatch(/undefined|NaN/);
	});
});

describe("relógio da página (#18)", () => {
	it("antes da abertura a fase ao vivo lê a média já no dia 25", () => {
		const cedo = new Date("2026-10-16T15:00:00-03:00");
		expect(relogioDaPagina("pesquisas", cedo)).toBe(cedo);
		expect(relogioDaPagina("ao_vivo", cedo).getTime()).toBe(ABERTURA_2T_MS);
		expect(relogioDaPagina("encerrada", cedo).getTime()).toBe(ABERTURA_2T_MS);
		const tarde = new Date("2026-10-26T12:00:00-03:00");
		expect(relogioDaPagina("ao_vivo", tarde)).toBe(tarde);
	});
});

describe("paridade com o protótipo da #16", () => {
	const html = () =>
		documentoPesquisas(payload(), AGORA, { apuracao: estado(), historico: HISTORICO });
	const coluna = (doc: string, lado: "esq" | "dir") =>
		doc.match(new RegExp(`<div class="a-noite-${lado}">[\\s\\S]*?<!--/${lado}-->`))?.[0] ?? "";

	it("as estimativas ficam sob o gráfico, não numa seção própria", () => {
		const esq = coluna(html(), "esq");
		const noite = esq.match(/<section class="a-noite"[\s\S]*?<\/section>/)?.[0] ?? "";
		expect(noite).toContain("data-estimativas");
		expect(noite).toContain("Válidos que faltam");
		expect(esq.indexOf("data-estimativas")).toBeLessThan(esq.indexOf("Momentos da noite"));
		expect(esq).not.toContain("<h2>Estimativas</h2>");
	});

	it("grade 2/3 + 1/3: gráfico e momentos à esquerda, pesquisas, exterior e comparecimento à direita", () => {
		const doc = html();
		expect(doc).toContain('class="a-noite-grade"');
		const esq = coluna(doc, "esq");
		const dir = coluna(doc, "dir");
		expect(esq).toContain("a-noite");
		expect(esq).toContain("Momentos da noite");
		expect(dir).toContain("data-pesquisas-noite");
		expect(dir).toContain('data-geo="exterior"');
		expect(dir).toContain('data-geo="comparecimento"');
		expect(dir.indexOf("data-pesquisas-noite")).toBeLessThan(dir.indexOf('data-geo="exterior"'));
	});

	it("ao vivo, a coluna da direita abre com o que as pesquisas diziam", () => {
		const dir = coluna(html(), "dir");
		expect(dir).toContain("O que as pesquisas diziam");
		expect(dir).toContain("51,8");
		expect(dir).not.toMatch(/undefined|NaN/);
	});

	it("não traz mais \"Para onde foram os votos?\"", () => {
		expect(html()).not.toContain("Para onde foram os votos?");
	});
});

describe("gráfico da noite com espaço próprio (#123)", () => {
	it("o plot da noite não herda a grade de eixo Y das pesquisas e ocupa a largura", async () => {
		const css = await (await env.ASSETS.fetch("https://presidente2026.test/css/tres-semanas.css")).text();
		expect(css).toMatch(/\.a-noite \.a-plot\s*\{[^}]*display:\s*block/);
		expect(css).toMatch(/\.a-noite \.a-plot\s*\{[^}]*position:\s*relative/);
		expect(css).toMatch(/\.a-noite \.a-plot\s*\{[^}]*height:\s*\d+px/);
		expect(css).toMatch(/\.a-noite \.a-plot svg\s*\{[^}]*width:\s*100%[^}]*height:\s*100%/);
	});
});

describe("pacote Critiquito (#129)", () => {
	const FIM = Date.parse(PAUSA_TSE.fim);

	async function asset(caminho: string): Promise<string> {
		const res = await env.ASSETS.fetch(`https://presidente2026.test${caminho}`);
		expect(res.status).toBe(200);
		return res.text();
	}

	function regra(css: string, seletor: string): string {
		const escapado = seletor.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
		return css.match(new RegExp(`(?:^|\\n)${escapado}\\s*\\{([^}]*)\\}`))?.[1] ?? "";
	}

	it("B2: com o TSE pausado a faixa diz Pausada, sem o Ao vivo", () => {
		const agora = new Date("2026-10-25T18:00:00-03:00");
		const pausada = htmlFaixa(
			vista({ agora, apuracao: estado({ consultadoEm: agora.getTime() - 120_000, proximaConsulta: FIM }) }),
		);
		expect(pausada).toContain("<strong data-faixa-rotulo>Pausada</strong>");
		expect(pausada).toContain(" data-pausada");
		expect(pausada).not.toContain("Ao vivo");
		expect(pausada).toContain("Apuração do TSE pausada até 19h");

		const depois = new Date("2026-10-25T19:05:00-03:00");
		const viva = htmlFaixa(vista({ agora: depois, apuracao: estado({ consultadoEm: depois.getTime() }) }));
		expect(viva).toContain("<strong data-faixa-rotulo>Ao vivo</strong>");
		expect(viva).not.toContain("data-pausada");
	});

	it("B2: o ponto da pausa é cinza e não pulsa, e o cliente devolve o Ao vivo às 19h", async () => {
		const css = await asset("/css/tres-semanas.css");
		const ponto = regra(css, '.a-faixa[data-pausada] .a-faixa-ponto');
		expect(ponto).toMatch(/background:\s*var\(--suave\)/);
		expect(ponto).toMatch(/animation:\s*none/);
		expect(css.indexOf('.a-faixa[data-pausada] .a-faixa-ponto')).toBeGreaterThan(
			css.indexOf('.a-faixa[data-fase="ao_vivo"] .a-faixa-ponto'),
		);

		const js = await asset("/js/ao-vivo.js");
		expect(js).toContain("[data-faixa-rotulo]");
		expect(js).toMatch(/toggleAttribute\("data-pausada", pausada\)/);
		expect(js).toContain('"Pausada"');
		expect(js).toContain('"Ao vivo"');
	});

	it("W1/W5: no início da noite o plot encolhe e diz quanto já foi apurado", async () => {
		const vazio = htmlGraficoNoite(vista({ historico: [] }));
		expect(vazio).toContain('class="a-graf" data-inicio');
		expect(vazio).toContain('class="a-noite-inicio"');
		expect(vazio).not.toContain("a-graf-vazio");

		const comeco = htmlGraficoNoite(vista({ historico: [leitura(0.25, 55, 45, "17:06:31")] }));
		expect(comeco).toContain('class="a-graf" data-inicio');
		expect(comeco).toContain("0,25% das seções apuradas. A linha cresce a cada leitura do TSE.");

		const poucas = htmlGraficoNoite(
			vista({ historico: [leitura(0.2, 55, 45, "17:06:31"), leitura(0.6, 54, 46, "17:10:00")] }),
		);
		expect(poucas).toContain('class="a-graf" data-inicio');

		const trajetoria = htmlGraficoNoite(vista());
		expect(trajetoria).not.toContain("data-inicio");
		expect(trajetoria).not.toContain("a-noite-inicio");

		const css = await asset("/css/tres-semanas.css");
		expect(regra(css, ".a-noite .a-graf[data-inicio] .a-plot")).toMatch(/height:\s*1\d\dpx/);
	});

	it("W2: válidos que faltam saem inteiros em pt-BR", () => {
		const base = estado();
		const presidente = base.analise!.majoritarias!.presidente!;
		const html = htmlEstimativas(
			vista({
				apuracao: estado({
					analise: {
						...base.analise,
						majoritarias: { presidente: { ...presidente, validosAApurar: 77_710_256.461 } },
					},
				}),
			}),
		);
		expect(html).toContain("<dd>77.710.256</dd>");
		expect(html).not.toContain("77.710.256,461");
	});

	it("W3: os rostos do placar sobem sem mexer no veredito das pesquisas", async () => {
		const css = await asset("/css/tres-semanas.css");
		const placar = regra(css, ".a-placar .a-rosto");
		const largura = Number(placar.match(/width:\s*([\d.]+)em/)?.[1]);
		expect(largura).toBeGreaterThanOrEqual(1.1);
		expect(largura).toBeLessThanOrEqual(1.25);
		expect(placar).toMatch(/height:\s*[\d.]+em/);
		expect(regra(css, ".a-rosto")).toMatch(/width:\s*0\.9em/);
		expect(regra(css, ".a-rosto")).toMatch(/currentColor/);
	});

	it("W4: o cabo da noite engrossa e ganha o rótulo Na urna agora, sem perder a fatia do Flávio (#127)", async () => {
		const cabo = htmlCaboApuracao(vista());
		expect(cabo).toContain('<p class="a-cabo-rotulo">Na urna agora</p>');
		expect(cabo.indexOf("a-cabo-rotulo")).toBeLessThan(cabo.indexOf("a-cabo-linha"));
		expect(cabo).toContain('class="a-cabo-f" style="width:47.06%"');
		expect(cabo).not.toContain("data-base");

		const final = htmlCaboApuracao(
			vista({ fase: "encerrada", apuracao: estado({ fase: "encerrada", encerrada: true }) }),
		);
		expect(final).toContain('<p class="a-cabo-rotulo">Na urna, resultado final</p>');

		const zerado = htmlCaboApuracao(
			vista({
				apuracao: estado({
					cargos: { presidente: cargo({ apurado: 0, candidatos: [candidato("22", 0, 0), candidato("13", 0, 0)] }) },
				}),
			}),
		);
		expect(zerado).toContain('<p class="a-cabo-rotulo">Na urna, ainda sem votos</p>');

		const css = await asset("/css/tres-semanas.css");
		const altura = Number(regra(css, ".a-cabo-trilha .a-cabo").match(/height:\s*(\d+)px/)?.[1]);
		expect(altura).toBeGreaterThanOrEqual(16);
		expect(altura).toBeLessThanOrEqual(18);
		expect(regra(css, ".a-cabo")).toMatch(/height:\s*14px/);
	});

	it("W5: a noite tira ar sob a faixa e sob o H1", async () => {
		const css = await asset("/css/tres-semanas.css");
		const faixa = regra(css, '.a-faixa:not([data-fase="pesquisas"])');
		expect(Number(faixa.match(/margin-bottom:\s*(\d+)px/)?.[1])).toBeLessThanOrEqual(10);
		expect(Number(regra(css, ".a-placar p").match(/margin-top:\s*(\d+)px/)?.[1])).toBeLessThanOrEqual(6);
	});
});
