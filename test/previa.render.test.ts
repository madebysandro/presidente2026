/**
 * Aceites #66 e #133: a home declara a prévia que o WhatsApp e o X leem.
 * Seam: documentoPesquisas (HTML público).
 */
import { describe, expect, it } from "vitest";
import type { Cargo, EstadoApuracao } from "../src/dominio/tipos";
import { documentoPesquisas, type NoiteDaPagina } from "../src/pagina/documento";
import type { PayloadPesquisas } from "../src/pesquisas/tipos";

const AGORA = new Date("2026-10-15T18:16:00-03:00");
const VERSAO = "202610152116000005184824-d9";

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
			registros: ["BR-02949/2026"],
		},
		serieMedia: [],
		publicadas: [],
		liberadasSemNumero: [],
		vemAi: [],
		...extra,
	};
}

function conteudo(html: string, atributo: string, nome: string): string | undefined {
	const re = new RegExp(`<meta ${atributo}="${nome}" content="([^"]*)"`);
	return html.match(re)?.[1];
}

describe("prévia da home (#66)", () => {
	it("com média, o head leva o placar, a imagem 1200×630 e o card do X", () => {
		const html = documentoPesquisas(payload(), AGORA);
		expect(conteudo(html, "property", "og:title")).toBe("Flávio 51,8% x Lula 48,2% · 2º turno");
		expect(conteudo(html, "property", "og:description")).toBe("Flávio 51,8% x Lula 48,2%");
		expect(conteudo(html, "property", "og:image")).toBe(
			`https://presidente2026.win/og.png?v=${VERSAO}`,
		);
		expect(conteudo(html, "property", "og:image:width")).toBe("1200");
		expect(conteudo(html, "property", "og:image:height")).toBe("630");
		expect(conteudo(html, "property", "og:url")).toBe("https://presidente2026.win/");
		expect(conteudo(html, "property", "og:type")).toBe("website");
		expect(conteudo(html, "property", "og:locale")).toBe("pt_BR");
		expect(conteudo(html, "name", "twitter:card")).toBe("summary_large_image");
		expect(conteudo(html, "name", "twitter:title")).toBe("Flávio 51,8% x Lula 48,2% · 2º turno");
		expect(conteudo(html, "name", "twitter:description")).toBe("Flávio 51,8% x Lula 48,2%");
		expect(conteudo(html, "name", "twitter:image")).toBe(
			`https://presidente2026.win/og.png?v=${VERSAO}`,
		);
	});

	it("a origem do pedido entra na URL da imagem", () => {
		const html = documentoPesquisas(payload(), AGORA, undefined, "http://presidente2026.test");
		expect(conteudo(html, "property", "og:image")).toBe(
			`http://presidente2026.test/og.png?v=${VERSAO}`,
		);
		expect(conteudo(html, "property", "og:url")).toBe("http://presidente2026.test/");
	});

	it("sem média, a descrição é o convite e a versão não carrega placar", () => {
		const html = documentoPesquisas(payload({ media: null }), AGORA);
		expect(conteudo(html, "property", "og:description")).toBe(
			"Acompanhe as pesquisas do 2º turno",
		);
		expect(conteudo(html, "property", "og:title")).toBe("Presidente 2026 · 2º turno");
		expect(conteudo(html, "property", "og:image")).toBe(
			"https://presidente2026.win/og.png?v=sem-d9",
		);
		expect(html).not.toContain("51,8%");
	});
});

function candidato(n: "13" | "22", votos: number, pct: number): Cargo["candidatos"][number] {
	return {
		n,
		nome: n === "22" ? "FLAVIO BOLSONARO" : "LULA",
		partido: n === "22" ? "PL" : "PT",
		agr: n,
		votos,
		pct,
		pos: n === "13" ? 1 : 2,
		eleito: false,
		situacao: "",
		valido: true,
		foto: "",
	};
}

function noite(
	fase: "ao_vivo" | "encerrada",
	lula: number,
	flavio: number,
	apurado: number,
): NoiteDaPagina {
	const cargo: Cargo = {
		id: "presidente",
		titulo: "Presidente",
		local: "Brasil",
		vagas: 1,
		apurado,
		hora: "19:40:00",
		qe: null,
		totais: {
			eleitorado: 10_000_000,
			eleitoradoApurado: 1_000_000,
			comparecimento: 70,
			abstencao: 30,
			validos: 1_000_000,
			legenda: 0,
			brancos: 1,
			nulos: 1,
		},
		candidatos: [
			candidato("22", Math.round(flavio * 10_000), flavio),
			candidato("13", Math.round(lula * 10_000), lula),
		],
	};
	const apuracao: EstadoApuracao = {
		versao: 3,
		consultadoEm: NOITE.getTime() - 60_000,
		proximaConsulta: NOITE.getTime() + 60_000,
		erro: null,
		fase,
		cargos: { presidente: cargo },
	};
	return { apuracao, historico: [] };
}

