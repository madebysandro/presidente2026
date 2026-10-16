/**
 * Bindings do Worker. Os nomes acompanham `void.config.ts` e `void.lock.json`.
 * `void prepare` gera rotas e tsconfig em `.void/`. `void/env` traz o runtime.
 * Esta interface é o contrato dos bindings; a Void não emite esse arquivo.
 */
declare namespace Cloudflare {
	interface Env {
		ASSETS: Fetcher;
		TSE_BASE: string;
		ELEICAO_FEDERAL: string;
		POLLER: DurableObjectNamespace<import("./poller/poller").PollerApuracao>;
		PESQUISAS: DurableObjectNamespace<import("./pesquisas/pesquisas").Pesquisas>;
		CHAVE_AGENTE?: string;
		/** Plano B do CSV. Não autoriza `/api/agente/*` e não vai para o Grok Bot. */
		CHAVE_IMPORT?: string;
		/** 30 requisições / 60 s por chave válida em /api/agente/*. */
		LIMITE_AGENTE_CHAVE?: RateLimit;
		/** 5 tentativas / 60 s por IP sem chave válida. */
		LIMITE_AGENTE_IP?: RateLimit;
	}
}

interface Env extends Cloudflare.Env {}
