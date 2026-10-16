import { defineHandler } from "void";
import { Pesquisas } from "../../../durable-objects/pesquisas";
import { NOME_INSTANCIA } from "../../../src/pesquisas/fontes";

const TETO_CORPO = 1_000_000;

export const POST = defineHandler(async (c) => {
	const autorizacao = c.req.header("authorization") ?? "";
	const bearer = autorizacao.startsWith("Bearer ") ? autorizacao.slice("Bearer ".length) : null;
	const declarado = Number(c.req.header("content-length"));
	const corpo =
		Number.isFinite(declarado) && declarado > TETO_CORPO ? "" : await c.req.text();
	const pesquisas = Pesquisas.get(NOME_INSTANCIA);
	const resposta = await pesquisas.receberPlanoB({
		bearer,
		corpo: corpo.length > TETO_CORPO ? "" : corpo,
		agora: new Date(),
	});
	return c.json(resposta.corpo, {
		status: resposta.status,
		headers: { "cache-control": "no-store" },
	});
});
