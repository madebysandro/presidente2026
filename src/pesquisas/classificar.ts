import type { Classificacao } from "./tipos";
import { normalizarTexto } from "./texto";

const PARA_COM_ACENTO = /(?<![\p{L}\p{N}_])pará(?![\p{L}\p{N}_])/iu;

const SIGLAS =
	"AC|AL|AM|AP|BA|CE|DF|ES|GO|MA|MG|MS|MT|PA|PB|PE|PI|PR|RJ|RN|RO|RR|RS|SC|SE|SP|TO";

const SIGLA_EM_CONTEXTO = new RegExp(
	`(?:(?:estado\\s+d[oa]|d[oa]|todo\\s+o)\\s+(${SIGLAS})\\b|\\((${SIGLAS})\\)|cidade/(${SIGLAS})\\b|cidade\\s+-\\s+(${SIGLAS})\\b)`,
	"g",
);

const NAC = new RegExp(
	[
		"abrangencia (da coleta )?(e |sera )?nacional",
		"abrangencia nacional",
		"coleta e nacional",
		"eleitorado (brasileiro|do brasil|de brasil)",
		"eleitor(as|es) (e eleitor(as|es) )?do brasil",
		"brasileiros a partir",
		"(pesquisa|entrevistas) (sera |serao )?realizadas? no brasil",
		"area fisica:? (de realizacao da pesquisa )?(e )?(o )?brasil",
		"corresponde ao brasil",
		"(territorio do|coleta( dos dados)? e) brasil",
		"27 (unidades da federacao|ufs)",
		"(cinco|5 \\(cinco\\)) (grandes )?regioes",
		"grandes regioes",
		"entrevistas no pais",
		"territorio nacional",
		"eleitorado nacional",
		"abrangencia da pesquisa e nacional",
		"todas as unidades da federacao",
	].join("|"),
);

const SUB = new RegExp(
	[
		"estadual",
		"(eleitorado do|e o|no) municipio de (?!domicilio)",
		"(eleitorado|territorio|eleitores) do estado",
		"estado d[eo] ",
		"distrito federal",
	].join("|"),
);

const UFS_NOME: ReadonlyArray<readonly [RegExp, string]> = [
	[/mato grosso do sul/, "MS"],
	[/mato grosso(?! do sul)/, "MT"],
	[/parana(?! pesquisas)/, "PR"],
	[/rio grande do norte/, "RN"],
	[/rio grande do sul/, "RS"],
	[/rio de janeiro/, "RJ"],
	[/minas gerais/, "MG"],
	[/espirito santo/, "ES"],
	[/santa catarina/, "SC"],
	[/distrito federal/, "DF"],
	[/sao paulo/, "SP"],
	[/\bacre\b/, "AC"],
	[/\balagoas\b/, "AL"],
	[/\bamapa\b/, "AP"],
	[/\bamazonas\b/, "AM"],
	[/\bbahia\b/, "BA"],
	[/\bceara\b/, "CE"],
	[/\bgoias\b/, "GO"],
	[/\bmaranhao\b/, "MA"],
	[/\bparaiba\b/, "PB"],
	[/\bpernambuco\b/, "PE"],
	[/\bpiaui\b/, "PI"],
	[/\brondonia\b/, "RO"],
	[/\broraima\b/, "RR"],
	[/\bsergipe\b/, "SE"],
	[/\btocantins\b/, "TO"],
];

export function classificarCampos(
	municipio: string,
	plano: string,
	metodologia: string,
): Classificacao {
	const original = `${municipio} ${plano} ${metodologia}`;
	const texto = normalizarTexto(original);
	const nac = NAC.test(texto);
	const subRe = SUB.test(texto);
	const n = ufsCitadas(original, texto).size;
	const sub = (n >= 1 && n <= 4) || (subRe && n < 5);
	if (nac && !sub) return "nacional";
	if (sub && !nac) return "estadual";
	return "ambigua";
}

function ufsCitadas(original: string, texto: string): Set<string> {
	const achadas = new Set<string>();
	for (const [padrao, sigla] of UFS_NOME) {
		if (padrao.test(texto)) achadas.add(sigla);
	}
	if (PARA_COM_ACENTO.test(original)) achadas.add("PA");
	for (const m of original.matchAll(new RegExp(SIGLA_EM_CONTEXTO.source, "g"))) {
		const sigla = m.slice(1).find((g): g is string => Boolean(g));
		if (sigla) achadas.add(sigla);
	}
	return achadas;
}
