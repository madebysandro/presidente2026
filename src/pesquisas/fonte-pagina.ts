import { normalizarTexto } from "./texto";

function textoDaPagina(html: string): string {
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
function padraoNumero(n: number): RegExp | null {
	if (!Number.isFinite(n)) return null;
	const [inteiro, frac = ""] = String(n).split(".");
	if (!/^\d+$/.test(inteiro)) return null;
	const fracUtil = frac.replace(/0+$/, "");
	const miolo = fracUtil.length === 0 ? `${inteiro}(?:,0+)?` : `${inteiro},${fracUtil}0*`;
	return new RegExp(`(?<![\\d,])${miolo}\\s?%`, "g");
}

function ocorrencias(texto: string, n: number): number[] {
	const padrao = padraoNumero(n);
	if (!padrao) return [];
	const indices: number[] = [];
	for (const achado of texto.matchAll(padrao)) {
		if (achado.index != null) indices.push(achado.index);
	}
	return indices;
}

/**
 * A matéria cita este nome no lugar do instituto, só no registro indicado.
 * Não é apelido geral do instituto.
 */
const APELIDOS_INSTITUTO_POR_REGISTRO: Readonly<Record<string, readonly string[]>> = {
	"BR-00650/2026": ["Futura"],
	"BR-03764/2026": ["Futura"],
	"BR-07896/2026": ["França", "Franca"],
	"BR-08251/2026": ["Ideia"],
	"BR-09726/2026": ["Futura"],
};

type Candidato = "flavio" | "lula";

interface Mencao {
	readonly candidato: Candidato;
	readonly inicio: number;
	readonly fim: number;
}

function mencoes(texto: string): Mencao[] {
	return [...texto.matchAll(/(?<![a-z0-9])(flavio|lula)(?![a-z0-9])/g)].map((achado) => ({
		candidato: achado[1] as Candidato,
		inicio: achado.index,
		fim: achado.index + achado[0].length,
	}));
}

/** Dono do percentual é o nome mais próximo. Empate fica com o nome que vem antes. */
function dono(nomes: readonly Mencao[], indice: number): Candidato | null {
	let melhor: Candidato | null = null;
	let distancia = Number.POSITIVE_INFINITY;
	for (const nome of nomes) {
		const d = nome.fim <= indice ? indice - nome.fim : nome.inicio - indice;
		if (d < distancia) {
			distancia = d;
			melhor = nome.candidato;
		}
	}
	return melhor;
}

function atribuido(texto: string, nomes: readonly Mencao[], n: number, candidato: Candidato): boolean {
	return ocorrencias(texto, n).some((indice) => dono(nomes, indice) === candidato);
}

/** Cada percentual precisa estar junto do próprio candidato: Flávio com `flavio`, Lula com `lula`. */
function parPresente(texto: string, flavio: number, lula: number): boolean {
	const nomes = mencoes(texto);
	return atribuido(texto, nomes, flavio, "flavio") && atribuido(texto, nomes, lula, "lula");
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
	/** Cada par é `[flavio, lula]`. */
	pares: ReadonlyArray<readonly [flavio: number, lula: number]>,
): boolean {
	const texto = textoDaPagina(html);
	const apelidos = APELIDOS_INSTITUTO_POR_REGISTRO[registro] ?? [];
	const temInstituto = texto.includes(normalizarTexto(instituto));
	const temApelido = apelidos.some((apelido) => apelidoPresente(texto, apelido));
	if (!temInstituto && !temApelido) return false;
	return pares.some(([a, b]) => parPresente(texto, a, b));
}
