/**
 * Aceite #86: com a apuração encerrada, pesquisas e agente ficam congelados.
 * Seam: cron, GET /api/pesquisas, POST /api/import e /api/agente/*.
 */
import { runInDurableObject } from "cloudflare:test";
import { env } from "cloudflare:workers";
import { http, HttpResponse } from "msw";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import dia0ContratanteUrl from "../fixtures/pesquisas-tse/fixture_dia0_contratante.zip?inline";
import dia0PesquisaUrl from "../fixtures/pesquisas-tse/fixture_dia0_pesquisa.zip?inline";
import dia1ContratanteUrl from "../fixtures/pesquisas-tse/fixture_dia1_contratante.zip?inline";
import dia1PesquisaUrl from "../fixtures/pesquisas-tse/fixture_dia1_pesquisa.zip?inline";
import { recorteNacionalDeZips } from "../src/pesquisas/plano-b";
import type { Pesquisas } from "../src/pesquisas/pesquisas";
import { bytesDeDataUrl, instalarCdnPesquisas, pedidosCdn } from "./helpers/cdn-pesquisas";
import { fetchWorker } from "./helpers/fetch-worker";
import { forcarConsulta, limparPoller } from "./helpers/poller";
import { network } from "./helpers/rede";
import { selfComScheduled } from "./helpers/self-scheduled";
import { instalarTseFalso } from "./helpers/tse-falso";

const CHAVE = "teste-chave-agente";
const CHAVE_IMPORT = "teste-chave-import";
const DATAFOLHA = "BR-02949/2026";
const QUAEST = "BR-08729/2026";
const VEM_AI = "BR-00820/2026";
const FONTE = "https://www.metropoles.com/brasil/datafolha-2o-turno-flavio-tem-52-e-lula-48";
const DECISAO = "https://www.tse.jus.br/decisao/liminar-14";
const ENCERRADA = {
	erro: "apuracao_encerrada",
	detalhe: "a apuração do 2º turno foi encerrada; pesquisas e resultados estão congelados",
};

const dia0Pesquisa = bytesDeDataUrl(dia0PesquisaUrl);
const dia0Contratante = bytesDeDataUrl(dia0ContratanteUrl);
const dia1Pesquisa = bytesDeDataUrl(dia1PesquisaUrl);
const dia1Contratante = bytesDeDataUrl(dia1ContratanteUrl);

function stub(): DurableObjectStub<Pesquisas> {
	return env.PESQUISAS.getByName("singleton") as DurableObjectStub<Pesquisas>;
}

function instalarDia0(): void {
	instalarCdnPesquisas({
		pesquisa: dia0Pesquisa,
		contratante: dia0Contratante,
		etagPesquisa: '"dia0-pesquisa"',
		etagContratante: '"dia0-contratante"',
		condicional304: false,
	});
}

function instalarDia1(): void {
	instalarCdnPesquisas({
		pesquisa: dia1Pesquisa,
		contratante: dia1Contratante,
		etagPesquisa: '"dia1-pesquisa"',
		etagContratante: '"dia1-contratante"',
		condicional304: false,
	});
}

function pedido(
	metodo: "POST" | "DELETE",
	caminho: string,
	corpo: unknown,
	chave: string | null = CHAVE,
): Promise<Response> {
	const headers = new Headers({ "content-type": "application/json" });
	if (chave) headers.set("authorization", `Bearer ${chave}`);
	return fetchWorker(
		new Request(`http://presidente2026.test${caminho}`, {
			method: metodo,
			headers,
			body: JSON.stringify(corpo),
		}),
	);
}

function corpoResultado(extra: Record<string, unknown> = {}) {
	return {
		registro: DATAFOLHA,
		totais: { flavio: 49, lula: 45, brancoNulo: 5, naoSabe: 1 },
		validosPublicados: { flavio: 52, lula: 48 },
		fonte: FONTE,
		margem: null,
		confianca: null,
		substituir: false,
		...extra,
	};
}

async function lerPublico(caminho: string): Promise<string> {
	const resposta = await fetchWorker(new Request(`http://presidente2026.test${caminho}`));
	expect(resposta.status).toBe(200);
	return resposta.text();
}

