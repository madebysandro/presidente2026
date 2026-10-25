import { defineHandler } from "void";
import { Poller } from "../durable-objects/poller";
import { Pesquisas } from "../durable-objects/pesquisas";
import { nomePoller } from "../src/config/poller-nome";
import { relogioDaPagina } from "../src/pagina/ao-vivo";
import { pngDaPrevia } from "../src/pagina/previa-png";
import { NOME_INSTANCIA } from "../src/pesquisas/fontes";

export const GET = defineHandler(async (c) => {
	const agora = new Date();
	const poller = Poller.get(nomePoller(String(c.env.ELEICAO_FEDERAL)));
	const apuracao = await poller.obterEstado();
	const fase = apuracao.fase ?? "pesquisas";
	const agoraPagina = relogioDaPagina(fase, agora);
	const pesquisas = Pesquisas.get(NOME_INSTANCIA);
	await pesquisas.garantirImportInicial();
	const corpo = await pesquisas.listarPublico({
		agora: agoraPagina,
		encerrada: fase === "encerrada",
	});
	const png = await pngDaPrevia(
		{ fetch: (url: URL) => c.env.ASSETS.fetch(new Request(url)) },
		c.req.url,
		{ fase, agora: agoraPagina, pesquisas: corpo, apuracao },
	);
	return new Response(png, {
		headers: {
			"content-type": "image/png",
			"cache-control": "public, max-age=600",
		},
	});
});
