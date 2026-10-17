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
