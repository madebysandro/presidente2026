/** A auditoria fica no Durable Object pelo menos até esta data (Brasília). */
export function fimRetencaoAuditoria(): Date {
	return new Date("2026-12-31T23:59:59.999-03:00");
}

export const IDADE_AUDITORIA_AGENTE_MS = 90 * 24 * 60 * 60 * 1000;

export const TETO_LINHAS_AUDITORIA_AGENTE = 2_000;
