import { defineHandler } from "void";
import { Pesquisas } from "../../durable-objects/pesquisas";
import { NOME_INSTANCIA } from "../../src/pesquisas/fontes";

const CACHE_API_PESQUISAS = "public, max-age=0, s-maxage=30";

export const GET = defineHandler(async (c) => {
	const stub = Pesquisas.get(NOME_INSTANCIA);
	await stub.garantirImportInicial();
	const corpo = await stub.listarPublico({ agora: new Date() });
	return c.json(corpo, {
		headers: { "cache-control": CACHE_API_PESQUISAS },
	});
});
