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
 * Teto da escada: antes das 17h a espera não passa do horário;
 * depois, com apurado 0, no máximo 60 s.
 */
export function limitarEspera(
	esperaSegundos: number,
	agora: number,
	apurado: number,
): number {
	if (agora < ABERTURA_2T_MS) {
		const faltaSeg = Math.max(
			1,
			Math.ceil((ABERTURA_2T_MS - agora) / 1000),
		);
		return Math.min(esperaSegundos, faltaSeg);
	}
	if (apurado <= 0) return Math.min(esperaSegundos, 60);
	return esperaSegundos;
}