const NOITE = new Date("2026-10-25T22:42:00.000Z");

describe("prévia da noite (#133)", () => {
	it("ao vivo, título, descrição e card do X levam a apuração, Lula primeiro, com as seções", () => {
		const html = documentoPesquisas(payload(), NOITE, noite("ao_vivo", 50.36, 49.64, 11.66));
		const titulo = "Lula 50,36% x Flávio 49,64% · 2º turno";
		const descricao = "Lula 50,36% x Flávio 49,64% · 11,66% das seções apuradas";
		expect(conteudo(html, "property", "og:title")).toBe(titulo);
		expect(conteudo(html, "name", "twitter:title")).toBe(titulo);
		expect(conteudo(html, "property", "og:description")).toBe(descricao);
		expect(conteudo(html, "name", "twitter:description")).toBe(descricao);
		const imagem = "https://presidente2026.win/og.png?v=ao-5036-4964-1166";
		expect(conteudo(html, "property", "og:image")).toBe(imagem);
		expect(conteudo(html, "name", "twitter:image")).toBe(imagem);
		const head = html.slice(0, html.indexOf("</head>"));
		expect(head).not.toContain("51,8");
		expect(head).not.toContain("48,2");
	});

	it("o ?v= muda quando a apuração muda e não muda à toa", () => {
		const versao = (n: NoiteDaPagina) =>
			conteudo(documentoPesquisas(payload(), NOITE, n), "property", "og:image");
		const antes = versao(noite("ao_vivo", 50.36, 49.64, 11.66));
		expect(versao(noite("ao_vivo", 50.36, 49.64, 11.66))).toBe(antes);
		expect(versao(noite("ao_vivo", 50.36, 49.64, 12.1))).not.toBe(antes);
		expect(versao(noite("ao_vivo", 50.2, 49.8, 11.66))).not.toBe(antes);
		expect(versao(noite("encerrada", 50.36, 49.64, 11.66))).not.toBe(antes);
	});

	it("encerrada, o resultado final em uma casa, Lula primeiro", () => {
		const html = documentoPesquisas(
			payload({ fase: "encerrada" }),
			NOITE,
			noite("encerrada", 50.71, 49.29, 100),
		);
		expect(conteudo(html, "property", "og:title")).toBe("Lula 50,7% x Flávio 49,3% · 2º turno");
		expect(conteudo(html, "property", "og:description")).toBe(
			"Lula 50,7% x Flávio 49,3% · 100,0% das seções apuradas",
		);
		expect(conteudo(html, "property", "og:image")).toBe(
			"https://presidente2026.win/og.png?v=fim-507-493-1000",
		);
	});

	it("ao vivo sem votos ainda, a prévia não volta para a média", () => {
		const zerada = noite("ao_vivo", 0, 0, 0);
		for (const c of zerada.apuracao.cargos.presidente!.candidatos) c.votos = 0;
		const html = documentoPesquisas(payload(), NOITE, zerada);
		expect(conteudo(html, "property", "og:title")).toBe("Presidente 2026 · 2º turno");
		expect(conteudo(html, "property", "og:description")).toBe(
			"Apuração do 2º turno, ainda sem votos",
		);
		expect(conteudo(html, "property", "og:image")).toBe(
			"https://presidente2026.win/og.png?v=ao-sem",
		);
		expect(html.slice(0, html.indexOf("</head>"))).not.toContain("51,8");
	});

	it("em pesquisas, mesmo com a apuração no estado, a prévia segue a média", () => {
		const estado = noite("ao_vivo", 50.36, 49.64, 11.66);
		estado.apuracao.fase = "pesquisas";
		const html = documentoPesquisas(payload(), AGORA, estado);
		expect(conteudo(html, "property", "og:title")).toBe("Flávio 51,8% x Lula 48,2% · 2º turno");
		expect(conteudo(html, "property", "og:image")).toBe(
			`https://presidente2026.win/og.png?v=${VERSAO}`,
		);
	});
});
