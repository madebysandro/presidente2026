/**
 * Aceite #20: resultado final, selo, análise e Pesquisas × urnas.
 * Seam: o HTML que a página e o fragmento devolvem.
 */
import { describe, expect, it } from "vitest";
import type { Cargo, EstadoApuracao, FechamentoEncerrada } from "../src/dominio/tipos";
import { htmlFaixa, htmlPlacar, type VistaNoite } from "../src/pagina/ao-vivo";
import { htmlAnaliseFinal, htmlPesquisasUrnas } from "../src/pagina/encerrada";
import { documentoPesquisas } from "../src/pagina/documento";
import type { PayloadPesquisas, PesquisaPublicada } from "../src/pesquisas/tipos";

const AGORA = new Date("2026-10-25T22:00:00.000Z");

function pesquisa(parcial: Partial<PesquisaPublicada> & Pick<PesquisaPublicada, "registro" | "instituto" | "v">): PesquisaPublicada {
	return {
		cnpj: "00000000000000",
		contratantes: ["recursos próprios"],
		campoInicio: "2026-10-20",
		campoFim: "2026-10-24",
		liberacao: "2026-10-24",
		liberacaoEfetiva: "2026-10-24",
		entrevistas: 2000,
		margem: 2,
		confianca: 95,
		totais: { flavio: 50, lula: 50, brancoNulo: null, naoSabe: null, brancoNuloNaoSabe: null },
		validosPublicados: null,
		vf: 50,
		vl: 50,
		fonte: "https://exemplo.test/pesquisa",
		cadastradoEm: "2026-10-24T18:00:00.000Z",
		substituidoEm: null,
		...parcial,
	};
}

function payload(extra: Partial<PayloadPesquisas> = {}): PayloadPesquisas {
	return {
		hoje: "2026-10-25",
		fase: "encerrada",
		atualizadoEm: "2026-10-25T22:00:00.000Z",
		registroTse: { geradoEm: null, etag: null },
		media: {
			data: "2026-10-25",
			vf: 53.12,
			vl: 46.88,
			v: 6.23,
			n: 4,
			margem: 2,
			registros: ["BR-2", "BR-1", "BR-3", "BR-4"],
		},
		serieMedia: [],
		publicadas: [
			pesquisa({ registro: "BR-1", instituto: "Datafolha", v: 8.2, vf: 54.1, vl: 45.9 }),
			pesquisa({ registro: "BR-2", instituto: "Quaest", v: -3.4, vf: 48.3, vl: 51.7 }),
			pesquisa({ registro: "BR-3", instituto: "PoderData", v: 12, vf: 56, vl: 44 }),
			pesquisa({ registro: "BR-4", instituto: "AtlasIntel", v: 0, vf: 50, vl: 50 }),
			pesquisa({ registro: "BR-9", instituto: "Fora da média", v: 0.5, vf: 50.25, vl: 49.75 }),
		],
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
		apurado: 100,
		hora: "22:10:00",
		qe: null,
		totais: {
			eleitorado: 10_000_000,
			eleitoradoApurado: 10_000_000,
			comparecimento: 78.916358094,
			abstencao: 21.083641906,
			validos: 8_000_000,
			legenda: 0,
			brancos: 1.836585643,
			nulos: 2.94,
		},
		candidatos: [candidato("13", 4_500_000, 45), candidato("22", 5_500_000, 55)],
		...parcial,
	};
}

function fechamento(parcial: Partial<FechamentoEncerrada> = {}): FechamentoEncerrada {
	return {
		comparecimento: 78.916358094,
		comparecimento1t: 70.04,
		abstencao: 21.083641906,
		abstencao1t: 29.96,
		brancos: 1.836585643,
		brancos1t: 2.04,
		nulos: 2.94,
		nulos1t: 3.94,
		viradas: 2,
		...parcial,
	};
}

function estado(extra: Partial<EstadoApuracao> = {}): EstadoApuracao {
	return {
		versao: 4,
		consultadoEm: AGORA.getTime() - 60_000,
		proximaConsulta: null,
		erro: null,
		fase: "encerrada",
		encerrada: true,
		cargos: { presidente: cargo() },
		analise: { fechamento: fechamento(), viradas: [] },
		...extra,
	};
}

function vista(extra: Partial<VistaNoite> = {}): VistaNoite {
	return {
		fase: "encerrada",
		agora: AGORA,
		pesquisas: payload(),
		apuracao: estado(),
		historico: [],
		...extra,
	};
}

function secaoUrnas(html: string): string {
	return html.match(/<section[^>]*data-pesquisas-urnas[\s\S]*?<\/section>/)?.[0] ?? "";
}

