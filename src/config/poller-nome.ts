/** Nome estável do DO do poller por eleição — não reutiliza estado do 1º turno. */
export function nomePoller(eleicaoFederal: string): string {
	return `ele-${eleicaoFederal}`;
}
