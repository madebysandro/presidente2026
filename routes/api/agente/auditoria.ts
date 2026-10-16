import { defineHandler } from "void";
import { Pesquisas } from "../../../durable-objects/pesquisas";
import { NOME_INSTANCIA } from "../../../src/pesquisas/fontes";
import { pedidoAgente, responderAgente } from "../../../src/pesquisas/pedido-agente";

export const GET = defineHandler(async (c) => {
	const { bearer, ip } = pedidoAgente(c.req.header("authorization"), c.req.header("cf-connecting-ip"));
	const url = new URL(c.req.url);
	const resposta = await Pesquisas.get(NOME_INSTANCIA).listarAuditoriaPublica({
		bearer,
		ip,
		agora: new Date(),
		desde: url.searchParams.get("desde"),
		depois: url.searchParams.get("depois"),
		limite: url.searchParams.get("limite"),
		consulta: url.search,
	});
	return responderAgente(c, resposta);
});
