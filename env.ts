import { defineEnv, string } from "void/env";

/**
 * Segredo do agente. Fica `.optional()` de propósito: `void deploy` exige
 * no remoto toda chave de servidor sem isso, e `CHAVE_AGENTE` pode ainda
 * não existir em produção. Sem o valor, o site sobe e o agente responde 401.
 */
export default defineEnv({
	CHAVE_AGENTE: string().optional(),
});
