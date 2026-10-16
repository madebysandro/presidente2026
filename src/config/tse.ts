import type { MetaCargo } from "../dominio/tipos";

export type ConfigTse = {
	base: string;
	eleicaoFederal: string;
};

export function configTseDeEnv(env: {
	TSE_BASE: string;
	ELEICAO_FEDERAL: string;
}): ConfigTse {
	return {
		base: env.TSE_BASE.replace(/\/$/, ""),
		eleicaoFederal: env.ELEICAO_FEDERAL,
	};
}

/** Presidente nacional do 2º turno (6258). UFs e colégios entram em `alvosCiclo`. */
export function metasCargos(cfg: ConfigTse): MetaCargo[] {
	return [
		{
			id: "presidente",
			titulo: "Presidente",
			local: "Brasil",
			ele: cfg.eleicaoFederal,
			uf: "br",
			cd: "0001",
		},
	];
}

export function urlArquivoCargo(cfg: ConfigTse, cargo: MetaCargo): string {
	const ele6 = cargo.ele.padStart(6, "0");
	return `${cfg.base}/ele2026/${cargo.ele}/dados/${cargo.uf}/${cargo.uf}-c${cargo.cd}-e${ele6}-u.json`;
}

export function urlFoto(
	cfg: ConfigTse,
	cargo: MetaCargo,
	sqcand: string,
): string {
	return `${cfg.base}/ele2026/${cargo.ele}/fotos/${cargo.uf}/${sqcand}.jpeg`;
}
