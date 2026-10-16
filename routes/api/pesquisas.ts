import { defineHandler } from "void";
import { Poller } from "../../durable-objects/poller";
import { Pesquisas } from "../../durable-objects/pesquisas";
import { nomePoller } from "../../src/config/poller-nome";
import { relogioDaPagina } from "../../src/pagina/ao-vivo";
import { NOME_INSTANCIA } from "../../src/pesquisas/fontes";

const CACHE_API_PESQUISAS = "public, max-age=0, s-maxage=30";

export const GET = defineHandler(async (c) => {
	const stub = Pesquisas.get(NOME_INSTANCIA);
	await stub.garantirImportInicial();
	const agora = new Date();
	const fase = await Poller.get(nomePoller(String(c.env.ELEICAO_FEDERAL))).fasePublica();
	const corpo = await stub.listarPublico({
		agora: relogioDaPagina(fase, agora),
		encerrada: fase === "encerrada",
	});
	return c.json(corpo, {
		headers: { "cache-control": CACHE_API_PESQUISAS },
	});
});
