/**
 * Issue #19 adaptada a #7: com UFs ainda fora do ciclo, o DO ele-6258
 * NÃO grava encerrada (senão a Fase 2 herda o alarme morto).
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

describe("Poller — encerramento adiado até UFs (#7)", () => {
	let tse: ReturnType<typeof instalarTseFalso>;

	beforeEach(() => {
		tse = instalarTseFalso();
	});

	afterEach(async () => {
		await limparPoller();
	});

	it("com Presidente a 100%, NÃO grava encerrada e continua agendando (ciclo mínimo sem UFs)", async () => {
		tse.definirVarianteSecoes({ padrao: "100,00", tf: "s" });
		await forcarConsulta();
		const dados = await lerApuracao();

		expect(dados.encerrada).toBeFalsy();
		expect(dados.proximaConsulta).toEqual(expect.any(Number));
		expect(dados.erro).toBeNull();
		expect(dados.cargos.presidente?.apurado).toBe(100);
		expect(dados.cargos.governador).toBeUndefined();
		expect(await lerAlarme()).toEqual(expect.any(Number));
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

	it("histórico continua disponível enquanto o poller segue vivo a 100%", async () => {
		tse.definirVarianteSecoes({ padrao: "100,00", tf: "s" });
		await forcarConsulta();
		const estado = await lerApuracao();
		expect(estado.encerrada).toBeFalsy();

		const hist = await fetchWorker(
			new Request("http://presidente2026.test/api/historico"),
		);
		expect(hist.status).toBe(200);
		const leituras = (await hist.json()) as unknown[];
		expect(leituras.length).toBeGreaterThanOrEqual(1);

		const deNovo = await lerApuracao();
		expect(deNovo.encerrada).toBeFalsy();
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
