export type CorpoSuspensao = {
	registro: string;
	decisaoUrl: string;
	motivo: string;
};

export type RecusaSuspensao = { codigo: CodigoSuspensao; detalhe: string };

export type CodigoSuspensao =
	| "registro_desconhecido"
	| "decisao_invalida"
	| "motivo_ausente"
	| "nao_suspensa"
	| "corpo_invalido"
	| "desde_invalido"
	| "depois_invalido";

const TETO = 2_000;

export function lerCorpoSuspensao(bruto: unknown): { ok: CorpoSuspensao } | { motivos: RecusaSuspensao[] } {
	if (!ehObj(bruto)) {
		return { motivos: [{ codigo: "corpo_invalido", detalhe: "corpo inválido" }] };
	}
	const motivos: RecusaSuspensao[] = [];
	const registro = typeof bruto.registro === "string" ? bruto.registro.trim() : "";
	const motivo = typeof bruto.motivo === "string" ? bruto.motivo.trim() : "";
	const decisaoUrl = typeof bruto.decisaoUrl === "string" ? bruto.decisaoUrl.trim() : "";
	if (!registro) {
		motivos.push({ codigo: "registro_desconhecido", detalhe: "registro ausente" });
	}
	if (!motivo) {
		motivos.push({ codigo: "motivo_ausente", detalhe: "motivo ausente" });
	} else if (motivo.length > TETO) {
		motivos.push({ codigo: "motivo_ausente", detalhe: "motivo longo demais" });
	}
	if (!decisaoUrl || !decisaoUrlValida(decisaoUrl)) {
		motivos.push({
			codigo: "decisao_invalida",
			detalhe: "decisaoUrl tem de ser https, sem usuário nem senha",
		});
	} else if (decisaoUrl.length > TETO) {
		motivos.push({ codigo: "decisao_invalida", detalhe: "decisaoUrl longa demais" });
	}
	if (motivos.length > 0 || !registro) return { motivos };
	return { ok: { registro, decisaoUrl, motivo } };
}

export function lerMotivoReativacao(bruto: unknown): { motivo: string } | { motivos: RecusaSuspensao[] } {
	if (!ehObj(bruto)) {
		return { motivos: [{ codigo: "corpo_invalido", detalhe: "corpo inválido" }] };
	}
	const motivo = typeof bruto.motivo === "string" ? bruto.motivo.trim() : "";
	if (!motivo) {
		return { motivos: [{ codigo: "motivo_ausente", detalhe: "motivo ausente" }] };
	}
	if (motivo.length > TETO) {
		return { motivos: [{ codigo: "motivo_ausente", detalhe: "motivo longo demais" }] };
	}
	return { motivo };
}

export function decisaoUrlValida(fonte: string): boolean {
	let url: URL;
	try {
		url = new URL(fonte);
	} catch {
		return false;
	}
	if (url.protocol !== "https:") return false;
	if (url.username || url.password) return false;
	return url.hostname.length > 0;
}

export function registroDaSuspensao(url: string): string | null {
	const path = new URL(url).pathname;
	const prefix = "/api/agente/suspensoes/";
	if (!path.startsWith(prefix)) return null;
	const resto = path.slice(prefix.length);
	if (!resto || resto.endsWith("/")) return null;
	try {
		return decodeURIComponent(resto);
	} catch {
		return null;
	}
}

function ehObj(v: unknown): v is Record<string, unknown> {
	return typeof v === "object" && v !== null && !Array.isArray(v);
}
