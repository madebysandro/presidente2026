import { urlArquivoCargo, type ConfigTse } from "../config/tse";
import { SIGLAS_UF, urlPresidenteUf } from "../config/ufs";

/** 10 maiores colégios pelo eleitorado do 1º turno. `cd` é o código TSE do município. */
export const COLEGIOS_MAIORES = [
	{ uf: "sp", cd: "71072", nome: "São Paulo" },
	{ uf: "rj", cd: "60011", nome: "Rio de Janeiro" },
	{ uf: "df", cd: "97012", nome: "Brasília" },
	{ uf: "mg", cd: "41238", nome: "Belo Horizonte" },
	{ uf: "ba", cd: "38490", nome: "Salvador" },
	{ uf: "ce", cd: "13897", nome: "Fortaleza" },
	{ uf: "am", cd: "02550", nome: "Manaus" },
	{ uf: "pr", cd: "75353", nome: "Curitiba" },
	{ uf: "pe", cd: "25313", nome: "Recife" },
	{ uf: "rs", cd: "88013", nome: "Porto Alegre" },
] as const;

type AlvoBrasil = { chave: "presidente"; tipo: "brasil" };
type AlvoUf = { chave: `uf:${string}`; tipo: "uf"; uf: string };
type AlvoMunicipio = {
	chave: string;
	tipo: "municipio";
	uf: string;
	cd: string;
	nome: string;
};
export type AlvoCiclo = AlvoBrasil | AlvoUf | AlvoMunicipio;

/** 1 Brasil + 27 UFs + exterior + 10 municípios = 39 arquivos. */
export function alvosCiclo(): AlvoCiclo[] {
	const brasil: AlvoBrasil = { chave: "presidente", tipo: "brasil" };
	const ufs: AlvoUf[] = SIGLAS_UF.map((uf) => ({
		chave: `uf:${uf}`,
		tipo: "uf",
		uf,
	}));
	const municipios: AlvoMunicipio[] = COLEGIOS_MAIORES.map((c) => ({
		chave: `mu:${c.uf}:${c.cd}`,
		tipo: "municipio",
		uf: c.uf,
		cd: c.cd,
		nome: c.nome,
	}));
	return [brasil, ...ufs, ...municipios];
}

export function urlDoAlvo(cfg: ConfigTse, alvo: AlvoCiclo): string {
	if (alvo.tipo === "brasil") {
		return urlArquivoCargo(cfg, {
			id: "presidente",
			titulo: "Presidente",
			local: "Brasil",
			ele: cfg.eleicaoFederal,
			uf: "br",
			cd: "0001",
		});
	}
	if (alvo.tipo === "uf") return urlPresidenteUf(cfg, alvo.uf);
	return urlMunicipio(cfg, alvo.uf, alvo.cd);
}

function urlMunicipio(cfg: ConfigTse, uf: string, cd: string): string {
	const ele6 = cfg.eleicaoFederal.padStart(6, "0");
	return `${cfg.base}/ele2026/${cfg.eleicaoFederal}/dados/${uf}/${uf}${cd}-c0001-e${ele6}-u.json`;
}

/** Chave de `tf` que entra no encerramento: cargo ou sigla, sem município. */
export function chaveTf(alvo: AlvoCiclo): string | null {
	if (alvo.tipo === "brasil") return "presidente";
	if (alvo.tipo === "uf") return alvo.uf;
	return null;
}
