import { defineHandler } from "void";
import { Pesquisas } from "../../../durable-objects/pesquisas";
import { NOME_INSTANCIA } from "../../../src/pesquisas/fontes";
import { pedidoAgente, responderAgente } from "../../../src/pesquisas/pedido-agente";

export const GET = defineHandler(async (c) => {
	const { bearer, ip } = pedidoAgente(c.req.header("authorization"), c.req.header("cf-connecting-ip"));
	const resposta = await Pesquisas.get(NOME_INSTANCIA).listarPendentes({
		bearer,
		ip,
		agora: new Date(),
	});
	return responderAgente(c, resposta);
});
