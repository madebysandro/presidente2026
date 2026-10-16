import { defineScheduled } from "void";
import type { Pesquisas as ClassePesquisas } from "../src/pesquisas/pesquisas";
import { NOME_INSTANCIA } from "../src/pesquisas/fontes";

/** 06h, 12h e 18h em Brasília (UTC−3, sem horário de verão). */
export const cron = ["0 9 * * *", "0 15 * * *", "0 21 * * *"];

export default defineScheduled(async (_controller, env) => {
	const namespace = env.PESQUISAS as DurableObjectNamespace<ClassePesquisas>;
	await namespace.getByName(NOME_INSTANCIA).importarDoTse({ motivo: "cron" });
});
