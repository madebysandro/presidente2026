export function pedidoAgente(
	headerAuth: string | undefined,
	headerIp: string | undefined,
): { bearer: string | null; ip: string } {
	const bearer = /^Bearer (\S+)$/.exec(headerAuth ?? "")?.[1] ?? null;
	const ip = headerIp?.trim() || "desconhecido";
	return { bearer, ip };
}

export function responderAgente(
	c: {
		json: (
			corpo: unknown,
			init?: { status?: number; headers?: Record<string, string> },
		) => Response;
	},
	resposta: { status: number; corpo: unknown },
): Response {
	const headers: Record<string, string> = { "cache-control": "no-store" };
	if (resposta.status === 429) headers["retry-after"] = "60";
	return c.json(resposta.corpo, { status: resposta.status, headers });
}
