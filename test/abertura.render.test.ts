/**
 * Aceite #13: a página entrega à vinheta a média de cada dia liberado,
 * com os números calculados dos totais (não copiados do atributo).
 */
import { env } from "cloudflare:workers";
import { describe, expect, it } from "vitest";
import { documentoPesquisas } from "../src/pagina/documento";
import type { PayloadPesquisas, PesquisaPublicada } from "../src/pesquisas/tipos";

const AGORA = new Date("2026-10-16T12:00:00-03:00");

function publicada(
	parcial: Pick<PesquisaPublicada, "registro" | "instituto" | "cnpj" | "campoFim" | "liberacaoEfetiva"> &
		Partial<PesquisaPublicada>,
): PesquisaPublicada {
	return {
		contratantes: ["recursos próprios"],
		campoInicio: "2026-10-06",
		liberacao: parcial.liberacaoEfetiva,
		entrevistas: 2000,
		margem: 2,
		confianca: 95,
		totais: { flavio: 49, lula: 45, brancoNulo: 5, naoSabe: 1, brancoNuloNaoSabe: null },
		validosPublicados: null,
		vf: 52.13,
		vl: 47.87,
		v: 4.26,
		fonte: "https://www.poder360.com.br/pesquisa",
		cadastradoEm: "2026-10-16T12:00:00.000Z",
		substituidoEm: null,
		...parcial,
	};
}

const DATAFOLHA = publicada({
	registro: "BR-02949/2026",
	instituto: "Datafolha",
	cnpj: "111",
	campoFim: "2026-10-08",
	liberacaoEfetiva: "2026-10-08",
	totais: { flavio: 49, lula: 45, brancoNulo: 5, naoSabe: 1, brancoNuloNaoSabe: null },
});

const QUAEST = publicada({
	registro: "BR-08729/2026",
	instituto: "Quaest",
	cnpj: "222",
	campoInicio: "2026-10-10",
	campoFim: "2026-10-13",
	liberacaoEfetiva: "2026-10-14",
	totais: { flavio: 46, lula: 44, brancoNulo: 9, naoSabe: 1, brancoNuloNaoSabe: null },
	vf: 51.11,
	vl: 48.89,
	v: 2.22,
});

function payload(): PayloadPesquisas {
	return {
		hoje: "2026-10-16",
		fase: "pesquisas",
		atualizadoEm: "2026-10-16T15:00:00.000Z",
		registroTse: { geradoEm: null, etag: null },
		media: {
			data: "2026-10-16",
			vf: 51.62,
			vl: 48.38,
			v: 3.24,
			n: 2,
			margem: 2,
			registros: [DATAFOLHA.registro, QUAEST.registro],
		},
		serieMedia: [],
		publicadas: [DATAFOLHA, QUAEST],
		liberadasSemNumero: [],
		vemAi: [],
	};
}

function abertura(html: string): {
	passos: { data: string; vf: number; vl: number; n: number }[];
	vf: number;
	n: number;
} {
	const bruto = html.match(/data-abertura="([^"]*)"/)?.[1] ?? "";
	const json = bruto
		.replaceAll("&quot;", '"')
		.replaceAll("&lt;", "<")
		.replaceAll("&gt;", ">")
		.replaceAll("&amp;", "&");
	return JSON.parse(json) as {
		passos: { data: string; vf: number; vl: number; n: number }[];
		vf: number;
		n: number;
	};
}

describe("dados da vinheta (#13)", () => {
	it("no dia da Datafolha a média é 49 a 45; no dia da Quaest entra o segundo instituto", () => {
		const dados = abertura(documentoPesquisas(payload(), AGORA));
		expect(dados.passos).toEqual([
			{ data: "2026-10-08", vf: 52.13, vl: 47.87, n: 1 },
			{ data: "2026-10-14", vf: 51.62, vl: 48.38, n: 2 },
		]);
		expect(dados.vf).toBe(51.62);
		expect(dados.n).toBe(2);
	});

	it("a página aponta o movimento e a faixa do cabo guarda a margem", () => {
		const html = documentoPesquisas(payload(), AGORA);
		expect(html).toContain("/js/movimento.js");
		expect(html).toContain('data-base="51.62"');
		expect(html).toContain('data-margem="2"');
		expect(html).toContain("280002551544.jpeg");
		expect(html).toContain("280002542548.jpeg");
		expect(html).not.toMatch(/undefined|NaN/);
	});

	it("o css reserva a calha da barra de rolagem", async () => {
		const cssRes = await env.ASSETS.fetch("https://presidente2026.test/css/tres-semanas.css");
		expect(cssRes.status).toBe(200);
		const css = await cssRes.text();
		expect(css).toMatch(/scrollbar-gutter:\s*stable/);
		expect(css).toContain(".a-i-ia");
		expect(css).toMatch(/prefers-reduced-motion:\s*reduce/);
	});
});
