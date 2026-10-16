import { numeroTse } from "../numeros";
import type { ColegioPresidente } from "../tipos";
import type { DadosBrutosCargo } from "./dados-brutos";

/** Arquivo municipal de Presidente, no mesmo formato do arquivo de UF. */
export function normalizarColegio(
	uf: string,
	cd: string,
	nome: string,
	dados: DadosBrutosCargo,
): ColegioPresidente {
	const candidatos = (dados.carg[0]?.agr ?? [])
		.flatMap((a) =>
			a.par.flatMap((p) =>
				p.cand.map((x) => ({
					n: String(x.n ?? ""),
					nome: String(x.nmu ?? ""),
					votos: Number(x.vap) || 0,
					pct: numeroTse(x.pvapn),
				})),
			),
		)
		.sort((a, b) => b.votos - a.votos)
		.slice(0, 4);

	return {
		uf,
		cd,
		nome,
		hora: String(dados.hg ?? ""),
		apurado: numeroTse(dados.s?.pstn),
		eleitorado: Number(dados.e?.te) || 0,
		validos: Number(dados.v?.vv) || 0,
		comparecimento: numeroTse(dados.e?.pcn),
		candidatos,
	};
}

export function colegioMudou(
	antes: ColegioPresidente | undefined,
	novo: ColegioPresidente,
): boolean {
	if (!antes) return true;
	if (antes.apurado !== novo.apurado) return true;
	if (antes.comparecimento !== novo.comparecimento) return true;
	return antes.candidatos[0]?.votos !== novo.candidatos[0]?.votos;
}