async function encerrarApuracao(): Promise<void> {
	const tse = instalarTseFalso();
	tse.definirVarianteSecoes({ padrao: "100,00", tf: "s" });
	await forcarConsulta();
	const apuracao = JSON.parse(await lerPublico("/api/apuracao")) as { encerrada?: boolean };
	expect(apuracao.encerrada).toBe(true);
}

/** Import do dia 0, Datafolha publicada e a pesquisa que vem aí suspensa. */
async function prepararArquivo(): Promise<void> {
	instalarDia0();
	await stub().importarDoTse({ motivo: "teste" });
	network.use(http.get(FONTE, () => HttpResponse.html("<p>Datafolha: Flávio 49% e Lula 45%.</p>")));
	expect((await pedido("POST", "/api/agente/resultados", corpoResultado())).status).toBe(201);
	const suspensa = await pedido("POST", "/api/agente/suspensoes", {
		registro: VEM_AI,
		decisaoUrl: DECISAO,
		motivo: "liminar",
	});
	expect(suspensa.status).toBe(201);
}

async function tabelas(): Promise<Record<string, unknown[]>> {
	return runInDurableObject(stub(), (_inst, state) => {
		const ler = (sql: string) => state.storage.sql.exec(sql).toArray();
		return {
			registros: ler("SELECT * FROM registros ORDER BY registro"),
			meta: ler("SELECT * FROM meta_import"),
			resultados: ler("SELECT * FROM resultados ORDER BY registro"),
			historico: ler("SELECT * FROM resultados_historico ORDER BY id"),
			suspensoes: ler("SELECT * FROM suspensoes ORDER BY registro"),
		};
	});
}

beforeEach(async () => {
	await runInDurableObject(stub(), async (_inst, state) => {
		await state.storage.deleteAll();
	});
});

afterEach(async () => {
	await limparPoller();
});

