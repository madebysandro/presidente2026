import { urlFoto, type ConfigTse } from "../../config/tse";
import { numeroTse } from "../numeros";
import type { Candidato, Cargo, MetaCargo, TotaisCargo } from "../tipos";
import type { DadosBrutosCargo } from "./dados-brutos";

type CandBruto =
	DadosBrutosCargo["carg"][number]["agr"][number]["par"][number]["cand"][number];
type ParBruto =
	DadosBrutosCargo["carg"][number]["agr"][number]["par"][number];

export function candidatoDe(
	cand: CandBruto,
	par: ParBruto,
	agr: string,
	meta: MetaCargo,
	cfg: ConfigTse,
): Candidato {
	return {
		n: String(cand.n ?? ""),
		nome: String(cand.nmu ?? ""),
		partido: String(par.sg ?? ""),
		agr,
		votos: Number(cand.vap) || 0,
		pct: numeroTse(cand.pvapn),
		eleito: cand.e === "s",
		situacao: String(cand.st ?? ""),
		valido: cand.dvt === "Válido",
		foto: urlFoto(cfg, meta, String(cand.sqcand ?? "")),
		pos: 0,
	};
}

/** Totais do arquivo de cargo (eleitorado, comparecimento, válidos…). */
export function totaisDe(dados: DadosBrutosCargo): TotaisCargo {
	return {
		eleitorado: Number(dados.e?.te) || 0,
		eleitoradoApurado: Number(dados.e?.est) || 0,
		comparecimento: numeroTse(dados.e?.pcn),
		abstencao: numeroTse(dados.e?.pan),
		validos: Number(dados.v?.vv) || 0,
		legenda: Number(dados.v?.vl) || 0,
		brancos: numeroTse(dados.v?.pvbn),
		nulos: numeroTse(dados.v?.ptvnn),
	};
}

export function normalizarMajoritario(
	meta: MetaCargo,
	dados: DadosBrutosCargo,
	cfg: ConfigTse,
): Cargo {
	const carg = dados.carg[0];
	const vagas = Number(carg?.nv) || 1;
	const candidatos = (carg?.agr ?? [])
		.flatMap((agr) =>
			(agr.par ?? []).flatMap((par) =>
				(par.cand ?? []).map((cand) =>
					candidatoDe(
						cand,
						par,
						String(agr.com ?? "").replace(/\s+/g, ""),
						meta,
						cfg,
					),
				),
			),
		)
		.sort((a, b) => b.votos - a.votos);

	candidatos.forEach((c, i) => {
		c.pos = i + 1;
	});

	return {
		id: meta.id,
		titulo: meta.titulo,
		local: meta.local,
		vagas,
		apurado: numeroTse(dados.s?.pstn),
		hora: String(dados.hg ?? ""),
		qe: Number(carg?.qe) || null,
		totais: totaisDe(dados),
		candidatos,
	};
}
