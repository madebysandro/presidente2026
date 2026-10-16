import { defineScheduled } from "void";
import { Pesquisas } from "../durable-objects/pesquisas";
import { NOME_INSTANCIA } from "../src/pesquisas/fontes";

/** 06h, 12h e 18h em Brasília (UTC−3, sem horário de verão). */
export const cron = ["0 9 * * *", "0 15 * * *", "0 21 * * *"];

export default defineScheduled(async () => {
	await Pesquisas.get(NOME_INSTANCIA).importarDoTse({ motivo: "cron" });
});