describe("resultado final (#20)", () => {
	it("encerrada carimba o resultado e põe ✓ Eleito só no lado com mais votos", () => {
		const faixa = htmlFaixa(vista());
		expect(faixa).toContain("Resultado final · 2º turno");
		expect(faixa).toContain("Encerrada");
		expect(faixa).not.toContain("Próxima consulta");
		expect(faixa).not.toContain("Ao vivo");
		expect(faixa).not.toContain("Aguardando 17h");

		const placar = htmlPlacar(vista());
		const h1 = placar.match(/<h1[\s\S]*?<\/h1>/)?.[0] ?? "";
		const lula = h1.split('class="a-x"')[0] ?? "";
		const flavio = h1.split('class="a-x"')[1] ?? "";
		expect(flavio).toContain('data-eleito="22"');
		expect(flavio).toContain("✓ Eleito");
		expect(flavio).toContain("55,0%");
		expect(flavio).not.toContain("55,00%");
		expect(placar).toContain("100,0% das seções");
		expect(lula).not.toContain("data-eleito");
		expect(lula).not.toContain("✓ Eleito");
		expect(placar).not.toMatch(/undefined|NaN/);

		const lulaNaFrente = htmlPlacar(
			vista({
				apuracao: estado({
					cargos: {
						presidente: cargo({
							candidatos: [candidato("13", 6_000_000, 60), candidato("22", 4_000_000, 40)],
						}),
					},
				}),
			}),
		);
		const h1Lula = lulaNaFrente.match(/<h1[\s\S]*?<\/h1>/)?.[0] ?? "";
		expect(h1Lula.split('class="a-x"')[0]).toContain('data-eleito="13"');
		expect(h1Lula.split('class="a-x"')[1]).not.toContain("✓ Eleito");

		const empate = htmlPlacar(
			vista({
				apuracao: estado({
					cargos: {
						presidente: cargo({
							candidatos: [candidato("22", 5_000_000, 50), candidato("13", 5_000_000, 50)],
						}),
					},
				}),
			}),
		);
		expect(empate).not.toContain("✓ Eleito");
		expect(empate).not.toContain("data-eleito");
	});

	it("placar espelha o Flávio: foto depois do nome e do %, na borda direita (#141)", () => {
		const aoVivo = vista({
			fase: "ao_vivo",
			apuracao: estado({ fase: "ao_vivo", encerrada: false, proximaConsulta: AGORA.getTime() + 60_000 }),
		});
		const h1 = htmlPlacar(aoVivo).match(/<h1[\s\S]*?<\/h1>/)?.[0] ?? "";
		const [lula = "", flavio = ""] = h1.split('class="a-x"');
		expect(lula.indexOf("a-rosto")).toBeLessThan(lula.indexOf("<b>"));
		expect(flavio.indexOf("a-rosto")).toBeGreaterThan(flavio.indexOf("<b>"));
		expect(flavio.trimEnd()).toMatch(/<img class="a-rosto"[^>]*><\/span><\/h1>$/);
	});

	it("ao vivo e pesquisas não mostram o carimbo nem o selo", () => {
		const aoVivo = vista({
			fase: "ao_vivo",
			apuracao: estado({ fase: "ao_vivo", encerrada: false, proximaConsulta: AGORA.getTime() + 60_000 }),
		});
		expect(htmlFaixa(aoVivo)).not.toContain("Resultado final");
		expect(htmlPlacar(aoVivo)).not.toContain("✓ Eleito");
		expect(htmlAnaliseFinal(aoVivo)).toBe("");
		expect(htmlPesquisasUrnas(aoVivo)).toBe("");

		const pesquisas = documentoPesquisas(
			payload({ fase: "pesquisas", hoje: "2026-10-16", media: null, publicadas: [] }),
			new Date("2026-10-16T15:00:00-03:00"),
		);
		expect(pesquisas).toContain("até a votação");
		expect(pesquisas).not.toContain("Resultado final");
		expect(pesquisas).not.toContain("✓ Eleito");
		expect(pesquisas).not.toContain("data-pesquisas-urnas");
		expect(pesquisas).not.toContain("data-analise-final");
	});
});

