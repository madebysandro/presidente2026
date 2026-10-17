import { normalizarTexto } from "./texto";

export function textoDaPagina(html: string): string {
	const semBloco = html
		.replace(/<script[\s\S]*?<\/script>/gi, " ")
		.replace(/<style[\s\S]*?<\/style>/gi, " ");
	const semTag = semBloco.replace(/<[^>]*>/g, " ");
	const entidades = semTag
		.replaceAll("&nbsp;", " ")
		.replace(/&#160;/gi, " ")
		.replace(/&#x0*a0;/gi, " ")
		.replaceAll("\u00a0", " ");
	return normalizarTexto(entidades);
}

/** Inteiro aceita 49%, 49 % e 49,0%. Decimal aceita 51,1% e zeros à direita (51,10%). */
export function padraoNumero(n: number): RegExp | null {
	if (!Number.isFinite(n)) return null;
	const [inteiro, frac = ""] = String(n).split(".");
	if (!/^\d+$/.test(inteiro)) return null;
	const fracUtil = frac.replace(/0+$/, "");
	const miolo = fracUtil.length === 0 ? `${inteiro}(?:,0+)?` : `${inteiro},${fracUtil}0*`;
	return new RegExp(`(?<![\\d,])${miolo}\\s?%`, "g");
}

export function ocorrencias(texto: string, n: number): number[] {
	const padrao = padraoNumero(n);
	if (!padrao) return [];
	const indices: number[] = [];
	for (const achado of texto.matchAll(padrao)) {
		if (achado.index != null) indices.push(achado.index);
	}
	return indices;
}

export function casaNumero(texto: string, n: number): boolean {
	return ocorrencias(texto, n).length > 0;
}

/**
 * A matéria cita este nome no lugar do instituto, só no registro indicado.
 * Não é apelido geral do instituto.
 */
export const APELIDOS_INSTITUTO_POR_REGISTRO: Readonly<Record<string, readonly string[]>> = {
	"BR-00650/2026": ["Futura"],
	"BR-03764/2026": ["Futura"],
};

/** Os dois números ocupam trechos diferentes. 50% e 50% exigem duas ocorrências. */
export function parPresente(texto: string, a: number, b: number): boolean {
	const fa = ocorrencias(texto, a);
	if (a === b) return fa.length >= 2;
	const fb = ocorrencias(texto, b);
	return fa.length > 0 && fb.length > 0;
}

/** Apelido entra como palavra. "futuramente" e "futuras" não valem "Futura". */
function apelidoPresente(texto: string, apelido: string): boolean {
	const normal = normalizarTexto(apelido);
	if (!normal) return false;
	const corpo = normal.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
	return new RegExp(`(?<![a-z0-9])${corpo}(?![a-z0-9])`).test(texto);
}

export function paginaConfirma(
	html: string,
	registro: string,
	instituto: string,
	pares: ReadonlyArray<readonly [number, number]>,
): boolean {
	const texto = textoDaPagina(html);
	const apelidos = APELIDOS_INSTITUTO_POR_REGISTRO[registro] ?? [];
	const temInstituto = texto.includes(normalizarTexto(instituto));
	const temApelido = apelidos.some((apelido) => apelidoPresente(texto, apelido));
	if (!temInstituto && !temApelido) return false;
	return pares.some(([a, b]) => parPresente(texto, a, b));
}
