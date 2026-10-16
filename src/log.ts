/**
 * Eventos estruturados para o Workers Logs: cada campo de primeiro nível vira
 * filtro no painel Observability. Um evento por unidade de trabalho.
 * Nunca carregar bearer, chave ou IP.
 */
export type EventoLog =
	| {
			evento: "import";
			motivo: string;
			resultado: "aplicado" | "nao_modificado" | "erro";
			upserts?: number;
			removidos?: number;
			auditoria?: number;
			etagPesquisa?: string | null;
			etagContratante?: string | null;
			erro?: string;
			ms: number;
	  }
	| {
			evento: "poller";
			resultado: "ok" | "erro";
			lidos: number;
			naoModificados: number;
			mudou: boolean;
			cicloCompleto: boolean;
			apurado: number | null;
			encerrada: boolean;
			proximaMs: number | null;
			statusTse?: number;
			erro?: string;
			ms: number;
	  }
	| {
			evento: "agente";
			metodo: string;
			rota: string;
			status: number;
	  };

export function registrar(e: EventoLog): void {
	const nivel = "resultado" in e && e.resultado === "erro" ? "error" : "log";
	console[nivel](e);
}
