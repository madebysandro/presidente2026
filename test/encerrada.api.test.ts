/**
 * Issue #19 — poller para quando Presidente chega a 100% (#7: sem Pará/UFs).
 */
import { exports } from "cloudflare:workers";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
	cancelarAlarme,
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
	const resposta = await exports.default.fetch(
		new Request("http://presidente2026.test/api/apuracao"),
	);
	expect(resposta.status).toBe(200);
	return resposta.json() as Promise<ApuracaoApi>;
}

describe("Poller — encerramento a 100% (#19 / #7)", () => {
	let tse: ReturnType<typeof instalarTseFalso>;

	beforeEach(() => {
		tse = instalarTseFalso();
	});

	afterEach(async () => {
		await limparPoller();
	});

	it("com Presidente a 100% (pst \"100,00\"), grava encerrada e não agenda alarme", async () => {
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

	it("visitante depois do fim não religa o alarme", async () => {
		tse.definirVarianteSecoes({ padrao: "100,00", tf: "s" });
		await forcarConsulta();
		expect((await lerApuracao()).encerrada).toBe(true);

		await cancelarAlarme();
		const pedidosAntes = tse.pedidos.length;
		const dados = await lerApuracao();

		expect(dados.encerrada).toBe(true);
		expect(await lerAlarme()).toBeNull();
		expect(tse.pedidos.length).toBe(pedidosAntes);
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

	it("depois de encerrada, o histórico e o último estado continuam disponíveis", async () => {
		tse.definirVarianteSecoes({ padrao: "100,00", tf: "s" });
		await forcarConsulta();
		const estado = await lerApuracao();
		expect(estado.encerrada).toBe(true);

		const hist = await exports.default.fetch(
			new Request("http://presidente2026.test/api/historico"),
		);
		expect(hist.status).toBe(200);
		const leituras = (await hist.json()) as unknown[];
		expect(leituras.length).toBeGreaterThanOrEqual(1);

		const deNovo = await lerApuracao();
		expect(deNovo.encerrada).toBe(true);
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
