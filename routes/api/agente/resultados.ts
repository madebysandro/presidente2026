import { defineHandler } from "void";
import { Pesquisas } from "../../../durable-objects/pesquisas";
import { NOME_INSTANCIA } from "../../../src/pesquisas/fontes";

export const POST = defineHandler(async (c) => {
	const header = c.req.header("authorization") ?? "";
	const bearer = /^Bearer (\S+)$/.exec(header)?.[1] ?? null;
	const ip = c.req.header("cf-connecting-ip")?.trim() || "desconhecido";
	const declarado = Number(c.req.header("content-length"));
	if (Number.isFinite(declarado) && declarado > 32_768) {
		return c.json(
			{
				motivos: [{ codigo: "numeros_invalidos", detalhe: "corpo grande demais" }],
			},
			{ status: 422 },
		);
	}
	const lido = await c.req.text();
	const corpo = lido.length > 32_768 ? lido.slice(0, 32_768) : lido;
	if (lido.length > 32_768) {
		return c.json(
			{
				motivos: [{ codigo: "numeros_invalidos", detalhe: "corpo grande demais" }],
			},
			{ status: 422 },
		);
	}
	const resposta = await Pesquisas.get(NOME_INSTANCIA).receberResultado({
		bearer,
		ip,
		corpo,
		agora: new Date(),
	});
	const headers: Record<string, string> = {};
	if (resposta.status === 429) headers["retry-after"] = "60";
	return c.json(resposta.corpo, { status: resposta.status, headers });
});
