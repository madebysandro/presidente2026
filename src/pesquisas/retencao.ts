/** A auditoria fica no Durable Object pelo menos até esta data (Brasília). */
export function fimRetencaoAuditoria(): Date {
	return new Date("2026-12-31T23:59:59.999-03:00");
}
