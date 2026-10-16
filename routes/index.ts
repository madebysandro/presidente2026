import { defineHandler } from "void";
import { Poller } from "../durable-objects/poller";
import { Pesquisas } from "../durable-objects/pesquisas";
import { nomePoller } from "../src/config/poller-nome";
import { relogioDaPagina } from "../src/pagina/ao-vivo";
import { documentoPesquisas, fragmentoPagina } from "../src/pagina/documento";
import { NOME_INSTANCIA } from "../src/pesquisas/fontes";

export const GET = defineHandler(async (c) => {
	const agora = new Date();
	const poller = Poller.get(nomePoller(String(c.env.ELEICAO_FEDERAL)));
	const apuracao = await poller.obterEstado();
	const historico = await poller.obterHistorico(0);
	const fase = apuracao.fase ?? "pesquisas";
	const agoraPagina = relogioDaPagina(fase, agora);
	const pesquisas = Pesquisas.get(NOME_INSTANCIA);
	await pesquisas.garantirImportInicial();
	const corpo = await pesquisas.listarPublico({
		agora: agoraPagina,
		encerrada: fase === "encerrada",
	});
	const noite = { apuracao: { ...apuracao, fase }, historico };
	if (c.req.query("fragmento") === "1") {
		return c.json(fragmentoPagina(corpo, agoraPagina, noite), {
			headers: { "cache-control": "no-cache" },
		});
	}
	return c.html(documentoPesquisas(corpo, agoraPagina, noite), 200, {
		"cache-control": "no-cache",
	});
});
