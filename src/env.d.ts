/**
 * Bindings do Worker. Os nomes de recurso acompanham `void.config.ts` e `void.lock.json`.
 * `LIMITE_AGENTE_*` ficam opcionais e fora desses arquivos por escolha do repo (#64):
 * o contador do Durable Object no ar é o teto. A #462 fechou; o void@1.2.1 trata `rate-limit`.
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
		/** Opcional. 30 requisições / 60 s por chave válida, quando o binding existir. */
		LIMITE_AGENTE_CHAVE?: RateLimit;
		/** Opcional. 5 tentativas / 60 s por IP sem chave válida, quando o binding existir. */
		LIMITE_AGENTE_IP?: RateLimit;
	}
}

interface Env extends Cloudflare.Env {}
