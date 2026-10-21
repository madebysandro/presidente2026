import { describe, expect, it } from "vitest";
import { confirmarHtml } from "../src/pesquisas/ler-fonte";

const totais = { flavio: 46, lula: 41 };
const soFutura = "<p>Futura: Flávio 46%, Lula 41%.</p>";

describe("apelido Futura na confirmação da fonte", () => {
	it("BR-00650/2026 confirma quando a página cita só Futura", () => {
		expect(confirmarHtml(soFutura, "BR-00650/2026", "100% Cidades", totais, null)).toBe(true);
	});

	it("BR-03764/2026 confirma quando a página cita só Futura", () => {
		expect(confirmarHtml(soFutura, "BR-03764/2026", "100% Cidades", totais, null)).toBe(true);
	});

	it("outro registro do 100% Cidades recusa página que cita só Futura", () => {
		expect(confirmarHtml(soFutura, "BR-06715/2026", "100% Cidades", totais, null)).toBe(false);
	});

	it("página que cita 100% Cidades continua confirmando", () => {
		const cidades = "<p>100% Cidades: Flávio 46%, Lula 41%.</p>";
		expect(confirmarHtml(cidades, "BR-06715/2026", "100% Cidades", totais, null)).toBe(true);
		expect(confirmarHtml(cidades, "BR-00650/2026", "100% Cidades", totais, null)).toBe(true);
		expect(confirmarHtml(cidades, "BR-03764/2026", "100% Cidades", totais, null)).toBe(true);
	});

	it("Datafolha segue exigindo o próprio nome e ignora Futura", () => {
		const datafolha = { flavio: 49, lula: 45 };
		expect(
			confirmarHtml("<p>Datafolha 49% e 45%</p>", "BR-02949/2026", "Datafolha", datafolha, null),
		).toBe(true);
		expect(
			confirmarHtml("<p>Futura 49% e 45%</p>", "BR-02949/2026", "Datafolha", datafolha, null),
		).toBe(false);
	});

	it("Futura sem o par de números não confirma nem nos registros da exceção", () => {
		expect(
			confirmarHtml("<p>Pesquisa Futura divulgada hoje.</p>", "BR-00650/2026", "100% Cidades", totais, null),
		).toBe(false);
	});

	it("futuramente e futuras não contam como o nome Futura", () => {
		expect(
			confirmarHtml(
				"<p>O instituto divulga futuramente: Flávio 46%, Lula 41%.</p>",
				"BR-00650/2026",
				"100% Cidades",
				totais,
				null,
			),
		).toBe(false);
		expect(
			confirmarHtml(
				"<p>Eleições futuras: Flávio 46%, Lula 41%.</p>",
				"BR-03764/2026",
				"100% Cidades",
				totais,
				null,
			),
		).toBe(false);
	});
});

const validosFranca = { flavio: 50.8, lula: 49.2 };
const soFranca = "<p>França: Flávio 50,8% contra 49,2% de Lula em votos válidos.</p>";

describe("apelido França na confirmação da fonte", () => {
	it("BR-07896/2026 confirma quando a página cita só França", () => {
		expect(
			confirmarHtml(soFranca, "BR-07896/2026", "Instituto Franca", { flavio: 0, lula: 0 }, validosFranca),
		).toBe(true);
	});

	it("BR-07896/2026 confirma quando a página cita só Franca sem acento", () => {
		const semAcento = "<p>Franca: Flávio 50,8% e Lula 49,2%.</p>";
		expect(
			confirmarHtml(semAcento, "BR-07896/2026", "Instituto Franca", { flavio: 0, lula: 0 }, validosFranca),
		).toBe(true);
	});

	it("outro registro recusa página que cita só França", () => {
		expect(confirmarHtml(soFranca, "BR-00650/2026", "100% Cidades", totais, null)).toBe(false);
	});

	it("página que cita Instituto Franca continua confirmando", () => {
		const instituto = "<p>Instituto Franca: Flávio 50,8%, Lula 49,2%.</p>";
		expect(
			confirmarHtml(instituto, "BR-07896/2026", "Instituto Franca", { flavio: 0, lula: 0 }, validosFranca),
		).toBe(true);
	});
});

const totaisIdeia = { flavio: 46, lula: 41 };
const soMeioIdeia = "<p>Meio/Ideia: Flávio 46%, Lula 41%.</p>";
const institutoBoasIdeias = "Boas Ideias, Estrategia E Inteligencia Digital.";

describe("apelido Ideia na confirmação da fonte", () => {
	it("BR-08251/2026 confirma quando a página cita só Meio/Ideia", () => {
		expect(
			confirmarHtml(soMeioIdeia, "BR-08251/2026", institutoBoasIdeias, totaisIdeia, null),
		).toBe(true);
	});

	it("outro registro recusa página que cita só Meio/Ideia", () => {
		expect(
			confirmarHtml(soMeioIdeia, "BR-00650/2026", institutoBoasIdeias, totaisIdeia, null),
		).toBe(false);
	});
});
