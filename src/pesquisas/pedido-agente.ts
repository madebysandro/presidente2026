import { type EventoLog, registrar } from "../log";

export function pedidoAgente(
	headerAuth: string | undefined,
	headerIp: string | undefined,
): { bearer: string | null; ip: string } {
	const bearer = /^Bearer (\S+)$/.exec(headerAuth ?? "")?.[1] ?? null;
	const ip = headerIp?.trim() || "desconhecido";
	return { bearer, ip };
}

const PREFIXO_SUSPENSAO = "/api/agente/suspensoes/";

export function eventoAgente(
	pedido: { method: string; url: string },
	status: number,
): Extract<EventoLog, { evento: "agente" }> {
	const caminho = new URL(pedido.url).pathname;
	const rota = caminho.startsWith(PREFIXO_SUSPENSAO) ? `${PREFIXO_SUSPENSAO}:registro` : caminho;
	return { evento: "agente", metodo: pedido.method, rota, status };
}

export function responderAgente(
	c: {
		req: { method: string; url: string };
		json: (
			corpo: unknown,
			init?: { status?: number; headers?: Record<string, string> },
		) => Response;
	},
	resposta: { status: number; corpo: unknown } | Response,
): Response {
	registrar(eventoAgente(c.req, resposta.status));
	if (resposta instanceof Response) return resposta;
	const headers: Record<string, string> = { "cache-control": "no-store" };
	if (resposta.status === 429) headers["retry-after"] = "60";
	return c.json(resposta.corpo, { status: resposta.status, headers });
}
