/**
 * Encerrada no 2º turno: Presidente + 27 UFs + exterior a 100% com `tf`.
 * Município não segura o fim. (#17, a partir de #19)
 */
import { fetchWorker } from "./helpers/fetch-worker";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
	forcarConsulta,
	lerAlarme,
	limparPoller,
} from "./helpers/poller";
import { instalarTseFalso } from "./helpers/tse-falso";

type ApuracaoApi = {
	versao: number;
	consultadoEm: number | null;
	proximaConsulta: number | null;
	erro: string | null;
	encerrada?: boolean;
	cargos: {
		presidente?: { apurado: number; hora: string };
		governador?: { apurado: number };
	};
};

async function lerApuracao(): Promise<ApuracaoApi> {
	const resposta = await fetchWorker(
		new Request("http://presidente2026.test/api/apuracao"),
	);
	expect(resposta.status).toBe(200);
	return resposta.json() as Promise<ApuracaoApi>;
}

describe("Poller — encerrada com UFs e exterior (#17)", () => {
	let tse: ReturnType<typeof instalarTseFalso>;

	beforeEach(() => {
		tse = instalarTseFalso();
	});

	afterEach(async () => {
		await limparPoller();
	});

	it("com Presidente, UFs e exterior a 100% e tf s, para de agendar", async () => {
		tse.definirVarianteSecoes({ padrao: "100,00", tf: "s" });
		await forcarConsulta();
		const dados = await lerApuracao();

		expect(dados.encerrada).toBe(true);
		expect(dados.proximaConsulta).toBeNull();
		expect(dados.erro).toBeNull();
		expect(dados.cargos.presidente?.apurado).toBe(100);
		expect(dados.cargos.governador).toBeUndefined();
		expect(await lerAlarme()).toBeNull();
	});

	it("com Presidente a 99,99%, continua agendando o alarme", async () => {
		tse.definirVarianteSecoes({ padrao: "99,99", tf: "s" });
		await forcarConsulta();
		const dados = await lerApuracao();

		expect(dados.encerrada).toBeFalsy();
		expect(dados.proximaConsulta).toEqual(expect.any(Number));
		expect(dados.cargos.presidente?.apurado).toBeCloseTo(99.99, 5);
		expect(await lerAlarme()).toEqual(expect.any(Number));
	});

	it("com pst a 100% mas tf ainda \"n\", continua consultando", async () => {
		tse.definirVarianteSecoes({ padrao: "100,00", tf: "n" });
		await forcarConsulta();
		const dados = await lerApuracao();

		expect(dados.cargos.presidente?.apurado).toBe(100);
		expect(dados.encerrada).toBeFalsy();
		expect(await lerAlarme()).toEqual(expect.any(Number));
	});

	it("erro no ciclo não encerra mesmo com fixtures a 100%", async () => {
		tse.definirVarianteSecoes({ padrao: "100,00", tf: "s" });
		tse.simularErro(503);
		await forcarConsulta();
		const dados = await lerApuracao();

		expect(dados.erro).toMatch(/503/);
		expect(dados.encerrada).toBeFalsy();
		expect(await lerAlarme()).toEqual(expect.any(Number));
	});

	it("429 no ciclo não encerra mesmo com fixtures a 100%", async () => {
		tse.definirVarianteSecoes({ padrao: "100,00", tf: "s" });
		tse.simular429(90);
		await forcarConsulta();
		const dados = await lerApuracao();

		expect(dados.erro).toMatch(/429/);
		expect(dados.encerrada).toBeFalsy();
	});

	it("histórico continua disponível depois de encerrar, sem novo alarme", async () => {
		tse.definirVarianteSecoes({ padrao: "100,00", tf: "s" });
		await forcarConsulta();
		const estado = await lerApuracao();
		expect(estado.encerrada).toBe(true);
		expect(await lerAlarme()).toBeNull();

		const hist = await fetchWorker(
			new Request("http://presidente2026.test/api/historico"),
		);
		expect(hist.status).toBe(200);
		const leituras = (await hist.json()) as unknown[];
		expect(leituras.length).toBeGreaterThanOrEqual(1);

		const deNovo = await lerApuracao();
		expect(deNovo.encerrada).toBe(true);
		expect(deNovo.proximaConsulta).toBeNull();
		expect(deNovo.cargos.presidente?.hora).toBe(
			estado.cargos.presidente?.hora,
		);
	});

	it("ciclo 304 com escopo guardado em tf \"n\" ou < 100% continua", async () => {
		tse.definirVarianteSecoes({ padrao: "100,00", tf: "n" });
		await forcarConsulta();
		expect((await lerApuracao()).encerrada).toBeFalsy();

		await forcarConsulta();
		expect((await lerApuracao()).encerrada).toBeFalsy();

		await limparPoller();
		tse = instalarTseFalso();

		tse.definirVarianteSecoes({ padrao: "99,99", tf: "s" });
		await forcarConsulta();
		await forcarConsulta();
		expect((await lerApuracao()).encerrada).toBeFalsy();
	});
});
