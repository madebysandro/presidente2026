/** 25/10/2026 17:00 em Brasília (UTC−3, sem horário de verão). */
export const ABERTURA_2T_MS = Date.parse("2026-10-25T17:00:00-03:00");

export type FaseApuracao = "pesquisas" | "ao_vivo" | "encerrada";

export function faseDe(
	agora: number,
	encerrada: boolean | undefined,
): FaseApuracao {
	if (encerrada) return "encerrada";
	if (agora >= ABERTURA_2T_MS) return "ao_vivo";
	return "pesquisas";
}

/**
 * Espera em milissegundos. Antes das 17h o alarme cai no horário ou antes.
 * Depois, com apurado 0, no máximo 60 s.
 */
export function limitarEsperaMs(
	esperaSegundos: number,
	agora: number,
	apurado: number,
): number {
	const pedido = Math.max(0, esperaSegundos) * 1000;
	if (agora < ABERTURA_2T_MS) {
		return Math.min(pedido, ABERTURA_2T_MS - agora);
	}
	if (apurado <= 0) return Math.min(pedido, 60_000);
	return pedido;
}
