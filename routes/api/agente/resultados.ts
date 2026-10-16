import { defineHandler } from "void";
import { Pesquisas } from "../../../durable-objects/pesquisas";
import { NOME_INSTANCIA } from "../../../src/pesquisas/fontes";

const TETO_CORPO = 32_768;

export const POST = defineHandler(async (c) => {
	const header = c.req.header("authorization") ?? "";
	const bearer = /^Bearer (\S+)$/.exec(header)?.[1] ?? null;
	const ip = c.req.header("cf-connecting-ip")?.trim() || "desconhecido";
	const declarado = Number(c.req.header("content-length"));
	const pesquisas = Pesquisas.get(NOME_INSTANCIA);
	const lido =
		Number.isFinite(declarado) && declarado > TETO_CORPO ? "" : await c.req.text();
	const corpoExcedeu = lido.length > TETO_CORPO || (Number.isFinite(declarado) && declarado > TETO_CORPO);
	const resposta = await pesquisas.receberResultado({
		bearer,
		ip,
		corpo: corpoExcedeu ? lido.slice(0, TETO_CORPO) : lido,
		corpoExcedeu,
		agora: new Date(),
	});
	const headers: Record<string, string> = {};
	if (resposta.status === 429) headers["retry-after"] = "60";
	return c.json(resposta.corpo, { status: resposta.status, headers });
});
