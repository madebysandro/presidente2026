import { defineHandler } from "void";
import instrucoes from "../../../docs/agente/instrucoes.md?raw";
import { Pesquisas } from "../../../durable-objects/pesquisas";
import { pedidoAgente, responderAgente } from "../../../src/pesquisas/pedido-agente";
import { NOME_INSTANCIA } from "../../../src/pesquisas/fontes";

export const GET = defineHandler(async (c) => {
	const { bearer, ip } = pedidoAgente(c.req.header("authorization"), c.req.header("cf-connecting-ip"));
	const resposta = await Pesquisas.get(NOME_INSTANCIA).abrirInstrucoes({
		bearer,
		ip,
		agora: new Date(),
	});
	if (resposta.status === 429) return responderAgente(c, resposta);
	return responderAgente(
		c,
		new Response(instrucoes, {
			status: 200,
			headers: {
				"content-type": "text/markdown; charset=utf-8",
				"cache-control": "no-store",
			},
		}),
	);
});
