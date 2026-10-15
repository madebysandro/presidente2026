import { runInDurableObject } from "cloudflare:test";
import { env } from "cloudflare:workers";
import { nomePoller } from "../../src/config/poller-nome";
import type { PollerApuracao } from "../../src/poller/poller";

export function nomeDoPollerDeTeste(): string {
	return nomePoller(env.ELEICAO_FEDERAL);
}

export function stubPoller(): DurableObjectStub<PollerApuracao> {
	return env.POLLER.getByName(
		nomeDoPollerDeTeste(),
	) as DurableObjectStub<PollerApuracao>;
}

export async function forcarConsulta(): Promise<void> {
	await stubPoller().consultarAgora();
}

export async function limparPoller(): Promise<void> {
	await runInDurableObject(stubPoller(), async (_inst, state) => {
		await state.storage.deleteAll();
	});
}

export async function lerAlarme(): Promise<number | null> {
	return runInDurableObject(stubPoller(), async (_inst, state) =>
		state.storage.getAlarm(),
	);
}

export async function cancelarAlarme(): Promise<void> {
	await runInDurableObject(stubPoller(), async (_inst, state) => {
		await state.storage.deleteAlarm();
	});
}
