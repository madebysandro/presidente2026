import brZerado from "../../fixtures/tse-6258-zerado/br.json" with { type: "json" };
import type { DadosBrutosCargo } from "../dominio/cargos/dados-brutos";

export type PassoNoite = {
	apurado: number;
	votos22: number;
	votos13: number;
	tf: "s" | "n";
	pcn: string;
	hora: string;
};

/**
 * Noite curta e determinística: Flávio abre, Lula vira, Flávio retoma.
 * Os votos são exemplo, não leitura do TSE.
 */
export const PASSOS_VIRADA: readonly PassoNoite[] = [
	{
		apurado: 12,
		votos22: 1_200_000,
		votos13: 1_000_000,
		tf: "n",
		pcn: "70,0",
		hora: "17:20:00",
	},
	{
		apurado: 48,
		votos22: 4_000_000,
		votos13: 4_500_000,
		tf: "n",
		pcn: "72,0",
		hora: "18:40:00",
	},
	{
		apurado: 80,
		votos22: 9_000_000,
		votos13: 8_000_000,
		tf: "n",
		pcn: "75,0",
		hora: "19:50:00",
	},
];

function pctDe(votos: number, total: number): string {
	if (total <= 0) return "0";
	return String((votos / total) * 100);
}

/** Corpo no formato do arquivo zerado real do 6258, com o placar do passo. */
export function corpoDoPasso(passo: PassoNoite): DadosBrutosCargo {
	const clone = structuredClone(brZerado) as DadosBrutosCargo;
	const total = passo.votos22 + passo.votos13;
	clone.hg = passo.hora;
	clone.tf = passo.tf;
	clone.s = {
		...(clone.s ?? {}),
		pst: String(passo.apurado).replace(".", ","),
		pstn: String(passo.apurado),
	};
	clone.e = {
		...(clone.e ?? {}),
		te: "10000000",
		est: String(Math.round(10_000_000 * (passo.apurado / 100))),
		pcn: passo.pcn,
		pan: "25,0",
	};
	clone.v = {
		...(clone.v ?? {}),
		vv: String(total),
		pvbn: "2,0",
		ptvnn: "3,0",
	};
	for (const agr of clone.carg[0]?.agr ?? []) {
		for (const par of agr.par ?? []) {
			for (const cand of par.cand ?? []) {
				if (cand.n === "22") {
					cand.vap = String(passo.votos22);
					cand.pvapn = pctDe(passo.votos22, total);
				} else if (cand.n === "13") {
					cand.vap = String(passo.votos13);
					cand.pvapn = pctDe(passo.votos13, total);
				}
			}
		}
	}
	return clone;
}

export function corposNoiteVirada(): DadosBrutosCargo[] {
	return PASSOS_VIRADA.map(corpoDoPasso);
}
