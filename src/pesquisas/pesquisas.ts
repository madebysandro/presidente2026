import { DurableObject } from "cloudflare:workers";

/**
 * Singleton SQLite para o registro/resultados de pesquisas (#7).
 * Vazio por enquanto: só ping/estado para o import da próxima fatia.
 */
export class Pesquisas extends DurableObject<Env> {
	async ping(): Promise<{ ok: true }> {
		return { ok: true };
	}

	async obterEstado(): Promise<{ pronto: true; registros: number }> {
		return { pronto: true, registros: 0 };
	}
}
