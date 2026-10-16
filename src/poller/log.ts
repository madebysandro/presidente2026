import type { EventoLog } from "../log";

export type CicloPoller = {
	lidos: number;
	naoModificados: number;
	mudou: boolean;
	cicloCompleto: boolean;
	apurado: number | null;
	encerrada: boolean;
	proximaMs: number | null;
	erro: unknown;
	ms: number;
};

export function eventoPoller(c: CicloPoller): EventoLog {
	const { erro, ...campos } = c;
	if (erro == null) return { evento: "poller", resultado: "ok", ...campos };
	const status = (erro as { status?: unknown }).status;
	return {
		evento: "poller",
		resultado: "erro",
		...campos,
		...(typeof status === "number" ? { statusTse: status } : {}),
		erro: erro instanceof Error ? erro.message : String(erro),
	};
}
