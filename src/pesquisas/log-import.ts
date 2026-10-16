import type { EventoLog } from "../log";
import type { Changeset, MotivoImport } from "./tipos";

export type DesfechoImport = Changeset | { kind: "erro"; erro: unknown };

export function eventoImport(
	motivo: MotivoImport,
	desfecho: DesfechoImport,
	ms: number,
): Extract<EventoLog, { evento: "import" }> {
	if (desfecho.kind === "erro") {
		const erro = desfecho.erro instanceof Error ? desfecho.erro.message : String(desfecho.erro);
		return { evento: "import", motivo, resultado: "erro", erro, ms };
	}
	const etags = {
		etagPesquisa: desfecho.meta.etagPesquisa,
		etagContratante: desfecho.meta.etagContratante,
	};
	if (desfecho.kind === "nao_modificado") {
		return { evento: "import", motivo, resultado: "nao_modificado", ...etags, ms };
	}
	return {
		evento: "import",
		motivo,
		resultado: "aplicado",
		upserts: desfecho.upserts.length,
		removidos: desfecho.remover.length,
		auditoria: desfecho.auditoria.length,
		...etags,
		ms,
	};
}
