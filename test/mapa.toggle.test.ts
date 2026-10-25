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

function det(): No {
	return mapa.querySelector("[data-mapa-det]") as No;
}

beforeEach(async () => {
	ouvintes = new Map();
	const ufs = ["sp", "ba"].map(
		(sigla) => new No(["a-br-uf", "a-br-l"], { uf: sigla, nome: sigla.toUpperCase(), pctL: "55", pctF: "45" }),
	);
	const rotulos = ["sp", "ba"].map((sigla) => new No([], { rotulo: sigla }));
	const detalhe = new No([], { mapaDet: "" });
	detalhe.innerHTML = DICA;
	mapa = new No(["a-br"], { mapaBr: "" }).add(...ufs, ...rotulos, detalhe);
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
