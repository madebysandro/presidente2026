import { SELF } from "cloudflare:test";

/**
 * Forma tipada do `Fetcher.scheduled` (workers-types experimental).
 * O `Fetcher` gerado em worker-configuration.d.ts ainda não declara o método;
 * o patch em scripts/patch-vpw-import-meta.mjs expõe a implementação no isolate.
 */
export type OpcoesCronSelf = {
	cron?: string;
	scheduledTime?: Date;
};

export type ResultadoCronSelf = {
	outcome: string;
	noRetry: boolean;
};

type SelfComScheduled = {
	scheduled(options?: OpcoesCronSelf): Promise<ResultadoCronSelf>;
};

export function selfComScheduled(): SelfComScheduled {
	return SELF as typeof SELF & SelfComScheduled;
}
