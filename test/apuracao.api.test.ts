/**
 * Aceite #7: GET /api/apuracao com TSE falso do 6258 — só Presidente Brasil.
 */
import { runDurableObjectAlarm } from "cloudflare:test";
import { exports } from "cloudflare:workers";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
	forcarConsulta,
	lerAlarme,
	limparPoller,
	stubPoller,
} from "./helpers/poller";
import { instalarTseFalso, URLS_TSE } from "./helpers/tse-falso";

type CandidatoApi = {
	n: string;
	nome: string;
	partido: string;
	votos: number;
	pct: number;
	pos: number;
	foto?: string;
};

type CargoApi = {
	titulo: string;
	local: string;
	vagas: number;
	hora: string;
	apurado: number;
	candidatos: CandidatoApi[];
};

type ApuracaoApi = {
	versao: number;
	consultadoEm: number | null;
	proximaConsulta: number | null;
	erro: string | null;
	cargos: Record<string, CargoApi | undefined>;
};

async function lerApuracao(opts?: { headers?: HeadersInit }) {
	const resposta = await exports.default.fetch(
		new Request("http://presidente2026.test/api/apuracao", {
			headers: opts?.headers,
		}),
	);
	expect(resposta.status).toBe(200);
	const dados = (await resposta.json()) as ApuracaoApi;
	return { dados, resposta };
}

