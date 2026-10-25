/**
 * Regressão #134: o segundo clique na UF selecionada desmarca e o painel volta à dica.
 * Seam: os handlers que public/js/mapa.js registra no document, sobre um DOM mínimo.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const DICA = "Toque numa UF";

type Ouvinte = (evento: Record<string, unknown>) => void;

class No {
	pai: No | null = null;
	filhos: No[] = [];
	dataset: Record<string, string> = {};
	classes = new Set<string>();
	innerHTML = "";
	attrs = new Map<string, string>();
	setAttribute = (nome: string, valor: string) => this.attrs.set(nome, valor);
	getAttribute = (nome: string) => this.attrs.get(nome) ?? null;
	removeAttribute = (nome: string) => this.attrs.delete(nome);
	classList = {
		add: (c: string) => this.classes.add(c),
		remove: (...cs: string[]) => {
			for (const c of cs) this.classes.delete(c);
		},
		contains: (c: string) => this.classes.has(c),
		toggle: (c: string, ligar?: boolean) => {
			const on = ligar ?? !this.classes.has(c);
			if (on) this.classes.add(c);
			else this.classes.delete(c);
			return on;
		},
	};

	constructor(classes: string[] = [], dataset: Record<string, string> = {}) {
		for (const c of classes) this.classes.add(c);
		Object.assign(this.dataset, dataset);
	}

	add(...filhos: No[]): this {
		for (const f of filhos) {
			f.pai = this;
			this.filhos.push(f);
		}
		return this;
	}

	casa(seletor: string): boolean {
		for (const [, classe, attr, valor] of seletor.matchAll(/\.([\w-]+)|\[([\w-]+)(?:="([^"]*)")?\]/g)) {
			if (classe && !this.classes.has(classe)) return false;
			if (attr) {
				const chave = attr.replace(/^data-/, "").replace(/-(\w)/g, (_, l: string) => l.toUpperCase());
				if (!(chave in this.dataset)) return false;
				if (valor != null && this.dataset[chave] !== valor) return false;
			}
		}
		return true;
	}

	closest(seletor: string): No | null {
		const partes = seletor.split(" ");
		const ultima = partes.pop() as string;
		for (let no: No | null = this; no; no = no.pai) {
			if (!no.casa(ultima)) continue;
			if (!partes.length) return no;
			if (no.pai?.closest(partes.join(" "))) return no;
		}
		return null;
	}

	querySelectorAll(seletor: string): No[] {
		return this.filhos.flatMap((f) => [...(f.casa(seletor) ? [f] : []), ...f.querySelectorAll(seletor)]);
	}

	querySelector(seletor: string): No | null {
		return this.querySelectorAll(seletor)[0] ?? null;
	}
}

let ouvintes: Map<string, Ouvinte[]>;
let mapa: No;
let fora: No;

function uf(sigla: string): No {
	return mapa.querySelector(`.a-br-uf[data-uf="${sigla}"]`) as No;
}

function disparar(tipo: string, evento: Record<string, unknown>) {
	for (const ouvinte of ouvintes.get(tipo) ?? []) ouvinte(evento);
}

function clicar(alvo: No) {
	disparar("click", { target: alvo });
}

function marcadas(): string[] {
	return mapa.querySelectorAll(".a-br-uf.on").map((no) => no.dataset.uf);
}

function chip(sigla: string): No {
	return mapa.querySelector(`[data-uf-chip="${sigla}"]`) as No;
}

function apertados(): string[] {
	return mapa.querySelectorAll("[data-uf-chip]").filter((no) => no.getAttribute("aria-pressed") === "true").map((no) => no.dataset.ufChip);
}

function det(): No {
	return mapa.querySelector("[data-mapa-det]") as No;
}

beforeEach(async () => {
	ouvintes = new Map();
	const ufs = ["sp", "ba"].map(
		(sigla) => new No(["a-br-uf", "a-br-l"], { uf: sigla, nome: sigla.toUpperCase(), pctL: "55", pctF: "45" }),
	);
	const rotulos = ["sp", "ba"].map((sigla) => new No([], { rotulo: sigla }));
	const chips = ["ba", "sp"].map((sigla) => new No(["a-br-chip"], { ufChip: sigla, lado: "l" }));
	const grupo = new No(["a-br-chips"]).add(...chips);
	const detalhe = new No([], { mapaDet: "" });
	detalhe.innerHTML = DICA;
	mapa = new No(["a-br"], { mapaBr: "" }).add(...ufs, ...rotulos, grupo, detalhe);
	fora = new No(["a-placar"]);
	const documento = new No().add(mapa, fora);
	vi.stubGlobal("Element", No);
	vi.stubGlobal("document", {
		querySelector: (s: string) => documento.querySelector(s),
		addEventListener: (tipo: string, ouvinte: Ouvinte) => ouvintes.set(tipo, [...(ouvintes.get(tipo) ?? []), ouvinte]),
	});
	vi.resetModules();
	await import("../public/js/mapa.js");
});

afterEach(() => {
	vi.unstubAllGlobals();
});

describe("toque na UF do mapa (#134)", () => {
	it("o primeiro clique seleciona e preenche o detalhe", () => {
		clicar(uf("sp"));
		expect(marcadas()).toEqual(["sp"]);
		expect(mapa.classes.has("a-br-foco")).toBe(true);
		expect(det().innerHTML).toContain("SP");
	});

	it("o segundo clique na mesma UF desmarca e volta à dica do painel", () => {
		clicar(uf("sp"));
		clicar(uf("sp"));
		expect(marcadas()).toEqual([]);
		expect(mapa.querySelectorAll(".on")).toEqual([]);
		expect(mapa.classes.has("a-br-foco")).toBe(false);
		expect(det().innerHTML).toBe(DICA);
	});

	it("depois de desmarcar, sair do hover do mouse não volta a marcar", () => {
		clicar(uf("sp"));
		clicar(uf("sp"));
		disparar("pointerout", { target: uf("sp"), relatedTarget: fora, pointerType: "mouse" });
		expect(marcadas()).toEqual([]);
		expect(det().innerHTML).toBe(DICA);
	});

	it("um terceiro clique volta a selecionar", () => {
		clicar(uf("sp"));
		clicar(uf("sp"));
		clicar(uf("sp"));
		expect(marcadas()).toEqual(["sp"]);
	});

	it("clicar em outra UF troca a seleção", () => {
		clicar(uf("sp"));
		clicar(uf("ba"));
		expect(marcadas()).toEqual(["ba"]);
		expect(mapa.querySelector('[data-rotulo="sp"]')?.classes.has("on")).toBe(false);
		expect(mapa.querySelector('[data-rotulo="ba"]')?.classes.has("on")).toBe(true);
	});

	it("Escape limpa a seleção", () => {
		clicar(uf("sp"));
		disparar("keydown", { key: "Escape" });
		expect(marcadas()).toEqual([]);
		expect(det().innerHTML).toBe(DICA);
	});

	it("clicar fora do mapa limpa a seleção", () => {
		clicar(uf("ba"));
		clicar(fora);
		expect(marcadas()).toEqual([]);
		expect(mapa.classes.has("a-br-foco")).toBe(false);
		expect(det().innerHTML).toBe(DICA);
	});
});

describe("chips de UF sob o mapa no celular (#138 WM4)", () => {
	it("tocar o chip seleciona a mesma UF do mapa e abre o mesmo detalhe", () => {
		clicar(chip("sp"));
		expect(marcadas()).toEqual(["sp"]);
		expect(apertados()).toEqual(["sp"]);
		expect(mapa.classes.has("a-br-foco")).toBe(true);
		expect(det().innerHTML).toContain("SP");
	});

	it("tocar de novo o chip desmarca, como o segundo toque no mapa (#134)", () => {
		clicar(chip("sp"));
		clicar(chip("sp"));
		expect(marcadas()).toEqual([]);
		expect(apertados()).toEqual([]);
		expect(det().innerHTML).toBe(DICA);
	});

	it("chip e mapa dividem a seleção: chip, depois o path da mesma UF, desmarca", () => {
		clicar(chip("ba"));
		clicar(uf("ba"));
		expect(marcadas()).toEqual([]);
		expect(apertados()).toEqual([]);
	});

	it("tocar no mapa aperta o chip da UF e trocar de chip troca a seleção", () => {
		clicar(uf("ba"));
		expect(apertados()).toEqual(["ba"]);
		clicar(chip("sp"));
		expect(marcadas()).toEqual(["sp"]);
		expect(apertados()).toEqual(["sp"]);
	});

	it("Escape e clique fora soltam o chip", () => {
		clicar(chip("sp"));
		disparar("keydown", { key: "Escape" });
		expect(apertados()).toEqual([]);
		clicar(chip("ba"));
		clicar(fora);
		expect(apertados()).toEqual([]);
	});

	it("o hover do mouse noutra UF não aperta o chip dela", () => {
		clicar(chip("sp"));
		disparar("pointerover", { target: uf("ba"), pointerType: "mouse" });
		expect(apertados()).toEqual(["sp"]);
	});

	it("cada leitura do poller atualiza o lado e o aria-label do chip", () => {
		vi.stubGlobal("matchMedia", () => ({ matches: true }));
		const candidatos = (votosF: number, votosL: number) => [
			{ n: "22", votos: votosF, pct: (votosF / (votosF + votosL)) * 100 },
			{ n: "13", votos: votosL, pct: (votosL / (votosF + votosL)) * 100 },
		];
		disparar("apuracao:leitura", {
			detail: { ufs: { sp: { apurado: 10, candidatos: candidatos(600, 400) }, ba: { apurado: 0, candidatos: [] } } },
		});
		expect(chip("sp").dataset.lado).toBe("f");
		expect(chip("sp").getAttribute("aria-label")).toBe("SP: Lula 40,00%, Flávio 60,00%, 10,00% apurado");
		expect(chip("ba").dataset.lado).toBe("");
		expect(chip("ba").getAttribute("aria-label")).toBe("BA: sem seções apuradas");
	});
});
