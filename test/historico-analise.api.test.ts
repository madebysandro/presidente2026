/**
 * Histórico de leituras e análises do Presidente (#5 adaptado a #7).
 */
import { fetchWorker } from "./helpers/fetch-worker";
import { runInDurableObject } from "cloudflare:test";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
	forcarConsulta,
	limparPoller,
	stubPoller,
} from "./helpers/poller";
import { instalarTseFalso } from "./helpers/tse-falso";

type LeituraApi = {
	t: number;
	c: Record<
		string,
		{
			ap: number;
			hora: string;
			vv: number;
			c: Record<string, [number, number, number]>;
		}
	>;
};

type TendenciaApi = { n: string; nome: string; ppPor10pct: number };

type AnaliseMajApi = {
	defensor: { n: string; nome: string; votos: number; pct: number };
	perseguidor: { n: string; nome: string; votos: number; pct: number };
	vantagemVotos: number;
	vantagemPp: number;
	evolucaoVantagemPp: number[];
	validosAApurar: number | null;
	margemParaVirarPp: number | null;
	foraDeAlcance: boolean;
	primeiroTurno: null | {
		fatiaPct: number | null;
		status: "ok" | "maioria" | "fora";
	};
	tendencias: TendenciaApi[];
};

type ApuracaoApi = {
	versao: number;
	cargos: {
		presidente?: {
			apurado: number;
			hora: string;
			totais: {
				validos: number;
				eleitorado: number;
			};
		};
	};
	analise?: {
		majoritarias?: Record<string, AnaliseMajApi | undefined>;
	};
};

async function lerApuracao(): Promise<ApuracaoApi> {
	const resposta = await fetchWorker(
		new Request("http://presidente2026.test/api/apuracao"),
	);
	expect(resposta.status).toBe(200);
	return resposta.json() as Promise<ApuracaoApi>;
}

async function lerHistorico(desde = 0): Promise<LeituraApi[]> {
	const resposta = await fetchWorker(
		new Request(`http://presidente2026.test/api/historico?desde=${desde}`),
	);
	expect(resposta.status).toBe(200);
	return resposta.json() as Promise<LeituraApi[]>;
}

describe("GET /api/historico — leituras do Presidente (#7)", () => {
	let tse: ReturnType<typeof instalarTseFalso>;

	beforeEach(() => {
		tse = instalarTseFalso();
	});

	afterEach(async () => {
		await limparPoller();
	});

	it("avançando as fixtures, cada mudança gera uma Leitura; 304 não gera; desde filtra", async () => {
		await forcarConsulta();
		const h1 = await lerHistorico();
		expect(h1).toHaveLength(1);
		expect(h1[0].c.presidente?.hora).toBe("18:32:24");
		expect(h1[0].c.presidente?.c["22"]?.[0]).toBe(18644760);
		expect(h1[0].c.governador).toBeUndefined();
		expect(h1[0].c.senador).toBeUndefined();
		const t0 = h1[0].t;

		await forcarConsulta();
		expect(await lerHistorico()).toHaveLength(1);
		expect(await lerHistorico(t0)).toHaveLength(0);

		tse.avancar();
		await forcarConsulta();
		const h2 = await lerHistorico();
		expect(h2).toHaveLength(2);
		expect(h2[1].c.presidente?.hora).toBe("18:37:14");
		expect(h2[1].c.presidente?.c["22"]?.[0]).toBe(21383323);
		expect(h2[1].t).toBeGreaterThan(t0);

		const soNovas = await lerHistorico(t0);
		expect(soNovas).toHaveLength(1);
		expect(soNovas[0].t).toBe(h2[1].t);

		const gravado = await runInDurableObject(
			stubPoller(),
			async (_inst, state) =>
				state.storage.get<LeituraApi[]>("historico"),
		);
		expect(gravado).toHaveLength(2);
	});
});

describe("GET /api/apuracao — analise.majoritarias Presidente (#7)", () => {
	let tse: ReturnType<typeof instalarTseFalso>;

	beforeEach(() => {
		tse = instalarTseFalso();
	});

	afterEach(async () => {
		await limparPoller();
	});

	it("na primeira leitura, devolve votos a apurar, margem e 1º turno; tendência ainda aguarda", async () => {
		await forcarConsulta();
		const dados = await lerApuracao();
		const p = dados.analise?.majoritarias?.presidente;
		expect(p).toBeTruthy();

		expect(p!.defensor.n).toBe("22");
		expect(p!.perseguidor.n).toBe("13");
		expect(p!.vantagemVotos).toBe(3_526_861);
		expect(p!.vantagemPp).toBeCloseTo(9.598698968, 6);
		expect(p!.validosAApurar).toBeCloseTo(83_541_013.27083544, 2);
		expect(p!.margemParaVirarPp).toBeCloseTo(4.221712021335087, 6);
		expect(p!.foraDeAlcance).toBe(false);
		expect(p!.primeiroTurno?.status).toBe("ok");
		expect(p!.primeiroTurno?.fatiaPct).toBeCloseTo(49.67297200584066, 6);
		expect(p!.tendencias).toEqual([]);
		expect(p!.evolucaoVantagemPp).toHaveLength(1);
		expect(dados.analise?.majoritarias?.governador).toBeUndefined();
	});

	it("com 3 leituras e avanço real na apuração, a tendência aparece", async () => {
		await forcarConsulta();
		expect(
			(await lerApuracao()).analise?.majoritarias?.presidente?.tendencias,
		).toEqual([]);

		tse.avancar();
		await forcarConsulta();
		expect(
			(await lerApuracao()).analise?.majoritarias?.presidente?.tendencias,
		).toEqual([]);

		tse.avancar();
		await forcarConsulta();
		const p = (await lerApuracao()).analise?.majoritarias?.presidente;
		expect(p!.tendencias.length).toBeGreaterThanOrEqual(2);

		const t22 = p!.tendencias.find((t) => t.n === "22");
		const t13 = p!.tendencias.find((t) => t.n === "13");
		expect(t22).toBeTruthy();
		expect(t13).toBeTruthy();
		expect(t22!.ppPor10pct).toBeCloseTo(-0.34623498054450036, 6);
		expect(t13!.ppPor10pct).toBeCloseTo(0.3039779242303382, 6);

		expect(p!.evolucaoVantagemPp).toHaveLength(3);
		expect(p!.vantagemVotos).toBe(4_309_702);
		expect(p!.validosAApurar).toBeCloseTo(72_068_643.47001496, 2);
		expect(p!.margemParaVirarPp).toBeCloseTo(5.97999600449411, 6);
	});
});
