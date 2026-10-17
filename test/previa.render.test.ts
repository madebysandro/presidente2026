/**
 * Aceite #66: a home declara a prévia que o WhatsApp e o X leem.
 * Seam: documentoPesquisas (HTML público).
 */
import { describe, expect, it } from "vitest";
import { documentoPesquisas } from "../src/pagina/documento";
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
