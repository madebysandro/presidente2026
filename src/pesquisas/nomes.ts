import { normalizarTexto } from "./texto";

const INSTITUTOS_ESPECIFICO_PRIMEIRO: ReadonlyArray<
	readonly [string, string]
> = [
	["real time big data", "Real Time Big Data"],
	["real time midia", "Real Time Big Data"],
	["alfa inteligencia", "Alfa Inteligência"],
	["100% cidades", "100% Cidades"],
	["100 cidades", "100% Cidades"],
	["vox brasil", "Vox Brasil"],
	["atlasintel", "AtlasIntel"],
	["datatrends", "Datatrends"],
	["datafolha", "Datafolha"],
	["poderdata", "PoderData"],
	["instituto franca", "Instituto Franca"],
	["franca de pesquisa", "Instituto Franca"],
	["ipespe", "Ipespe"],
	["quaest", "Quaest"],
	["indexa", "Indexa"],
	["palver", "Palver"],
	["ranking", "Ranking"],
	["verita", "Verita"],
	["phoenix", "Phoenix"],
	["nexus", "Nexus"],
	["vetor", "Vetor"],
	["gerp", "GERP"],
	["mda", "MDA"],
];

const CONTRATANTES: ReadonlyArray<readonly [string, string]> = [
	["editora globo", "Editora Globo"],
	["folha da manha", "Folha de S.Paulo"],
	["globo comunicacao", "TV Globo"],
	["futura", "Futura"],
	["btg pactual", "BTG Pactual"],
	["agencia estado", "Agência Estado"],
	["confederacao nacional do transporte", "CNT"],
	["fonte 83", "Fonte 83"],
	["correio continental", "Correio Continental (RO)"],
];

export function nomeInstituto(empresa: string, fantasia: string): string {
	const texto = normalizarTexto(`${fantasia} ${empresa}`);
	for (const [trecho, nome] of INSTITUTOS_ESPECIFICO_PRIMEIRO) {
		if (texto.includes(trecho)) return nome;
	}
	const base = fantasia && fantasia !== "#NULO#" ? fantasia : empresa;
	return nomeProprio(base);
}

export function nomeContratante(
	nome: string,
	cnpjContratante: string,
	cnpjEmpresa: string,
): string {
	const empresa = digitos(cnpjEmpresa);
	const contratante = digitos(cnpjContratante);
	if (empresa.length > 0 && empresa === contratante) return "recursos próprios";
	const texto = normalizarTexto(nome);
	for (const [trecho, curto] of CONTRATANTES) {
		if (texto.includes(trecho)) return curto;
	}
	return nomeProprio(nome);
}

function digitos(s: string): string {
	return s.replace(/\D/g, "");
}

function nomeProprio(bruto: string): string {
	const limpo = bruto.replaceAll("#NULO#", " ").replace(/\s+/g, " ").trim();
	if (!limpo) return "";
	return limpo
		.toLocaleLowerCase("pt-BR")
		.replace(
			/\p{L}+/gu,
			(palavra) =>
				palavra.charAt(0).toLocaleUpperCase("pt-BR") + palavra.slice(1),
		);
}
