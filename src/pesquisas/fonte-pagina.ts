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

/** Os dois números ocupam trechos diferentes. 50% e 50% exigem duas ocorrências. */
export function parPresente(texto: string, a: number, b: number): boolean {
	const fa = ocorrencias(texto, a);
	if (a === b) return fa.length >= 2;
	const fb = ocorrencias(texto, b);
	return fa.length > 0 && fb.length > 0;
}

export function paginaConfirma(
	html: string,
	instituto: string,
	pares: ReadonlyArray<readonly [number, number]>,
): boolean {
	const texto = textoDaPagina(html);
	if (!texto.includes(normalizarTexto(instituto))) return false;
	return pares.some(([a, b]) => parPresente(texto, a, b));
}
