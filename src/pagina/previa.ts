import { escHtml } from "../dominio/texto";
import type { PayloadPesquisas } from "../pesquisas/tipos";
import { contagemVotacao } from "./topo";

export const LARGURA_PREVIA = 1200;
export const ALTURA_PREVIA = 630;
export const ORIGEM_PREVIA = "https://presidente2026.win";

const SEM_MEDIA = "Acompanhe as pesquisas do 2º turno";

const um = new Intl.NumberFormat("pt-BR", {
	minimumFractionDigits: 1,
	maximumFractionDigits: 1,
});

export function textoUm(n: number): string {
	return um.format(n);
}

export function descricaoDaPrevia(payload: PayloadPesquisas): string {
	const media = payload.media;
	if (!media) return SEM_MEDIA;
	return `Flávio ${textoUm(media.vf)}% x Lula ${textoUm(media.vl)}%`;
}

export function tituloDaPrevia(payload: PayloadPesquisas): string {
	if (!payload.media) return "Presidente 2026 · 2º turno";
	return `${descricaoDaPrevia(payload)} · 2º turno`;
}

/** Dígitos da média e do dia, para o `?v=` que o WhatsApp refaz. */
export function versaoDaPrevia(payload: PayloadPesquisas, dias: number): string {
	const media = payload.media;
	if (!media) return `sem-d${dias}`;
	const quando = payload.atualizadoEm.replace(/\D/g, "");
	const vf = textoUm(media.vf).replace(/\D/g, "");
	const vl = textoUm(media.vl).replace(/\D/g, "");
	return `${quando}${vf}${vl}${media.n}-d${dias}`;
}

export function textoDias(dias: number): string {
	return `${dias} ${dias === 1 ? "DIA" : "DIAS"} ATÉ 25/10`;
}

function meta(atributo: "property" | "name", nome: string, content: string): string {
	return `<meta ${atributo}="${nome}" content="${escHtml(content)}">`;
}

export function htmlMetasPrevia(
	payload: PayloadPesquisas,
	agora: Date,
	origem = ORIGEM_PREVIA,
): string {
	const dias = contagemVotacao(agora).dias;
	const descricao = descricaoDaPrevia(payload);
	const titulo = tituloDaPrevia(payload);
	const imagem = `${origem}/og.png?v=${versaoDaPrevia(payload, dias)}`;
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
