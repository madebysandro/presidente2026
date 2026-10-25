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

type AlarmeStorage = Pick<
	DurableObjectStorage,
	"setAlarm" | "getAlarm" | "deleteAlarm"
>;

/**
 * Troca o alarme do storage por um em memória: o Miniflare dispara na hora um alarme
 * cujo horário já passou no relógio real, e os testes com relógio fixo em 25/10/2026
 * rodariam ciclos extras. `restaurarAlarmes` desfaz.
 */
export async function congelarAlarmes(): Promise<void> {
	await runInDurableObject(stubPoller(), async (_inst, state) => {
		await state.storage.deleteAlarm();
		let alarme: number | null = null;
		const falso: AlarmeStorage = {
			setAlarm: async (quando) => {
				alarme = typeof quando === "number" ? quando : quando.getTime();
			},
			getAlarm: async () => alarme,
			deleteAlarm: async () => {
				alarme = null;
			},
		};
		Object.assign(state.storage, falso);
	});
}

export async function restaurarAlarmes(): Promise<void> {
	await runInDurableObject(stubPoller(), async (_inst, state) => {
		const storage = state.storage as Partial<AlarmeStorage>;
		delete storage.setAlarm;
		delete storage.getAlarm;
		delete storage.deleteAlarm;
	});
}
