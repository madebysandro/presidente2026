/**
 * Issue #124 — o TSE pausou a divulgação e só volta às 19h de Brasília.
 * Seam: GET /api/apuracao (`proximaConsulta`) + alarme do Durable Object.
 */
import { fetchWorker } from "./helpers/fetch-worker";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PAUSA_TSE } from "../src/apuracao/pausa-tse";
import {
	forcarConsulta,
	lerAlarme,
	limparPoller,
	stubPoller,
} from "./helpers/poller";
import { instalarTseFalso } from "./helpers/tse-falso";
import { runInDurableObject } from "cloudflare:test";

const FIM = Date.parse(PAUSA_TSE.fim);
const DENTRO = Date.parse("2026-10-25T18:00:00-03:00");
const DEPOIS = Date.parse("2026-10-25T19:01:00-03:00");

type ApuracaoApi = {
	versao: number;
	fase: string;
	proximaConsulta: number | null;
};

async function lerApuracao(): Promise<ApuracaoApi> {
	const resposta = await fetchWorker(
		new Request("http://presidente2026.test/api/apuracao"),
	);
	expect(resposta.status).toBe(200);
	return resposta.json() as Promise<ApuracaoApi>;
}

async function fixarRelogio(ms: number): Promise<void> {
	vi.spyOn(Date, "now").mockReturnValue(ms);
	await stubPoller().fixarAgora(ms);
}

describe("Poller — pausa do TSE até 19h (#124)", () => {
	let tse: ReturnType<typeof instalarTseFalso>;

	beforeEach(async () => {
		await fixarRelogio(DENTRO);
		tse = instalarTseFalso();
		tse.definirCacheControl("max-age=10");
	});

	afterEach(async () => {
		vi.restoreAllMocks();
		await limparPoller();
	});

	it("dentro da pausa a próxima consulta e o alarme caem às 19h, com ou sem mudança", async () => {
		await forcarConsulta();
		const primeira = await lerApuracao();
		expect(primeira.fase).toBe("ao_vivo");
		expect(primeira.proximaConsulta).toBe(FIM);
		expect(await lerAlarme()).toBe(FIM);

		await forcarConsulta();
		const semMudanca = await lerApuracao();
		expect(semMudanca.proximaConsulta).toBe(FIM);
		expect(await lerAlarme()).toBe(FIM);
	});

	it("um alarme antigo do ciclo de 30 min é realinhado às 19h na leitura", async () => {
		await runInDurableObject(stubPoller(), async (_inst, state) => {
			await state.storage.setAlarm(DENTRO + 30 * 60_000);
		});
		const dados = await lerApuracao();
		expect(dados.proximaConsulta).toBe(FIM);
		expect(await lerAlarme()).toBe(FIM);
	});

	it("o alarme realinhado sem consulta na pausa também volta às 19h no primeiro degrau", async () => {
		await fixarRelogio(Date.parse("2026-10-25T17:00:00-03:00"));
		for (let i = 0; i < 6; i++) await forcarConsulta();

		await fixarRelogio(DENTRO);
		expect((await lerApuracao()).proximaConsulta).toBe(FIM);

		await fixarRelogio(DEPOIS);
		await forcarConsulta();
		expect((await lerApuracao()).proximaConsulta).toBe(DEPOIS + 60_000);
	});

	it("depois das 19h volta o ritmo normal, do primeiro degrau da escada", async () => {
		await forcarConsulta();
		await forcarConsulta();
		await forcarConsulta();

		await fixarRelogio(DEPOIS);
		await forcarConsulta();
		const semMudanca = await lerApuracao();
		expect(semMudanca.proximaConsulta).toBe(DEPOIS + 60_000);
		expect(await lerAlarme()).toBe(DEPOIS + 60_000);

		tse.avancar();
		await forcarConsulta();
		const comMudanca = await lerApuracao();
		expect(comMudanca.versao).toBe(2);
		expect(comMudanca.proximaConsulta).toBe(DEPOIS + 30_000);
	});
});
