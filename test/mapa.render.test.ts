/**
 * Aceite #131: mapa do Brasil por UF no ao vivo.
 * Seam: o HTML que a página e o fragmento devolvem, os assets do cliente e o tom compartilhado.
 */
import { env } from "cloudflare:workers";
import { describe, expect, it } from "vitest";
import { tomDaUf } from "../public/js/mapa-tom.mjs";
import type { Cargo, EstadoApuracao, UfPresidente } from "../src/dominio/tipos";
import type { VistaNoite } from "../src/pagina/ao-vivo";
import { documentoPesquisas, fragmentoPagina } from "../src/pagina/documento";
import { htmlMapaBrasil } from "../src/pagina/mapa";
import type { PayloadPesquisas } from "../src/pesquisas/tipos";

const AGORA = new Date("2026-10-25T22:30:00.000Z");

function payload(extra: Partial<PayloadPesquisas> = {}): PayloadPesquisas {
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
		...extra,
	};
}

function uf(sigla: string, nome: string, votos22: number, votos13: number, apurado: number): UfPresidente {
	const validos = votos22 + votos13;
	const pct = (v: number) => (validos > 0 ? (v / validos) * 100 : 0);
	return {
		uf: sigla,
		nome,
		hora: "19:30:00",
		apurado,
		secoes: 1000,
		secoesApuradas: Math.round(apurado * 10),
		eleitorado: 100_000,
		validos,
		comparecimento: 70,
		candidatos: [
			{ n: "22", nome: "FLAVIO BOLSONARO", votos: votos22, pct: pct(votos22) },
			{ n: "13", nome: "LULA", votos: votos13, pct: pct(votos13) },
		],
	};
}

function cargo(): Cargo {
	const c = (n: string, votos: number, pct: number) => ({
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
	});
	return {
		id: "presidente",
		titulo: "Presidente",
		local: "Brasil",
		vagas: 1,
		apurado: 48,
		hora: "19:30:00",
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
		candidatos: [c("22", 4_000_000, 47.06), c("13", 4_500_000, 52.94)],
	};
}

const UFS: Record<string, UfPresidente> = {
	sp: uf("sp", "São Paulo", 5_230, 4_770, 12.5),
	ba: uf("ba", "Bahia", 2_800, 7_200, 30),
	mg: uf("mg", "Minas Gerais", 0, 0, 0),
	zz: uf("zz", "Exterior", 400, 600, 57),
};

function estado(extra: Partial<EstadoApuracao> = {}): EstadoApuracao {
	return {
		versao: 3,
		consultadoEm: AGORA.getTime() - 60_000,
		proximaConsulta: AGORA.getTime() + 60_000,
		erro: null,
		fase: "ao_vivo",
		encerrada: false,
		cargos: { presidente: cargo() },
		ufs: UFS,
		...extra,
	};
}

function vista(extra: Partial<VistaNoite> = {}): VistaNoite {
	return {
		fase: "ao_vivo",
		agora: AGORA,
		pesquisas: payload(),
		apuracao: estado(),
		historico: [],
		...extra,
	};
}

function caminho(html: string, sigla: string): string {
	return html.match(new RegExp(`<path[^>]*data-uf="${sigla}"[^>]*>`))?.[0] ?? "";
}

async function asset(caminhoAsset: string): Promise<string> {
	const res = await env.ASSETS.fetch(`https://presidente2026.test${caminhoAsset}`);
	expect(res.status).toBe(200);
	return res.text();
}

describe("tom de cada UF (#131)", () => {
	it("sem votos a UF fica neutra", () => {
		expect(tomDaUf(UFS.mg)).toMatchObject({ lado: null, pctLider: null });
		expect(tomDaUf(undefined)).toMatchObject({ lado: null, pctLider: null });
	});

	it("o líder é quem tem mais votos e o tom cresce com a vantagem", () => {
		const sp = tomDaUf(UFS.sp);
		const ba = tomDaUf(UFS.ba);
		expect(sp.lado).toBe("f");
		expect(sp.pctLider).toBeCloseTo(52.3, 5);
		expect(ba.lado).toBe("l");
		expect(ba.pctLider).toBeCloseTo(72, 5);
		expect(ba.tom).toBeGreaterThan(sp.tom);
		expect(sp.tom).toBeGreaterThanOrEqual(40);
		expect(ba.tom).toBeLessThanOrEqual(100);
		expect(tomDaUf(uf("rr", "Roraima", 9_000, 1_000, 5)).tom).toBe(100);
	});

	it("empate com votos não pinta ninguém", () => {
		expect(tomDaUf(uf("ac", "Acre", 500, 500, 3)).lado).toBe("empate");
	});
});

