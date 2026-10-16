import { SELF } from "cloudflare:test";

/**
 * Forma tipada do `Fetcher.scheduled`.
 * O patch em scripts/patch-vpw-self-scheduled.mjs expõe a implementação no isolate.
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
