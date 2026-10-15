import { defineHandler } from "void";
import { nomePoller } from "../../src/config/poller-nome";
import { Poller } from "../../durable-objects/poller";

export const GET = defineHandler(async (c) => {
	const desde = Number(c.req.query("desde")) || 0;
	const hist = await Poller.get(
		nomePoller(String(c.env.ELEICAO_FEDERAL)),
	).obterHistorico(desde);
	return c.json(hist, {
		headers: { "cache-control": "no-store" },
	});
});
