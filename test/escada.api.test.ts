/**
 * Issue #24 — escada de intervalo do poller quando o ciclo não traz mudança.
 * Seam: GET /api/apuracao (`proximaConsulta`) + alarme do Durable Object.
 */
import { exports } from "cloudflare:workers";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
	forcarConsulta,
	lerAlarme,
	limparPoller,
} from "./helpers/poller";
import { instalarTseFalso } from "./helpers/tse-falso";

/** Escada acordada na issue #24 (segundos). */
const ESCADA = [60, 120, 300, 600, 1800, 3600] as const;

type ApuracaoApi = {
	versao: number;
	consultadoEm: number | null;
	proximaConsulta: number | null;
	erro: string | null;
	encerrada?: boolean;
};

async function lerApuracao(): Promise<ApuracaoApi> {
	const resposta = await exports.default.fetch(
		new Request("http://presidente2026.test/api/apuracao"),
	);
	expect(resposta.status).toBe(200);
	return resposta.json() as Promise<ApuracaoApi>;
}

function expectativaIntervalo(
	proximaConsulta: number,
	inicio: number,
	segundos: number,
) {
	expect(proximaConsulta).toBeGreaterThanOrEqual(inicio + segundos * 1000 - 50);
	expect(proximaConsulta).toBeLessThanOrEqual(Date.now() + segundos * 1000 + 50);
}

describe("Poller — escada sem mudança (#24)", () => {
	let tse: ReturnType<typeof instalarTseFalso>;

	beforeEach(() => {
		tse = instalarTseFalso();
		// max-age baixo para não mascarar a escada no caminho com mudança.
		tse.definirCacheControl("max-age=10");
	});

	afterEach(async () => {
		await limparPoller();
	});

	it("ciclos sucessivos sem mudança sobem a escada até 3600s", async () => {
		await forcarConsulta();
		const base = await lerApuracao();
		expect(base.versao).toBe(1);
		// Com mudança: piso max(30, max-age=10) = 30.
		expectativaIntervalo(base.proximaConsulta!, base.consultadoEm!, 30);

		for (const degrau of ESCADA) {
			const t = Date.now();
			await forcarConsulta();
			const dados = await lerApuracao();
			expect(dados.versao).toBe(1);
			expect(dados.erro).toBeNull();
			expectativaIntervalo(dados.proximaConsulta!, t, degrau);
			const alarme = await lerAlarme();
			expect(alarme).toEqual(expect.any(Number));
			expectativaIntervalo(alarme!, t, degrau);
		}

		// Teto: mais um ciclo sem mudança permanece em 3600.
		const tTeto = Date.now();
		await forcarConsulta();
		const teto = await lerApuracao();
		expectativaIntervalo(teto.proximaConsulta!, tTeto, 3600);
	});

	it("qualquer ciclo com mudança reseta a escada e usa max(30, max-age)", async () => {
		await forcarConsulta();
		await forcarConsulta(); // 60s
		await forcarConsulta(); // 120s
		const aposEscada = await lerApuracao();
		expect(aposEscada.versao).toBe(1);

		tse.definirCacheControl("max-age=45");
		tse.avancar();
		const t = Date.now();
		await forcarConsulta();
		const comMudanca = await lerApuracao();
		expect(comMudanca.versao).toBe(2);
		expectativaIntervalo(comMudanca.proximaConsulta!, t, 45);

		// Próximo sem mudança reinicia no primeiro degrau (60).
		tse.definirCacheControl("max-age=10");
		const t2 = Date.now();
		await forcarConsulta();
		const deNovo = await lerApuracao();
		expect(deNovo.versao).toBe(2);
		expectativaIntervalo(deNovo.proximaConsulta!, t2, 60);
	});

	it("erro/429 não usa a escada e não avança o degrau", async () => {
		await forcarConsulta();
		await forcarConsulta(); // 1º sem mudança → 60; próximo degrau seria 120

		const t429 = Date.now();
		tse.simular429(90);
		await forcarConsulta();
		const apos429 = await lerApuracao();
		expect(apos429.erro).toMatch(/429/);
		expectativaIntervalo(apos429.proximaConsulta!, t429, 90);

		const t503 = Date.now();
		tse.simularErro(503);
		await forcarConsulta();
		const apos503 = await lerApuracao();
		expect(apos503.erro).toMatch(/503/);
		// Backoff de erro: base 60 → 120 (não escada).
		expectativaIntervalo(apos503.proximaConsulta!, t503, 120);

		// Sucesso sem mudança: continua a escada de onde parou (próximo = 120).
		const tOk = Date.now();
		await forcarConsulta();
		const ok = await lerApuracao();
		expect(ok.erro).toBeNull();
		expect(ok.versao).toBe(1);
		expectativaIntervalo(ok.proximaConsulta!, tOk, 120);
	});

	it("com encerrada === true, nenhum alarme é reagendado", async () => {
		tse.definirVarianteSecoes({ padrao: "100,00", tf: "s" });
		await forcarConsulta();
		const fim = await lerApuracao();
		expect(fim.encerrada).toBe(true);
		expect(fim.proximaConsulta).toBeNull();
		expect(await lerAlarme()).toBeNull();

		await forcarConsulta();
		expect((await lerApuracao()).proximaConsulta).toBeNull();
		expect(await lerAlarme()).toBeNull();
	});

	it("com 100% e tf = n, a escada sobe em ciclos sem mudança", async () => {
		tse.definirVarianteSecoes({ padrao: "100,00", tf: "n" });
		await forcarConsulta();
		const primeiro = await lerApuracao();
		expect(primeiro.encerrada).toBeFalsy();
		expect(primeiro.versao).toBe(1);

		const t = Date.now();
		await forcarConsulta();
		const segundo = await lerApuracao();
		expect(segundo.encerrada).toBeFalsy();
		expect(segundo.versao).toBe(1);
		expectativaIntervalo(segundo.proximaConsulta!, t, 60);
		expect(await lerAlarme()).toEqual(expect.any(Number));
	});
});
