/**
 * Bindings do Worker. `void prepare` e `void/env` trazem o runtime;
 * os nomes daqui acompanham `void.config.ts` e `void.lock.json`.
 */
declare namespace Cloudflare {
	interface Env {
		ASSETS: Fetcher;
		TSE_BASE: string;
		ELEICAO_FEDERAL: string;
		POLLER: DurableObjectNamespace<import("./poller/poller").PollerApuracao>;
		PESQUISAS: DurableObjectNamespace<import("./pesquisas/pesquisas").Pesquisas>;
		CHAVE_AGENTE?: string;
		/** 30 requisições / 60 s por chave válida em /api/agente/*. */
		LIMITE_AGENTE_CHAVE?: RateLimit;
		/** 5 tentativas / 60 s por IP sem chave válida. */
		LIMITE_AGENTE_IP?: RateLimit;
	}
}

interface Env extends Cloudflare.Env {}