describe("análise final (#20)", () => {
	it("mostra comparecimento, brancos, nulos e viradas com 1 casa em pt-BR", () => {
		const html = htmlAnaliseFinal(vista());
		expect(html).toContain("Comparecimento");
		expect(html).toContain("78,9%");
		expect(html).toContain("1º turno 70,0%");
		expect(html).toContain("Brancos");
		expect(html).toContain("1,8%");
		expect(html).toContain("1º turno 2,0%");
		expect(html).toContain("Nulos");
		expect(html).toContain("2,9%");
		expect(html).toContain("1º turno 3,9%");
		expect(html).toContain("Viradas");
		expect(html).toContain(">2<");
		expect(html).not.toContain("78,92");
		expect(html).not.toContain("1,84");
		expect(html).not.toMatch(/undefined|NaN/);
	});

	it("sem fechamento não inventa percentual", () => {
		const html = htmlAnaliseFinal(
			vista({ apuracao: estado({ analise: { fechamento: null } }) }),
		);
		expect(html).toContain("data-analise-final");
		expect(html).not.toMatch(/\d,\d%/);
		expect(html).not.toMatch(/undefined|NaN/);
	});
});

describe("pesquisas × urnas (#20)", () => {
	it("lista a última pesquisa de cada instituto da média, ordenada pelo módulo do erro, e a linha da média", () => {
		const html = htmlPesquisasUrnas(vista());
		const secao = secaoUrnas(html);
		const institutos = [...secao.matchAll(/data-instituto="([^"]+)"/g)].map((m) => m[1]);
		expect(institutos).toEqual(["Datafolha", "PoderData", "AtlasIntel", "Quaest"]);
		expect(secao).not.toContain("Fora da média");
		expect(secao).toContain("25 de outubro");
		expect(secao).toContain('data-linha="media"');
		expect(secao.indexOf('data-linha="media"')).toBeGreaterThan(secao.lastIndexOf("data-instituto"));

		const linha = (nome: string) =>
			secao.match(new RegExp(`<li[^>]*data-instituto="${nome}"[\\s\\S]*?</li>`))?.[0] ?? "";
		expect(linha("Datafolha")).toContain("−1,8 p.p.");
		expect(linha("Datafolha")).toContain('data-acertou="1"');
		expect(linha("Datafolha")).toContain("acertou o vencedor");
		expect(linha("PoderData")).toContain("+2,0 p.p.");
		expect(linha("PoderData")).toContain('data-acertou="1"');
		expect(linha("AtlasIntel")).toContain("−10,0 p.p.");
		expect(linha("AtlasIntel")).toContain('data-acertou="0"');
		expect(linha("AtlasIntel")).toContain("não acertou o vencedor");
		expect(linha("Quaest")).toContain("−13,4 p.p.");
		expect(linha("Quaest")).toContain('data-acertou="0"');

		const media = secao.match(/<li[^>]*data-linha="media"[\s\S]*?<\/li>/)?.[0] ?? "";
		expect(media).toContain("Média");
		expect(media).toContain("−3,8 p.p.");
		expect(media).toContain('data-acertou="1"');
		expect(secao).not.toMatch(/undefined|NaN/);
	});

	it("com votos empatados ninguém acertou o vencedor", () => {
		const html = htmlPesquisasUrnas(
			vista({
				apuracao: estado({
					cargos: {
						presidente: cargo({
							candidatos: [candidato("22", 5_000_000, 50), candidato("13", 5_000_000, 50)],
						}),
					},
				}),
			}),
		);
		const secao = secaoUrnas(html);
		expect(secao).not.toContain('data-acertou="1"');
		expect(secao).toContain("não acertou o vencedor");
	});

	it("sem média final não inventa erro", () => {
		const html = htmlPesquisasUrnas(vista({ pesquisas: payload({ media: null, publicadas: [] }) }));
		const secao = secaoUrnas(html);
		expect(secao).toContain("Pesquisas × urnas");
		expect(secao).not.toContain("data-erro");
		expect(secao).not.toContain("p.p.");
		expect(secao).not.toMatch(/undefined|NaN/);
	});
});

describe("página encerrada (#20)", () => {
	it("junta o resultado final e não mistura a fase de pesquisas nem as estimativas de virada", () => {
		const html = documentoPesquisas(payload(), AGORA, {
			apuracao: estado(),
			historico: [],
		});
		expect(html).toContain('data-fase="encerrada"');
		expect(html).toContain("Resultado final · 2º turno");
		expect(html).toContain('data-eleito="22"');
		expect(html).toContain("data-analise-final");
		expect(html).toContain("Pesquisas × urnas");
		expect(html).toContain("−1,8 p.p.");
		expect(html).not.toContain("data-estimativas");
		expect(html).not.toContain("até a votação");
		expect(html).not.toContain("Para virar");
		expect(secaoUrnas(html)).not.toContain("Fora da média");
		expect(html.indexOf("data-analise-final")).toBeLessThan(html.indexOf("data-pesquisas-urnas"));
		expect(html).not.toMatch(/undefined|NaN/);
	});
});
