import { REGIOES } from "../config/ufs";
import type {
	Cargo,
	ColegioPresidente,
	ComparacaoTurnos,
	FatiaEleitorado,
	FechamentoEncerrada,
	Leitura,
	MomentoNoite,
	RegiaoApuracao,
	UfPresidente,
	UfVirou,
	ViradaNoite,
} from "../dominio/tipos";
import {
	COLEGIOS_1T,
	ESTADO_1T,
	liderDeVotos,
	votosUf1t,
} from "./referencia-1t";

const N22 = "22";
const N13 = "13";

function mapaVotos(leitura: Leitura): Record<string, [number, number, number]> {
	return leitura.c.presidente?.c ?? {};
}

export function liderLeitura(leitura: Leitura): string | null {
	const entradas = Object.entries(mapaVotos(leitura));
	if (!entradas.length) return null;
	entradas.sort((a, b) => b[1][0] - a[1][0] || a[1][2] - b[1][2]);
	if (entradas[0]![1][0] <= 0) return null;
	return entradas[0]![0];
}

function margemPp(leitura: Leitura): number {
	const c = mapaVotos(leitura);
	const a = c[N22]?.[1] ?? 0;
	const b = c[N13]?.[1] ?? 0;
	return Math.abs(a - b);
}

export function viradasDoHistorico(hist: Leitura[]): ViradaNoite[] {
	const pts = hist.filter((h) => h.c.presidente);
	const out: ViradaNoite[] = [];
	for (let i = 1; i < pts.length; i++) {
		const de = liderLeitura(pts[i - 1]!);
		const para = liderLeitura(pts[i]!);
		if (!de || !para || de === para) continue;
		const p = pts[i]!.c.presidente!;
		out.push({ de, para, hora: p.hora, ap: p.ap, t: pts[i]!.t });
	}
	return out;
}

export function momentosDaNoite(
	hist: Leitura[],
	viradas: ViradaNoite[],
	encerrada: boolean,
	horaFim: string | undefined,
	liderEleito: string | undefined,
	margemEleito: number | undefined,
): MomentoNoite[] {
	const pts = hist.filter((h) => liderLeitura(h));
	if (!pts.length) return [];
	const ev: MomentoNoite[] = [];
	const p0 = pts[0]!;
	const n0 = liderLeitura(p0)!;
	ev.push({
		tipo: "abre",
		hora: p0.c.presidente!.hora,
		ap: p0.c.presidente!.ap,
		n: n0,
		margemPp: margemPp(p0),
	});
	let maior = p0;
	for (const h of pts) {
		if (margemPp(h) > margemPp(maior)) maior = h;
	}
	ev.push({
		tipo: "maior_vantagem",
		hora: maior.c.presidente!.hora,
		ap: maior.c.presidente!.ap,
		n: liderLeitura(maior) ?? undefined,
		margemPp: margemPp(maior),
	});
	const meio = pts.find((h) => h.c.presidente!.ap >= 50);
	if (meio) {
		ev.push({
			tipo: "metade",
			hora: meio.c.presidente!.hora,
			ap: meio.c.presidente!.ap,
			n: liderLeitura(meio) ?? undefined,
			margemPp: margemPp(meio),
		});
	}
	for (const v of viradas) {
		ev.push({
			tipo: "virada",
			hora: v.hora,
			ap: v.ap,
			de: v.de,
			para: v.para,
		});
	}
	if (encerrada && liderEleito) {
		ev.push({
			tipo: "eleito",
			hora: horaFim ?? "",
			ap: 100,
			n: liderEleito,
			margemPp: margemEleito,
		});
	}
	ev.sort((a, b) => a.ap - b.ap);
	return ev;
}

function liderCandidatos(
	cands: { n: string; votos: number }[],
): string | null {
	if (!cands.length || cands[0]!.votos <= 0) return null;
	return cands[0]!.n;
}

