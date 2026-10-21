import { defineHandler } from "void";
import { Pesquisas } from "../../../durable-objects/pesquisas";
import {
	classificarContentLength,
	corpoRecusado,
	lerCorpoSeAutorizado,
	TETO_CORPO_AGENTE,
} from "../../../src/pesquisas/corpo-pedido";
import { NOME_INSTANCIA } from "../../../src/pesquisas/fontes";
import { pedidoAgente, responderAgente } from "../../../src/pesquisas/pedido-agente";

export const POST = defineHandler(async (c) => {
	const classe = classificarContentLength(c.req.header("content-length"), TETO_CORPO_AGENTE);
	if (classe !== "ok") return responderAgente(c, corpoRecusado(classe));
	const { bearer, ip } = pedidoAgente(c.req.header("authorization"), c.req.header("cf-connecting-ip"));
	const pesquisas = Pesquisas.get(NOME_INSTANCIA);
	const autorizado = await pesquisas.agenteAutorizado(bearer);
	const lido = await lerCorpoSeAutorizado(c.req.raw, TETO_CORPO_AGENTE, autorizado);
	if (!lido.ok) return responderAgente(c, corpoRecusado(lido.status));
	const resposta = await pesquisas.receberResultado({
		bearer,
		ip,
		corpo: lido.texto,
		agora: new Date(),
	});
	return responderAgente(c, resposta);
});
