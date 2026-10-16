import { defineHandler } from "void";
import { Pesquisas } from "../durable-objects/pesquisas";
import { documentoPesquisas } from "../src/pagina/documento";
import { NOME_INSTANCIA } from "../src/pesquisas/fontes";

export const GET = defineHandler(async (c) => {
	const agora = new Date();
	const pesquisas = Pesquisas.get(NOME_INSTANCIA);
	await pesquisas.garantirImportInicial();
	const corpo = await pesquisas.listarPublico({ agora });
	c.header("cache-control", "no-cache");
	return documentoPesquisas(corpo, agora);
});
