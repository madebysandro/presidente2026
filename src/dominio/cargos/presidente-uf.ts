import { NOMES_UF } from "../../config/ufs";
import { numeroTse } from "../numeros";
import type { UfPresidente } from "../tipos";
import type { DadosBrutosCargo } from "./dados-brutos";

/**
 * Normaliza o arquivo de Presidente de uma UF (ou exterior) do TSE.
 * Top 4 candidatos — o suficiente para placar, regiões e duelos da faixa.
 */
export function normalizarPresidenteUf(
	uf: string,
	dados: DadosBrutosCargo,
): UfPresidente {
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
		nome: NOMES_UF[uf] ?? uf.toUpperCase(),
		hora: String(dados.hg ?? ""),
		apurado: numeroTse(dados.s?.pstn),
		secoes: Number(dados.s?.ts) || 0,
		secoesApuradas: Number(dados.s?.st) || 0,
		eleitorado: Number(dados.e?.te) || 0,
		validos: Number(dados.v?.vv) || 0,
		comparecimento: numeroTse(dados.e?.pcn),
		candidatos,
	};
}

export function ufMudou(
	antes: UfPresidente | undefined,
	novo: UfPresidente,
): boolean {
	if (!antes) return true;
	if (antes.apurado !== novo.apurado) return true;
	if (antes.comparecimento !== novo.comparecimento) return true;
	if (antes.candidatos.length !== novo.candidatos.length) return true;
	return antes.candidatos.some(
		(c, i) => c.votos !== novo.candidatos[i]?.votos,
	);
}
