import { defineHandler } from "void";
import { nomePoller } from "../../src/config/poller-nome";
import { Poller } from "../../durable-objects/poller";

const CACHE_API_APURACAO =
	"public, max-age=0, s-maxage=5, must-revalidate";

export const GET = defineHandler(async (c) => {
	const estado = await Poller.get(
		nomePoller(String(c.env.ELEICAO_FEDERAL)),
	).obterEstado();
	return c.json(estado, {
		headers: { "cache-control": CACHE_API_APURACAO },
	});
});