export function regioesDe(ufs: Record<string, UfPresidente>): RegiaoApuracao[] {
	return Object.entries(REGIOES).map(([nome, siglas]) => {
		let secoes = 0;
		let secoesAp = 0;
		let validos = 0;
		const votos: Record<string, { n: string; nome: string; votos: number }> =
			{};
		const votos1t: Record<string, number> = {};
		for (const uf of siglas) {
			const u = ufs[uf];
			if (u) {
				secoes += u.secoes;
				secoesAp += u.secoesApuradas;
				validos += u.validos;
				for (const c of u.candidatos) {
					const acc = votos[c.n] ?? { n: c.n, nome: c.nome, votos: 0 };
					acc.votos += c.votos;
					votos[c.n] = acc;
				}
			}
			for (const [n, v] of Object.entries(votosUf1t(uf))) {
				votos1t[n] = (votos1t[n] ?? 0) + v;
			}
		}
		const candidatos = Object.values(votos)
			.sort((a, b) => b.votos - a.votos)
			.map((c) => ({
				n: c.n,
				nome: c.nome,
				votos: c.votos,
				pct: validos > 0 ? (c.votos / validos) * 100 : 0,
			}));
		const lider = liderCandidatos(candidatos);
		const lider1t = liderDeVotos(votos1t);
		return {
			nome,
			apurado: secoes > 0 ? (secoesAp / secoes) * 100 : 0,
			validos,
			candidatos,
			lider,
			lider1t,
			virou: Boolean(lider && lider1t && lider !== lider1t),
		};
	});
}

export function ufsQueViraram(
	ufs: Record<string, UfPresidente>,
): UfVirou[] {
	const out: UfVirou[] = [];
	for (const u of Object.values(ufs)) {
		if (u.uf === "zz") continue;
		const lider = liderCandidatos(u.candidatos);
		const lider1t = liderDeVotos(votosUf1t(u.uf));
		if (lider && lider1t && lider !== lider1t) {
			out.push({ uf: u.uf, nome: u.nome, lider, lider1t });
		}
	}
	return out;
}

function fatias1t(): FatiaEleitorado {
	const T = ESTADO_1T.cargos.presidente.totais;
	const cands = ESTADO_1T.cargos.presidente.candidatos;
	const E = T.eleitorado;
	const v22 = cands.find((c) => c.n === N22)?.votos ?? 0;
	const v13 = cands.find((c) => c.n === N13)?.votos ?? 0;
	const comp = T.comparecimento / 100;
	return {
		flavio: (v22 / E) * 100,
		lula: (v13 / E) * 100,
		outros: ((T.validos - v22 - v13) / E) * 100,
		brancosNulos: comp * (T.brancos + T.nulos),
		abstencao: 100 - T.comparecimento,
	};
}

export function comparacaoTurnos(cargo: Cargo | undefined): ComparacaoTurnos {
	const primeiro = fatias1t();
	const T2 = cargo?.totais;
	if (!cargo || !T2 || T2.validos <= 0 || T2.eleitoradoApurado <= 0) {
		return { primeiro, segundo: null, estimativa: null };
	}
	const Ea = T2.eleitoradoApurado;
	const por = (n: string) =>
		((cargo.candidatos.find((c) => c.n === n)?.votos ?? 0) / Ea) * 100;
	const flavio = por(N22);
	const lula = por(N13);
	const comp2 = T2.comparecimento;
	const segundo: FatiaEleitorado = {
		flavio,
		lula,
		outros: 0,
		brancosNulos: comp2 - flavio - lula,
		abstencao: 100 - comp2,
	};
	const E2 = T2.eleitorado;
	const flavioVotos = ((segundo.flavio - primeiro.flavio) / 100) * E2;
	const lulaVotos = ((segundo.lula - primeiro.lula) / 100) * E2;
	const fonteVotos =
		((primeiro.outros +
			primeiro.brancosNulos -
			segundo.brancosNulos +
			primeiro.abstencao -
			segundo.abstencao) /
			100) *
		E2;
	return {
		primeiro,
		segundo,
		estimativa: {
			selo: "ESTIMATIVA",
			flavioVotos,
			lulaVotos,
			fonteVotos,
		},
	};
}

export function fechamentoDe(
	cargo: Cargo,
	viradas: number,
): FechamentoEncerrada {
	const T1 = ESTADO_1T.cargos.presidente.totais;
	return {
		comparecimento: cargo.totais.comparecimento,
		comparecimento1t: T1.comparecimento,
		abstencao: cargo.totais.abstencao,
		abstencao1t: T1.abstencao,
		brancos: cargo.totais.brancos,
		brancos1t: T1.brancos,
		nulos: cargo.totais.nulos,
		nulos1t: T1.nulos,
		viradas,
	};
}

export function anexarReferenciaColegio(
	colegio: ColegioPresidente,
): ColegioPresidente {
	const ref = COLEGIOS_1T.municipios.find((m) => m.cd === colegio.cd);
	if (!ref) return { ...colegio, t1: null };
	return {
		...colegio,
		t1: {
			eleitorado: ref.eleitorado,
			votos: ref.votos,
			lider: liderDeVotos(ref.votos),
			comparecimento: ref.pctComparecimento,
		},
	};
}
