import { escHtml, pf } from "../dominio/texto";
import { arquivoZerado, type VistaNoite } from "./ao-vivo";
import { contagemVotacao, FLAVIO, LULA } from "./topo";

export const LARGURA_PREVIA = 1200;
export const ALTURA_PREVIA = 630;
export const ORIGEM_PREVIA = "https://presidente2026.win";

const SEM_MEDIA = "Acompanhe as pesquisas do 2º turno";
const SEM_VOTOS = "Apuração do 2º turno, ainda sem votos";
const TITULO_NEUTRO = "Presidente 2026 · 2º turno";

const um = new Intl.NumberFormat("pt-BR", {
	minimumFractionDigits: 1,
	maximumFractionDigits: 1,
});

function textoUm(n: number): string {
	return um.format(n);
}

export type FontePrevia = Pick<VistaNoite, "fase" | "agora" | "pesquisas" | "apuracao">;

export type LadoPrevia = {
	quem: "flavio" | "lula";
	pct: number;
	texto: string;
};

/**
 * O placar do cartão. Em pesquisas é a média, Flávio à esquerda. Na noite é
 * a apuração do placar, Lula à esquerda, com as seções apuradas.
 */
export type PlacarPrevia = {
	esquerda: LadoPrevia;
	direita: LadoPrevia;
	secoes: string | null;
};

export function ehNoite(fonte: FontePrevia): boolean {
	return fonte.fase !== "pesquisas";
}

function placarDaApuracao(fonte: FontePrevia): PlacarPrevia | null {
	const cargo = fonte.apuracao.cargos.presidente;
	if (!cargo || arquivoZerado(fonte.apuracao)) return null;
	const pct = (numero: string) => cargo.candidatos.find((c) => c.n === numero)?.pct;
	const lula = pct(LULA.numero);
	const flavio = pct(FLAVIO.numero);
	if (lula == null || flavio == null || !Number.isFinite(lula) || !Number.isFinite(flavio)) return null;
	const formato = fonte.fase === "encerrada" ? um : pf;
	return {
		esquerda: { quem: "lula", pct: lula, texto: formato.format(lula) },
		direita: { quem: "flavio", pct: flavio, texto: formato.format(flavio) },
		secoes: Number.isFinite(cargo.apurado) ? formato.format(cargo.apurado) : null,
	};
}

export function placarDaPrevia(fonte: FontePrevia): PlacarPrevia | null {
	if (ehNoite(fonte)) return placarDaApuracao(fonte);
	const media = fonte.pesquisas.media;
	if (!media) return null;
	return {
		esquerda: { quem: "flavio", pct: media.vf, texto: textoUm(media.vf) },
		direita: { quem: "lula", pct: media.vl, texto: textoUm(media.vl) },
		secoes: null,
	};
}

function nomeDe(lado: LadoPrevia): string {
	return lado.quem === "lula" ? LULA.nome : FLAVIO.nome;
}

function textoPlacar(placar: PlacarPrevia): string {
	const { esquerda, direita } = placar;
	return `${nomeDe(esquerda)} ${esquerda.texto}% x ${nomeDe(direita)} ${direita.texto}%`;
}

function descricaoDaPrevia(fonte: FontePrevia, placar: PlacarPrevia | null): string {
	if (!placar) return ehNoite(fonte) ? SEM_VOTOS : SEM_MEDIA;
	if (placar.secoes == null) return textoPlacar(placar);
	return `${textoPlacar(placar)} · ${placar.secoes}% das seções apuradas`;
}

function tituloDaPrevia(placar: PlacarPrevia | null): string {
	if (!placar) return TITULO_NEUTRO;
	return `${textoPlacar(placar)} · 2º turno`;
}

function digitos(texto: string): string {
	return texto.replace(/\D/g, "");
}

/**
 * O `?v=` que o WhatsApp refaz. Em pesquisas, dígitos da média e do dia; na
 * noite, dígitos do placar e das seções, que andam a cada leitura do TSE.
 */
export function versaoDaPrevia(fonte: FontePrevia): string {
	const placar = placarDaPrevia(fonte);
	if (ehNoite(fonte)) {
		const prefixo = fonte.fase === "encerrada" ? "fim" : "ao";
		if (!placar) return `${prefixo}-sem`;
		const partes = [placar.esquerda.texto, placar.direita.texto, placar.secoes ?? ""].map(digitos);
		return `${prefixo}-${partes.join("-")}`;
	}
	const dias = contagemVotacao(fonte.agora).dias;
	const media = fonte.pesquisas.media;
	if (!media) return `sem-d${dias}`;
	const quando = digitos(fonte.pesquisas.atualizadoEm);
	return `${quando}${digitos(textoUm(media.vf))}${digitos(textoUm(media.vl))}${media.n}-d${dias}`;
}

function meta(atributo: "property" | "name", nome: string, content: string): string {
	return `<meta ${atributo}="${nome}" content="${escHtml(content)}">`;
}

export function htmlMetasPrevia(fonte: FontePrevia, origem = ORIGEM_PREVIA): string {
	const placar = placarDaPrevia(fonte);
	const descricao = descricaoDaPrevia(fonte, placar);
	const titulo = tituloDaPrevia(placar);
	const imagem = `${origem}/og.png?v=${versaoDaPrevia(fonte)}`;
	return [
		meta("property", "og:title", titulo),
		meta("property", "og:description", descricao),
		meta("property", "og:image", imagem),
		meta("property", "og:image:width", String(LARGURA_PREVIA)),
		meta("property", "og:image:height", String(ALTURA_PREVIA)),
		meta("property", "og:url", `${origem}/`),
		meta("property", "og:type", "website"),
		meta("property", "og:locale", "pt_BR"),
		meta("name", "twitter:card", "summary_large_image"),
		meta("name", "twitter:title", titulo),
		meta("name", "twitter:description", descricao),
		meta("name", "twitter:image", imagem),
	].join("\n");
}