describe("mapa do Brasil no ao vivo (#131)", () => {
	it("desenha as 27 UFs, sem o exterior", () => {
		const html = htmlMapaBrasil(vista());
		expect(html.match(/<path[^>]*class="a-br-uf/g)).toHaveLength(27);
		expect(html).not.toContain('data-uf="zz"');
		expect(html).toContain("data-mapa-br");
		expect(html).not.toMatch(/undefined|NaN/);
	});

	it("pinta cada UF com o token de quem lidera e deixa neutra a UF sem seções", () => {
		const html = htmlMapaBrasil(vista());
		expect(caminho(html, "sp")).toContain("a-br-f");
		expect(caminho(html, "ba")).toContain("a-br-l");
		expect(caminho(html, "mg")).toContain("a-br-vazio");
		expect(caminho(html, "rs")).toContain("a-br-vazio");
		expect(caminho(html, "sp")).toMatch(/style="--t:\d+%"/);
	});

	it("cada UF tem sigla e % do líder, e o detalhe vai em atributos e no aria-label, Lula primeiro", () => {
		const html = htmlMapaBrasil(vista());
		const sp = caminho(html, "sp");
		expect(sp).toContain('aria-label="São Paulo: Lula 47,70%, Flávio 52,30%, 12,50% apurado"');
		expect(sp).toContain('data-pct-f="52.30"');
		expect(sp).toContain('data-pct-l="47.70"');
		expect(sp).toContain('data-apurado="12.50"');
		expect(sp).toContain('data-votos-f="5230"');
		expect(sp).toContain('tabindex="0"');
		expect(html).toMatch(/<text[^>]*data-rotulo="sp"[^>]*><tspan class="a-br-s"[^>]*>SP<\/tspan><tspan class="a-br-p"[^>]*>52%<\/tspan>/);
		expect(caminho(html, "mg")).toContain("Minas Gerais: sem seções apuradas");
	});

	it("conta as UFs lideradas com Lula à esquerda e Flávio à direita, e cita a fonte do contorno", () => {
		const html = htmlMapaBrasil(vista());
		const conta = html.match(/<div class="a-br-conta">[\s\S]*?<\/div><\/div>/)?.[0] ?? "";
		expect(conta).toContain('<strong data-mapa-n="l">1</strong>');
		expect(conta).toContain('<strong data-mapa-n="f">1</strong>');
		expect(conta.indexOf('data-mapa-n="l"')).toBeLessThan(conta.indexOf('data-mapa-n="f"'));
		const legenda = html.match(/<p class="a-br-leg">[\s\S]*?<\/p>/)?.[0] ?? "";
		expect(legenda.indexOf("Lula lidera")).toBeGreaterThanOrEqual(0);
		expect(legenda.indexOf("Lula lidera")).toBeLessThan(legenda.indexOf("Flávio lidera"));
		expect(legenda).toContain("click_that_hood");
		expect(html).toContain("vantagem");
	});

	it("o mapa e o painel lateral com contagem, detalhe e legenda ficam lado a lado na mesma seção", () => {
		const html = htmlMapaBrasil(vista());
		expect(html).toMatch(/^<section class="a-geo a-br" data-mapa-br/);
		expect(html.indexOf('class="a-br-quadro"')).toBeLessThan(html.indexOf('class="a-br-lado"'));
		expect(html).toContain('data-mapa-det aria-live="polite"');
		expect(html).not.toContain("data-mapa-tip");
	});

	it("sem ufs na apuração todas ficam neutras", () => {
		const html = htmlMapaBrasil(vista({ apuracao: estado({ ufs: undefined }) }));
		expect(html.match(/a-br-vazio/g)?.length).toBeGreaterThanOrEqual(27);
		expect(html).toContain('<strong data-mapa-n="l">0</strong>');
		expect(html).toContain('<strong data-mapa-n="f">0</strong>');
	});
});

describe("o mapa na página (#131)", () => {
	it("ao vivo, o mapa vem logo depois do placar e do cabo e antes da grade da vantagem e dos momentos", () => {
		const html = documentoPesquisas(payload(), AGORA, { apuracao: estado(), historico: [] });
		const cabo = html.indexOf('class="a-cabo-leg"');
		const mapa = html.indexOf("data-mapa-br");
		const grade = html.indexOf('class="a-noite-grade"');
		expect(cabo).toBeGreaterThan(html.indexOf('class="a-placar"'));
		expect(mapa).toBeGreaterThan(cabo);
		expect(mapa).toBeGreaterThan(html.indexOf("</header>"));
		expect(grade).toBeGreaterThan(mapa);
		expect(html.indexOf("Momentos da noite")).toBeGreaterThan(grade);
		expect(html).not.toContain("a-palco");
		expect(html).toContain('<script type="module" src="/js/mapa.js"></script>');
		const { miolo } = fragmentoPagina(payload(), AGORA, { apuracao: estado(), historico: [] });
		expect(miolo.indexOf("data-mapa-br")).toBeGreaterThan(miolo.indexOf("</header>"));
		expect(miolo.indexOf("data-mapa-br")).toBeLessThan(miolo.indexOf('class="a-noite-grade"'));
	});

	it("ao vivo e no resultado final, a grade antiga de UFs não é renderizada", () => {
		for (const fase of ["ao_vivo", "encerrada"] as const) {
			const html = documentoPesquisas(payload({ fase }), AGORA, {
				apuracao: estado({ fase, encerrada: fase === "encerrada" }),
				historico: [],
			});
			expect(html).toContain("data-mapa-br");
			expect(html).not.toContain('data-geo="estados"');
			expect(html).not.toContain("Estados e regiões");
			expect(html).not.toContain('class="a-mapa"');
			expect(html).not.toMatch(/class="a-uf[ "]/);
		}
	});

	it("o cabo da noite segue com a fatia do Flávio na largura certa, agora à direita (#127)", () => {
		const html = documentoPesquisas(payload(), AGORA, { apuracao: estado(), historico: [] });
		expect(html).toContain('class="a-cabo a-cabo-lf"');
		expect(html).toContain('class="a-cabo-f" style="width:47.06%"');
	});

	it("na fase pesquisas não há mapa", () => {
		const html = documentoPesquisas(payload({ fase: "pesquisas" }), AGORA);
		expect(html).not.toContain("data-mapa-br");
		expect(html).not.toContain("a-cabo-lf");
	});

	it("o poller guarda o mapa vivo na troca do miolo e entrega as ufs da API", async () => {
		const js = await asset("/js/ao-vivo.js");
		expect(js).toContain("[data-mapa-br]");
		expect(js).toMatch(/replaceWith\(mapa\)/);
		expect(js).toMatch(/new CustomEvent\("apuracao:leitura", \{ detail: dados \}\)/);
	});

	it("o cliente do mapa não mexe no cabo e respeita reduzir movimento", async () => {
		const js = await asset("/js/mapa.js");
		expect(js).toContain('addEventListener("apuracao:leitura"');
		expect(js).toContain("prefers-reduced-motion");
		expect(js).not.toContain("a-cabo");
		expect(js.indexOf("<span>Lula</span>")).toBeGreaterThan(-1);
		expect(js.indexOf("<span>Lula</span>")).toBeLessThan(js.indexOf("<span>Flávio</span>"));
		expect(js.indexOf('class="a-br-cor-l"')).toBeLessThan(js.indexOf('class="a-br-cor-f"'));
		const css = await asset("/css/tres-semanas.css");
		expect(css).toMatch(/@media \(prefers-reduced-motion: reduce\) \{[^}]*\.a-br-uf/);
	});
});

describe("mapa no celular (#138)", () => {
	function regraEm(folha: string, media: string, seletor: string): string {
		const escMedia = media.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
		const escapado = seletor.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
		const blocos = folha.match(new RegExp(`@media ${escMedia} \\{(?:[^{}]*\\{[^}]*\\})*[^{}]*\\}`, "g")) ?? [];
		for (const bloco of blocos) {
			const achado = bloco.match(new RegExp(`\\n\\t${escapado}\\s*\\{([^}]*)\\}`));
			if (achado) return achado[1];
		}
		return "";
	}

	it("WM3: no touch a dica é só Toque num estado, e o passe o mouse fica para quem tem hover", async () => {
		const html = htmlMapaBrasil(vista());
		const intro = html.match(/<h2 id="a-br-titulo">[^<]*<\/h2><p>([\s\S]*?)<\/p>/)?.[1] ?? "";
		const semMouse = intro.replace(/<span class="a-br-so-mouse">[\s\S]*?<\/span>/, "");
		expect(semMouse).toContain("Toque num estado");
		expect(semMouse).not.toMatch(/mouse/i);
		expect(intro).toContain('<span class="a-br-so-mouse"> ou passe o mouse</span>');
		const css = await asset("/css/tres-semanas.css");
		expect(regraEm(css, "(hover: none)", ".a-br-so-mouse")).toMatch(/display:\s*none/);
	});

	it("WM4: chips das 27 UFs sob o mapa, em ordem de sigla, com o lado de quem lidera", () => {
		const html = htmlMapaBrasil(vista());
		const chips = [...html.matchAll(/<button type="button" class="a-br-chip" data-uf-chip="([a-z]{2})" data-lado="([a-z]*)" aria-pressed="false" aria-label="([^"]*)">([A-Z]{2})<\/button>/g)];
		expect(chips).toHaveLength(27);
		const siglas = chips.map((chip) => chip[1]);
		expect(siglas).toEqual([...siglas].sort());
		const sp = chips.find((chip) => chip[1] === "sp")!;
		expect(sp[2]).toBe("f");
		expect(sp[3]).toBe("São Paulo: Lula 47,70%, Flávio 52,30%, 12,50% apurado");
		expect(sp[4]).toBe("SP");
		expect(chips.find((chip) => chip[1] === "ba")![2]).toBe("l");
		expect(chips.find((chip) => chip[1] === "mg")![2]).toBe("");
		expect(html).toContain('<div class="a-br-chips" role="group" aria-label="Escolha um estado">');
		expect(html.indexOf('class="a-br-quadro"')).toBeLessThan(html.indexOf('class="a-br-chips"'));
		expect(html.indexOf('class="a-br-chips"')).toBeLessThan(html.indexOf('class="a-br-lado"'));
	});

	it("WM4: os chips só aparecem no celular e têm alvo de toque", async () => {
		const css = await asset("/css/tres-semanas.css");
		expect(css).toMatch(/\n\.a-br-chips \{ display: none; \}/);
		expect(regraEm(css, "(max-width: 760px)", ".a-br-chips")).toMatch(/display:\s*grid/);
		const chip = regraEm(css, "(max-width: 760px)", ".a-br-chip");
		expect(Number(chip.match(/min-height:\s*(\d+)px/)?.[1])).toBeGreaterThanOrEqual(36);
		expect(regraEm(css, "(max-width: 760px)", '.a-br-chip[data-lado="l"]')).toContain("var(--l)");
		expect(regraEm(css, "(max-width: 760px)", '.a-br-chip[data-lado="f"]')).toContain("var(--f)");
		expect(regraEm(css, "(max-width: 760px)", '.a-br-chip[aria-pressed="true"]')).toMatch(/background/);
	});

	it("WM4: o cliente liga o chip ao mesmo detalhe e atualiza o lado a cada leitura", async () => {
		const js = await asset("/js/mapa.js");
		expect(js).toContain("[data-uf-chip]");
		expect(js).toMatch(/aria-pressed/);
	});
});