describe("GET /api/apuracao — Presidente 6258 (#7)", () => {
	let tse: ReturnType<typeof instalarTseFalso>;

	beforeEach(() => {
		tse = instalarTseFalso();
	});

	afterEach(async () => {
		await limparPoller();
	});

	it("com TSE falso (zerado ou fixture), devolve só Presidente Brasil sem Pará/proporcionais", async () => {
		tse.definirVarianteSecoes({ padrao: 0, tf: "n" });
		await forcarConsulta();
		const { dados } = await lerApuracao();

		expect(dados.versao).toBe(1);
		expect(dados.erro).toBeNull();
		expect(dados.cargos.presidente).toBeTruthy();
		expect(dados.cargos.presidente!.titulo).toBe("Presidente");
		expect(dados.cargos.presidente!.local).toBe("Brasil");
		expect(dados.cargos.presidente!.apurado).toBe(0);
		expect(dados.cargos.governador).toBeUndefined();
		expect(dados.cargos.senador).toBeUndefined();
		expect(dados.cargos.depfed).toBeUndefined();
		expect(dados.cargos.depest).toBeUndefined();
		expect(Object.keys(dados.cargos)).toEqual(["presidente"]);
	});

	it("com a primeira fixture, devolve o Presidente normalizado (vírgula, ordem, foto 6258)", async () => {
		await forcarConsulta();
		const { dados } = await lerApuracao();

		expect(dados.versao).toBe(1);
		expect(dados.consultadoEm).toEqual(expect.any(Number));
		expect(dados.proximaConsulta).toEqual(expect.any(Number));
		expect(dados.erro).toBeNull();

		const p = dados.cargos.presidente!;
		expect(p.hora).toBe("18:32:24");
		expect(p.apurado).toBeCloseTo(31.896372144, 6);
		expect(p.vagas).toBe(1);
		expect(p.candidatos[0]).toMatchObject({
			n: "22",
			nome: "FLAVIO BOLSONARO",
			partido: "PL",
			votos: 18644760,
			pos: 1,
			foto: "https://resultados.tse.jus.br/oficial/ele2026/6258/fotos/br/280002551544.jpeg",
		});
		expect(p.candidatos[0].pct).toBeCloseTo(50.743547465, 6);
		expect(p.candidatos[1]).toMatchObject({
			n: "13",
			nome: "LULA",
			partido: "PT",
			votos: 15117899,
			pos: 2,
		});
	});

	it("o DO do poller é ele-6258 (não singleton do 1º turno)", async () => {
		await forcarConsulta();
		const stub = stubPoller();
		expect(stub.name).toBe("ele-6258");
		const { dados } = await lerApuracao();
		expect(dados.cargos.presidente).toBeTruthy();
	});

	it("ao avançar a fixture, a versao muda; 304 não muda a versao", async () => {
		await forcarConsulta();
		const { dados: primeiro } = await lerApuracao();
		expect(primeiro.versao).toBe(1);

		const pedidosAposPrimeiro = tse.pedidos.length;
		await forcarConsulta();
		const { dados: repetido } = await lerApuracao();
		expect(repetido.versao).toBe(1);

		const pedidosSegundoCiclo = tse.pedidos.slice(pedidosAposPrimeiro);
		expect(pedidosSegundoCiclo.length).toBeGreaterThanOrEqual(1);
		for (const pedido of pedidosSegundoCiclo) {
			expect(pedido.ifNoneMatch).toMatch(/^"/);
		}
		expect(
			pedidosSegundoCiclo.some((p) => p.url === URLS_TSE.presidente),
		).toBe(true);

		tse.avancar();
		await forcarConsulta();
		const { dados: segundo } = await lerApuracao();
		expect(segundo.versao).toBe(2);
		expect(segundo.cargos.presidente!.hora).toBe("18:37:14");

		const rodou = await runDurableObjectAlarm(stubPoller());
		expect(rodou).toBe(true);
		expect((await lerApuracao()).dados.versao).toBe(2);
	});

	it("agenda a próxima consulta em max(30 s, max-age) do cache-control", async () => {
		const antes = Date.now();
		tse.definirCacheControl("max-age=45");
		await forcarConsulta();
		const { dados } = await lerApuracao();
		const alarme = await lerAlarme();

		expect(dados.proximaConsulta!).toBeGreaterThanOrEqual(antes + 45_000 - 50);
		expect(alarme!).toBeGreaterThanOrEqual(antes + 45_000 - 50);

		tse.definirCacheControl("max-age=10");
		tse.avancar();
		const antesPiso = Date.now();
		await forcarConsulta();
		const aposPiso = (await lerApuracao()).dados;
		expect(aposPiso.proximaConsulta!).toBeGreaterThanOrEqual(
			antesPiso + 30_000 - 50,
		);
	});

	it("num 429 com Retry-After, a próxima consulta respeita o valor e registra erro", async () => {
		await forcarConsulta();
		const versaoOk = (await lerApuracao()).dados.versao;
		const antes = Date.now();
		tse.simular429(90);
		await forcarConsulta();
		const { dados } = await lerApuracao();
		expect(dados.erro).toMatch(/429/);
		expect(dados.versao).toBe(versaoOk);
		expect(dados.proximaConsulta!).toBeGreaterThanOrEqual(antes + 90_000 - 50);
	});

	it("noutros erros, a espera dobra até 10 min", async () => {
		await forcarConsulta();
		const versaoOk = (await lerApuracao()).dados.versao;

		const t1 = Date.now();
		tse.simularErro(503);
		await forcarConsulta();
		const erro1 = (await lerApuracao()).dados;
		expect(erro1.erro).toMatch(/503/);
		expect(erro1.versao).toBe(versaoOk);
		expect(erro1.proximaConsulta! - t1).toBeGreaterThanOrEqual(120_000 - 50);

		const t2 = Date.now();
		tse.simularErro(503);
		await forcarConsulta();
		expect(
			(await lerApuracao()).dados.proximaConsulta! - t2,
		).toBeGreaterThanOrEqual(240_000 - 50);

		for (let i = 0; i < 4; i++) {
			tse.simularErro(503);
			await forcarConsulta();
		}
		const tTeto = Date.now();
		tse.simularErro(503);
		await forcarConsulta();
		expect(
			(await lerApuracao()).dados.proximaConsulta! - tTeto,
		).toBeGreaterThanOrEqual(600_000 - 50);
	});

	it("responde /api/apuracao com cache curto na borda (s-maxage)", async () => {
		await forcarConsulta();
		const { resposta } = await lerApuracao();
		const cc = resposta.headers.get("cache-control") ?? "";
		expect(cc).toMatch(/s-maxage=\d+/i);
		const sMaxAge = Number(/s-maxage=(\d+)/i.exec(cc)?.[1]);
		expect(sMaxAge).toBeGreaterThan(0);
		expect(sMaxAge).toBeLessThanOrEqual(30);
	});
});
