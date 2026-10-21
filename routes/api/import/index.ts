import { defineHandler } from "void";
import { Pesquisas } from "../../../durable-objects/pesquisas";
import {
	classificarContentLength,
	corpoRecusado,
	lerCorpoSeAutorizado,
	TETO_CORPO_IMPORT,
} from "../../../src/pesquisas/corpo-pedido";
import { NOME_INSTANCIA } from "../../../src/pesquisas/fontes";
import { pedidoAgente } from "../../../src/pesquisas/pedido-agente";

function recusarImport(
	c: { json: (corpo: unknown, init?: { status?: number; headers?: Record<string, string> }) => Response },
	status: 411 | 413,
): Response {
	const recusa = corpoRecusado(status);
	return c.json(recusa.corpo, {
		status: recusa.status,
		headers: { "cache-control": "no-store" },
	});
}

export const POST = defineHandler(async (c) => {
	const classe = classificarContentLength(c.req.header("content-length"), TETO_CORPO_IMPORT);
	if (classe !== "ok") return recusarImport(c, classe);
	const { bearer, ip } = pedidoAgente(c.req.header("authorization"), c.req.header("cf-connecting-ip"));
	const pesquisas = Pesquisas.get(NOME_INSTANCIA);
	const autorizado = await pesquisas.importAutorizado(bearer);
	const lido = await lerCorpoSeAutorizado(c.req.raw, TETO_CORPO_IMPORT, autorizado);
	if (!lido.ok) return recusarImport(c, lido.status);
	const resposta = await pesquisas.receberPlanoB({
		bearer,
		ip,
		corpo: lido.texto,
		agora: new Date(),
	});
	const headers: Record<string, string> = { "cache-control": "no-store" };
	if (resposta.status === 429) headers["retry-after"] = "60";
	return c.json(resposta.corpo, { status: resposta.status, headers });
});
