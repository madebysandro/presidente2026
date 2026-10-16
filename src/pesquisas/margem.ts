import { normalizarTexto } from "./texto";

const NUM = String.raw`(\d{1,2}(?:[.,]\d{1,2})?)`;

const MARGEM_NA_FAIXA = new RegExp(
	String.raw`(?:(?:margem (?:maxima )?(?:estimada )?(?:de )?erro|erro amostral|erro maximo)(?:\([^)]{0,40}\)|[^0-9%(]){0,200}?${NUM}\s*(?:\([^)]{0,30}\)\s*)?(?:%|p\.?\s?p\b|pontos?)|±\s*${NUM}\s*(?:%|p\.?\s?p|pontos?))`,
);

const IC = new RegExp(
	String.raw`(?:confianca[^0-9]{0,60}?${NUM}\s*%|confiabilidade[^0-9]{0,30}?${NUM}\s*%|${NUM}\s*%\s*(?:\([^)]{0,40}\)\s*)?(?:de )?(?:confianca|confiabilidade))`,
);

export function extrairMargemConfianca(campos: {
	plano: string;
	metodologia: string;
	municipio: string;
	controle: string;
}): { margem: number | null; confianca: number | null } {
	const plano = normalizarTexto(campos.plano);
	const extra = normalizarTexto(
		`${campos.metodologia} ${campos.municipio} ${campos.controle}`,
	);
	return {
		margem:
			extrair(MARGEM_NA_FAIXA, plano, 0.3, 10) ??
			extrair(MARGEM_NA_FAIXA, extra, 0.3, 10) ??
			extrair(MARGEM_NA_FAIXA, `${plano} ${extra}`, 0.3, 10),
		confianca:
			extrair(IC, plano, 80, 99.9) ??
			extrair(IC, extra, 80, 99.9) ??
			extrair(IC, `${plano} ${extra}`, 80, 99.9),
	};
}

function extrair(padrao: RegExp, texto: string, min: number, max: number): number | null {
	for (const m of texto.matchAll(new RegExp(padrao.source, "g"))) {
		const raw = m.slice(1).find((g): g is string => Boolean(g));
		if (!raw) continue;
		const valor = Number(raw.replace(",", "."));
		if (valor >= min && valor <= max) return valor;
	}
	return null;
}
