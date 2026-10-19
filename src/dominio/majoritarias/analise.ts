import { pontos } from "../pontos-hist";
import type { Cargo, Leitura } from "../tipos";

/** Candidato citado na análise (defensor / perseguidor / tendência). */
export type RefCandidatoAnalise = {
	n: string;
	nome: string;
	votos: number;
	pct: number;
};

export type TendenciaCandidato = {
	n: string;
	nome: string;
	/** p.p. a cada 10% de seções apuradas (últimas até 8 leituras). */
	ppPor10pct: number;
};

export type PrimeiroTurnoAnalise = {
	/** Fatia % do restante; ≤0 = maioria; >100 = fora. */
	fatiaPct: number | null;
	status: "ok" | "maioria" | "fora";
};

export type AnaliseMajoritaria = {
	defensor: RefCandidatoAnalise;
	perseguidor: RefCandidatoAnalise;
	vantagemVotos: number;
	vantagemPp: number;
	/** Série da vantagem em p.p. (para a minilinha). */
	evolucaoVantagemPp: number[];
	validosAApurar: number | null;
	/** Margem em p.p. sobre o que falta; >100 → fora de alcance. */
	margemParaVirarPp: number | null;
	foraDeAlcance: boolean;
	primeiroTurno: PrimeiroTurnoAnalise | null;
	tendencias: TendenciaCandidato[];
};

function pontosCargo(hist: Leitura[], id: string): Leitura[] {
	return pontos(hist, id) as Leitura[];
}

/** Votos válidos a apurar, supondo o mesmo comparecimento nas seções restantes. */
export function validosRestantes(cargo: Cargo): number | null {
	const f = cargo.totais.eleitoradoApurado / cargo.totais.eleitorado;
	return f > 0 && f < 1
		? cargo.totais.validos / f - cargo.totais.validos
		: null;
}

/** Regressão linear % votos × % apurado → p.p. a cada 10% de seções. */
export function tendenciaCand(
	hist: Leitura[],
	cargoId: string,
	n: string,
): number | null {
	const pts = pontosCargo(hist, cargoId)
		.filter((p) => p.c[cargoId].c[n])
		.map((p) => [p.c[cargoId].ap, p.c[cargoId].c[n][1]] as const)
		.slice(-8);
	if (pts.length < 3) return null;
	const mx = pts.reduce((s, p) => s + p[0], 0) / pts.length;
	const my = pts.reduce((s, p) => s + p[1], 0) / pts.length;
	const sxx = pts.reduce((a, p) => a + (p[0] - mx) ** 2, 0);
	if (sxx < 0.25) return null;
	return (
		(pts.reduce((a, p) => a + (p[0] - mx) * (p[1] - my), 0) / sxx) * 10
	);
}

function refDe(
	c: Cargo["candidatos"][number] | undefined,
): RefCandidatoAnalise | null {
	if (!c) return null;
	return { n: c.n, nome: c.nome, votos: c.votos, pct: c.pct };
}

/**
 * Calcula a análise de um cargo majoritário a partir do estado atual e do histórico.
 */
export function analiseMajoritaria(
	cargo: Cargo,
	hist: Leitura[],
): AnaliseMajoritaria | null {
	const [a, b] = cargo.candidatos;
	const def = refDe(a);
	const per = refDe(b);
	if (!def || !per) return null;

	const vantagemVotos = def.votos - per.votos;
	const vantagemPp = def.pct - per.pct;
	const R = validosRestantes(cargo);

	const evolucaoVantagemPp = pontosCargo(hist, cargo.id)
		.map(
			(p) =>
				(p.c[cargo.id].c[def.n]?.[1] ?? Number.NaN) -
				(p.c[cargo.id].c[per.n]?.[1] ?? Number.NaN),
		)
		.filter((v) => !Number.isNaN(v));

	let margemParaVirarPp: number | null = null;
	let foraDeAlcance = false;
	if (R != null && R > 0) {
		margemParaVirarPp = (vantagemVotos / R) * 100;
		foraDeAlcance = margemParaVirarPp > 100;
	}

	let primeiroTurno: PrimeiroTurnoAnalise | null = null;
	if (R != null && R > 0 && a) {
		const fatiaPct =
			((0.5 * (cargo.totais.validos + R) - a.votos) / R) * 100;
		const status: PrimeiroTurnoAnalise["status"] =
			fatiaPct <= 0 ? "maioria" : fatiaPct > 100 ? "fora" : "ok";
		primeiroTurno = { fatiaPct, status };
	} else {
		primeiroTurno = { fatiaPct: null, status: "ok" };
	}

	const candidatosTend = cargo.candidatos.slice(0, 2);
	const tendencias: TendenciaCandidato[] = [];
	for (const cand of candidatosTend) {
		const pp = tendenciaCand(hist, cargo.id, cand.n);
		if (pp != null) {
			tendencias.push({ n: cand.n, nome: cand.nome, ppPor10pct: pp });
		}
	}

	return {
		defensor: def,
		perseguidor: per,
		vantagemVotos,
		vantagemPp,
		evolucaoVantagemPp,
		validosAApurar: R,
		margemParaVirarPp,
		foraDeAlcance,
		primeiroTurno,
		tendencias,
	};
}

export function analisarMajoritarias(
	cargos: Record<string, Cargo>,
	hist: Leitura[],
): Record<string, AnaliseMajoritaria> {
	const out: Record<string, AnaliseMajoritaria> = {};
	const cargo = cargos.presidente;
	if (!cargo) return out;
	const a = analiseMajoritaria(cargo, hist);
	if (a) out.presidente = a;
	return out;
}