describe("pesquisas congeladas com a apuração encerrada (#86)", () => {
	it("o cron não baixa nem aplica o registro do TSE", async () => {
		await prepararArquivo();
		await encerrarApuracao();
		const antes = await tabelas();
		const publicoAntes = await lerPublico("/api/pesquisas");

		instalarDia1();
		const cron = await selfComScheduled().scheduled({
			cron: "0 9 * * *",
			scheduledTime: new Date("2026-10-26T09:00:00Z"),
		});
		expect(cron.outcome).toBe("ok");
		await expect(stub().importarDoTse({ motivo: "teste" })).resolves.toEqual({ kind: "congelado" });

		expect(pedidosCdn).toEqual([]);
		expect(await tabelas()).toEqual(antes);
		expect(await lerPublico("/api/pesquisas")).toBe(publicoAntes);
	});

	it("o primeiro acesso com banco vazio não importa", async () => {
		await encerrarApuracao();
		instalarDia0();

		await lerPublico("/api/pesquisas");
		await lerPublico("/");

		expect(pedidosCdn).toEqual([]);
		expect((await stub().obterEstado()).registros).toBe(0);
	});

	it("o plano B responde 409 e não grava", async () => {
		await prepararArquivo();
		await encerrarApuracao();
		const antes = await tabelas();
		const recorte = (await recorteNacionalDeZips(dia0Pesquisa, dia0Contratante)).filter(
			(registro) => registro.registro !== QUAEST,
		);

		const resposta = await pedido("POST", "/api/import", { registros: recorte }, CHAVE_IMPORT);

		expect(resposta.status).toBe(409);
		expect(resposta.headers.get("cache-control")).toBe("no-store");
		expect(await resposta.json()).toEqual(ENCERRADA);
		expect(await tabelas()).toEqual(antes);
	});

	it("o agente não publica, não substitui, não suspende nem reativa, e a auditoria registra", async () => {
		await prepararArquivo();
		await encerrarApuracao();
		const antes = await tabelas();
		const pesquisasAntes = await lerPublico("/api/pesquisas");
		const apuracaoAntes = await lerPublico("/api/apuracao");
		const auditoriaAntes = (await stub().listarAuditoriaAgente()).length;
		const tentativas = [
			{
				metodo: "POST" as const,
				rota: "/api/agente/resultados",
				caminho: "/api/agente/resultados",
				registro: QUAEST,
				corpo: corpoResultado({ registro: QUAEST, fonte: "https://www.poder360.com.br/quaest" }),
			},
			{
				metodo: "POST" as const,
				rota: "/api/agente/resultados",
				caminho: "/api/agente/resultados",
				registro: DATAFOLHA,
				corpo: corpoResultado({
					totais: { flavio: 48, lula: 46, brancoNulo: 5, naoSabe: 1 },
					validosPublicados: { flavio: 51, lula: 49 },
					substituir: true,
				}),
			},
			{
				metodo: "POST" as const,
				rota: "/api/agente/suspensoes",
				caminho: "/api/agente/suspensoes",
				registro: DATAFOLHA,
				corpo: { registro: DATAFOLHA, decisaoUrl: DECISAO, motivo: "liminar" },
			},
			{
				metodo: "DELETE" as const,
				rota: "/api/agente/suspensoes",
				caminho: `/api/agente/suspensoes/${VEM_AI}`,
				registro: VEM_AI,
				corpo: { motivo: "decisão revogada" },
			},
		];

		for (const tentativa of tentativas) {
			const resposta = await pedido(tentativa.metodo, tentativa.caminho, tentativa.corpo);
			expect(resposta.status, tentativa.caminho).toBe(409);
			expect(resposta.headers.get("cache-control")).toBe("no-store");
			expect(await resposta.json()).toEqual(ENCERRADA);
		}

		const auditoria = (await stub().listarAuditoriaAgente()).slice(auditoriaAntes);
		expect(
			auditoria.map(({ rota, metodo, registro, status, motivos, chaveValida }) => ({
				rota,
				metodo,
				registro,
				status,
				motivos,
				chaveValida,
			})),
		).toEqual(
			tentativas.map((tentativa) => ({
				rota: tentativa.rota,
				metodo: tentativa.metodo,
				registro: tentativa.registro,
				status: 409,
				motivos: ["apuracao_encerrada"],
				chaveValida: true,
			})),
		);
		expect(auditoria.map((entrada) => JSON.parse(entrada.corpo))).toEqual(
			tentativas.map((tentativa) => tentativa.corpo),
		);
		expect(await tabelas()).toEqual(antes);
		expect(await lerPublico("/api/pesquisas")).toBe(pesquisasAntes);
		expect(await lerPublico("/api/apuracao")).toBe(apuracaoAntes);
	});

	it("sem chave, a recusa continua 401", async () => {
		await encerrarApuracao();
		const resposta = await pedido("POST", "/api/agente/resultados", corpoResultado(), null);
		expect(resposta.status).toBe(401);
		expect(await resposta.json()).toEqual({ erro: "nao_autorizado" });
	});

	it("com a apuração ao vivo, o import e o agente seguem escrevendo", async () => {
		const tse = instalarTseFalso();
		tse.definirVarianteSecoes({ padrao: "99,99", tf: "s" });
		await forcarConsulta();
		const apuracao = JSON.parse(await lerPublico("/api/apuracao")) as { encerrada?: boolean };
		expect(apuracao.encerrada).toBeFalsy();

		instalarDia0();
		const cron = await selfComScheduled().scheduled({
			cron: "0 9 * * *",
			scheduledTime: new Date("2026-10-25T21:00:00Z"),
		});
		expect(cron.outcome).toBe("ok");
		expect((await stub().obterEstado()).registros).toBe(57);

		network.use(http.get(FONTE, () => HttpResponse.html("<p>Datafolha: Flávio 49% e Lula 45%.</p>")));
		expect((await pedido("POST", "/api/agente/resultados", corpoResultado())).status).toBe(201);
		const suspensa = await pedido("POST", "/api/agente/suspensoes", {
			registro: DATAFOLHA,
			decisaoUrl: DECISAO,
			motivo: "liminar",
		});
		expect(suspensa.status).toBe(201);
		const reativada = await pedido("DELETE", `/api/agente/suspensoes/${DATAFOLHA}`, {
			motivo: "decisão revogada",
		});
		expect(reativada.status).toBe(200);
	});
});
