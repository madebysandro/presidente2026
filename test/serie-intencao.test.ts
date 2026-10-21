import { describe, expect, it } from "vitest";
import { serieIntencao } from "../public/js/intencao.mjs";
import { serieIntencaoDe } from "../src/pesquisas/media";
import type { PesquisaPublicada } from "../src/pesquisas/tipos";

function pesquisa(
	parcial: Pick<PesquisaPublicada, "registro" | "cnpj" | "campoFim" | "margem"> &
		Partial<PesquisaPublicada> & { flavio: number; lula: number },
): PesquisaPublicada {
	const { flavio, lula, ...resto } = parcial;
	return {
		instituto: "Instituto",
		contratantes: ["recursos próprios"],
		campoInicio: parcial.campoFim,
		liberacao: parcial.campoFim,
		liberacaoEfetiva: parcial.campoFim,
		entrevistas: 1000,
		confianca: 95,
		totais: { flavio, lula, brancoNulo: null, naoSabe: null, brancoNuloNaoSabe: null },
		validosPublicados: null,
		vf: 0,
		vl: 0,
		v: 0,
		fonte: "https://exemplo.test/pesquisa",
		cadastradoEm: "2026-10-10T12:00:00.000Z",
		substituidoEm: null,
		...resto,
	};
}

const A = pesquisa({
	registro: "BR-00001/2026",
	cnpj: "11111111000111",
	instituto: "Alfa",
	campoFim: "2026-10-10",
	margem: 2,
	flavio: 60,
	lula: 40,
});

const B = pesquisa({
	registro: "BR-00002/2026",
	cnpj: "22222222000122",
	instituto: "Beta",
	campoFim: "2026-10-12",
	margem: 4,
	flavio: 40,
	lula: 60,
});

describe("série diária de intenção", () => {
	it("começa na primeira pesquisa e repete a média nos dias sem pesquisa nova", () => {
		expect(serieIntencaoDe([A], "2026-10-12")).toEqual([
			{ data: "2026-10-10", vf: 60, vl: 40, margem: 2, n: 1 },
			{ data: "2026-10-11", vf: 60, vl: 40, margem: 2, n: 1 },
			{ data: "2026-10-12", vf: 60, vl: 40, margem: 2, n: 1 },
		]);
	});

	it("no dia em que entra o segundo instituto, Lula é o complemento de Flávio e a faixa usa a margem média", () => {
		expect(serieIntencaoDe([B, A], "2026-10-12")).toEqual([
			{ data: "2026-10-10", vf: 60, vl: 40, margem: 2, n: 1 },
			{ data: "2026-10-11", vf: 60, vl: 40, margem: 2, n: 1 },
			{ data: "2026-10-12", vf: 50, vl: 50, margem: 3, n: 2 },
		]);
	});

	it("arredonda a média dos válidos em duas casas e a margem média em uma", () => {
		const impar = pesquisa({
			registro: "BR-00003/2026",
			cnpj: "33333333000133",
			campoFim: "2026-10-10",
			margem: 1.8,
			flavio: 1,
			lula: 2,
		});
		expect(serieIntencaoDe([A, impar], "2026-10-10")).toEqual([
			{ data: "2026-10-10", vf: 46.67, vl: 53.33, margem: 1.9, n: 2 },
		]);
	});

	it("do mesmo instituto fica só a pesquisa mais recente", () => {
		const antiga = pesquisa({
			registro: "BR-00004/2026",
			cnpj: A.cnpj,
			campoFim: "2026-10-01",
			margem: 2,
			flavio: 10,
			lula: 90,
		});
		const recente = pesquisa({
			registro: "BR-00005/2026",
			cnpj: A.cnpj,
			campoFim: "2026-10-10",
			margem: 2,
			flavio: 60,
			lula: 40,
		});
		const noDia = serieIntencaoDe([recente, antiga], "2026-10-10").find(
			(ponto) => ponto.data === "2026-10-10",
		);
		expect(noDia).toEqual({ data: "2026-10-10", vf: 60, vl: 40, margem: 2, n: 1 });
	});

	it("pula o dia em que a pesquisa saiu da janela de 14 dias e a próxima ainda não entrou", () => {
		const antiga = pesquisa({
			registro: "BR-00004/2026",
			cnpj: "44444444000144",
			campoFim: "2026-10-01",
			margem: 2,
			flavio: 10,
			lula: 90,
		});
		const seguinte = pesquisa({
			registro: "BR-00005/2026",
			cnpj: "55555555000155",
			campoFim: "2026-10-20",
			margem: 2,
			flavio: 60,
			lula: 40,
		});
		const serie = serieIntencaoDe([seguinte, antiga], "2026-10-20");
		expect(serie.find((ponto) => ponto.data === "2026-10-14")?.vf).toBe(10);
		expect(serie.find((ponto) => ponto.data === "2026-10-15")).toBeUndefined();
		expect(serie.at(-1)).toEqual({ data: "2026-10-20", vf: 60, vl: 40, margem: 2, n: 1 });
	});

	it("sem pesquisa, ou com a data de referência antes do campo, não há série", () => {
		expect(serieIntencaoDe([], "2026-10-12")).toEqual([]);
		expect(serieIntencaoDe([A], "2026-10-09")).toEqual([]);
	});

	it("o recálculo no navegador acompanha a série do servidor", () => {
		const cliente = (lista: readonly PesquisaPublicada[]) =>
			lista.map((pesquisa) => ({
				registro: pesquisa.registro,
				cnpj: pesquisa.cnpj,
				campoFim: pesquisa.campoFim,
				margem: pesquisa.margem,
				flavio: pesquisa.totais.flavio,
				lula: pesquisa.totais.lula,
			}));
		expect(serieIntencao(cliente([B, A]), "2026-10-12")).toEqual(
			serieIntencaoDe([B, A], "2026-10-12"),
		);
		const impar = pesquisa({
			registro: "BR-00003/2026",
			cnpj: "33333333000133",
			campoFim: "2026-10-10",
			margem: 1.8,
			flavio: 1,
			lula: 2,
		});
		expect(serieIntencao(cliente([A, impar]), "2026-10-10")).toEqual(
			serieIntencaoDe([A, impar], "2026-10-10"),
		);
	});
});
