/**
 * Pausa anunciada pelo TSE na noite do 2º turno (#124): a divulgação parou e só volta às 19h.
 * Para remover, apague este arquivo, as chamadas a `fimDaPausa` e o `data-pausa-*` de public/js/ao-vivo.js.
 */
export const PAUSA_TSE = {
	inicio: "2026-10-25T17:30:00-03:00",
	fim: "2026-10-25T19:00:00-03:00",
} as const;

const INICIO_MS = Date.parse(PAUSA_TSE.inicio);
const FIM_MS = Date.parse(PAUSA_TSE.fim);

/** Fim da pausa quando `agora` cai dentro dela; fora dela, null. */
export function fimDaPausa(agora: number): number | null {
	return agora >= INICIO_MS && agora < FIM_MS ? FIM_MS : null;
}
