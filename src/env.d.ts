interface Env {
	CHAVE_AGENTE?: string;
	/** 30 requisições / 60 s por chave válida em /api/agente/*. */
	LIMITE_AGENTE_CHAVE?: RateLimit;
	/** 5 tentativas / 60 s por IP sem chave válida. */
	LIMITE_AGENTE_IP?: RateLimit;
}
