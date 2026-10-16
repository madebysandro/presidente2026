import { defineHandler } from "void";
import { Pesquisas } from "../../../../durable-objects/pesquisas";
import { NOME_INSTANCIA } from "../../../../src/pesquisas/fontes";
import { pedidoAgente, responderAgente } from "../../../../src/pesquisas/pedido-agente";

export const POST = defineHandler(async (c) => {
	const { bearer, ip } = pedidoAgente(c.req.header("authorization"), c.req.header("cf-connecting-ip"));
	const corpo = await c.req.text();
	const resposta = await Pesquisas.get(NOME_INSTANCIA).suspender({
		bearer,
		ip,
		corpo,
		agora: new Date(),
	});
	return responderAgente(c, resposta);
});
