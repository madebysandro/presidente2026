/**
 * #86: o poller avisa o DO de pesquisas que a apuração encerrou (`congelar()`).
 * Seam: `Pesquisas.congelar()`, ciclo e alarme do poller, GET /api/apuracao, import e /api/agente/*.
 */
import { runDurableObjectAlarm, runInDurableObject } from "cloudflare:test";
import { env } from "cloudflare:workers";
import { http, HttpResponse } from "msw";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import dia0ContratanteUrl from "../fixtures/pesquisas-tse/fixture_dia0_contratante.zip?inline";
import dia0PesquisaUrl from "../fixtures/pesquisas-tse/fixture_dia0_pesquisa.zip?inline";
import { recorteNacionalDeZips } from "../src/pesquisas/plano-b";
import type { Pesquisas } from "../src/pesquisas/pesquisas";
import { bytesDeDataUrl, instalarCdnPesquisas, pedidosCdn } from "./helpers/cdn-pesquisas";
import { fetchWorker } from "./helpers/fetch-worker";
import { cancelarAlarme, forcarConsulta, lerAlarme, limparPoller, stubPoller } from "./helpers/poller";
import { network } from "./helpers/rede";
import { selfComScheduled } from "./helpers/self-scheduled";
import { instalarTseFalso } from "./helpers/tse-falso";
import { trocarNoPrototipo } from "./helpers/troca-prototipo";

const CHAVE = "teste-chave-agente";
const CHAVE_IMPORT = "teste-chave-import";
const DATAFOLHA = "BR-02949/2026";
const FONTE = "https://www.metropoles.com/brasil/datafolha-2o-turno-flavio-tem-52-e-lula-48";
const DECISAO = "https://www.tse.jus.br/decisao/liminar-14";

let restaurar: (() => void) | null = null;

const dia0Pesquisa = bytesDeDataUrl(dia0PesquisaUrl);
const dia0Contratante = bytesDeDataUrl(dia0ContratanteUrl);

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

function pedido(metodo: "POST" | "DELETE", caminho: string, corpo: unknown): Promise<Response> {
	return fetchWorker(
		new Request(`http://presidente2026.test${caminho}`, {
			method: metodo,
			headers: { "content-type": "application/json", authorization: `Bearer ${CHAVE}` },
			body: JSON.stringify(corpo),
		}),
	);
}

function publicar(): Promise<Response> {
	network.use(http.get(FONTE, () => HttpResponse.html("<p>Datafolha: Flávio 49% e Lula 45%.</p>")));
	return pedido("POST", "/api/agente/resultados", {
		registro: DATAFOLHA,
		totais: { flavio: 49, lula: 45, brancoNulo: 5, naoSabe: 1 },
		validosPublicados: { flavio: 52, lula: 48 },
		fonte: FONTE,
		margem: null,
		confianca: null,
		substituir: false,
	});
}

function suspender(): Promise<Response> {
	return pedido("POST", "/api/agente/suspensoes", { registro: DATAFOLHA, decisaoUrl: DECISAO, motivo: "liminar" });
}

async function encerrarApuracao(tse = instalarTseFalso()): Promise<void> {
	tse.definirVarianteSecoes({ padrao: "100,00", tf: "s" });
	await forcarConsulta();
	expect(await stubPoller().apuracaoEncerrada()).toBe(true);
}

function travaGravada(): Promise<boolean> {
	return runInDurableObject(stub(), (_inst, state) => state.storage.kv.get("apuracao_encerrada") === true);
}

/** Pesquisas fora do ar para o aviso: `congelar()` lança até `restaurar()`. */
async function derrubarCongelar(): Promise<void> {
	restaurar = await trocarNoPrototipo(stub(), "congelar", () => {
		throw new Error("pesquisas fora do ar");
	});
}

async function esperaDoAlarme(acao: () => Promise<unknown>): Promise<{ min: number; max: number; alarme: number | null }> {
	const antes = Date.now();
	await acao();
	const depois = Date.now();
	return { min: antes, max: depois, alarme: await lerAlarme() };
}

function eventosAviso(espiao: { mock: { calls: unknown[][] } }): unknown[] {
	return espiao.mock.calls.map(([e]) => e).filter((e) => (e as { evento?: string })?.evento === "aviso");
}

function eventosTrava(espiao: { mock: { calls: unknown[][] } }): unknown[] {
	return espiao.mock.calls.map(([e]) => e).filter((e) => (e as { evento?: string })?.evento === "trava");
}

beforeEach(async () => {
	await runInDurableObject(stub(), async (_inst, state) => {
		await state.storage.deleteAll();
	});
});

afterEach(async () => {
	restaurar?.();
	restaurar = null;
	vi.restoreAllMocks();
	await limparPoller();
});

describe("aviso de encerramento do poller para as pesquisas (#86)", () => {
	it("o aviso antes de qualquer import congela, mesmo com o poller zerado", async () => {
		await limparPoller();

		await expect(stub().congelar()).resolves.toEqual({ congelada: true });

		instalarDia0();
		await expect(stub().importarDoTse({ motivo: "teste" })).resolves.toEqual({ kind: "congelado" });
		expect(pedidosCdn).toEqual([]);
		expect((await stub().obterEstado()).registros).toBe(0);
		expect((await publicar()).status).toBe(409);
		expect((await suspender()).status).toBe(409);
	});

	it("o ciclo que encerra avisa as pesquisas, sem deixar alarme", async () => {
		const log = vi.spyOn(console, "log");
		instalarDia0();
		await stub().importarDoTse({ motivo: "teste" });

		await encerrarApuracao();

		expect(await travaGravada()).toBe(true);
		expect(await lerAlarme()).toBeNull();
		expect(eventosAviso(log)).toEqual([
			{ evento: "aviso", resultado: "entregue", tentativa: 1, proximaMs: null },
		]);
		await limparPoller();
		expect((await publicar()).status).toBe(409);
		expect((await suspender()).status).toBe(409);
	});

	it("o aviso repetido devolve o mesmo ack e não muda nada", async () => {
		instalarDia0();
		await stub().importarDoTse({ motivo: "teste" });
		await encerrarApuracao();
		const antes = await runInDurableObject(stub(), (_inst, state) =>
			state.storage.sql.exec("SELECT * FROM registros ORDER BY registro").toArray(),
		);

		await expect(stub().congelar()).resolves.toEqual({ congelada: true });
		await expect(stub().congelar()).resolves.toEqual({ congelada: true });

		expect(await travaGravada()).toBe(true);
		expect(
			await runInDurableObject(stub(), (_inst, state) =>
				state.storage.sql.exec("SELECT * FROM registros ORDER BY registro").toArray(),
			),
		).toEqual(antes);
		await limparPoller();
		expect((await publicar()).status).toBe(409);
	});

	it("com as pesquisas fora, o poller reentrega com backoff e o ack limpa o alarme", async () => {
		const log = vi.spyOn(console, "log");
		const erro = vi.spyOn(console, "error");
		const tse = instalarTseFalso();
		await derrubarCongelar();

		const primeira = await esperaDoAlarme(() => encerrarApuracao(tse));
		expect(await travaGravada()).toBe(false);
		expect(primeira.alarme).toBeGreaterThanOrEqual(primeira.min + 30_000);
		expect(primeira.alarme).toBeLessThanOrEqual(primeira.max + 30_000);

		const pedidosTse = tse.pedidos.length;
		const segunda = await esperaDoAlarme(() => runDurableObjectAlarm(stubPoller()));
		expect(segunda.alarme).toBeGreaterThanOrEqual(segunda.min + 60_000);
		expect(segunda.alarme).toBeLessThanOrEqual(segunda.max + 60_000);
		expect(tse.pedidos.length).toBe(pedidosTse);
		expect(eventosAviso(erro)).toEqual([
			{ evento: "aviso", resultado: "erro", tentativa: 1, proximaMs: 30_000, erro: "pesquisas fora do ar" },
			{ evento: "aviso", resultado: "erro", tentativa: 2, proximaMs: 60_000, erro: "pesquisas fora do ar" },
		]);

		restaurar!();
		restaurar = null;
		expect(await runDurableObjectAlarm(stubPoller())).toBe(true);

		expect(await travaGravada()).toBe(true);
		expect(await lerAlarme()).toBeNull();
		expect(tse.pedidos.length).toBe(pedidosTse);
		expect(eventosAviso(log)).toEqual([
			{ evento: "aviso", resultado: "entregue", tentativa: 3, proximaMs: null },
		]);
		await limparPoller();
		expect((await publicar()).status).toBe(409);
		expect((await suspender()).status).toBe(409);
	});

	it("o encerramento grava o alarme de guarda antes do aviso: um crash antes do ack não perde a reentrega", async () => {
		restaurar = await trocarNoPrototipo(stubPoller(), "entregarAviso", async () => {});
		await encerrarApuracao();
		expect(await lerAlarme()).not.toBeNull();
		expect(await travaGravada()).toBe(false);
		restaurar();
		restaurar = null;

		expect(await runDurableObjectAlarm(stubPoller())).toBe(true);

		expect(await travaGravada()).toBe(true);
		expect(await lerAlarme()).toBeNull();
	});

	it("o aviso registra a trava uma vez só; o repetido não loga de novo", async () => {
		const log = vi.spyOn(console, "log");

		await stub().congelar();
		await stub().congelar();

		expect(eventosTrava(log)).toEqual([{ evento: "trava", resultado: "gravada", origem: "aviso" }]);
	});

	it("o GET /api/apuracao reagenda a reentrega quando o alarme se perdeu", async () => {
		await derrubarCongelar();
		await encerrarApuracao();
		await cancelarAlarme();
		restaurar!();
		restaurar = null;
		expect(await travaGravada()).toBe(false);

		const resposta = await fetchWorker(new Request("http://presidente2026.test/api/apuracao"));

		expect(resposta.status).toBe(200);
		// O alarme sai para agora e o Miniflare pode dispará-lo sozinho antes daqui.
		await runDurableObjectAlarm(stubPoller());
		await vi.waitFor(async () => expect(await travaGravada()).toBe(true));
		expect(await lerAlarme()).toBeNull();
	});

	it("depois do ack, o GET /api/apuracao não agenda nada", async () => {
		await encerrarApuracao();

		await fetchWorker(new Request("http://presidente2026.test/api/apuracao"));

		expect(await lerAlarme()).toBeNull();
	});
});

/** O poller cai no meio da apuração: `apuracaoEncerrada()` lança até `restaurar()`. */
async function derrubarPoller(): Promise<void> {
	restaurar = await trocarNoPrototipo(stubPoller(), "apuracaoEncerrada", () => {
		throw new Error("poller fora do ar");
	});
}

const MARCA = "__semReinicio86";

async function zerarPesquisas(): Promise<void> {
	await runInDurableObject(stub(), async (_inst, state) => {
		await state.storage.deleteAll();
	});
}

function planoBCom(recorte: unknown[]): Promise<Response> {
	return fetchWorker(
		new Request("http://presidente2026.test/api/import", {
			method: "POST",
			headers: { "content-type": "application/json", authorization: `Bearer ${CHAVE_IMPORT}` },
			body: JSON.stringify({ registros: recorte }),
		}),
	);
}

function marcarInstancia(): Promise<void> {
	return runInDurableObject(stub(), (inst) => {
		(inst as unknown as Record<string, boolean>)[MARCA] = true;
	});
}

function instanciaMarcada(): Promise<boolean> {
	return runInDurableObject(stub(), (inst) => (inst as unknown as Record<string, boolean>)[MARCA] === true);
}

describe("as escritas não dependem do poller (#86)", () => {
	it("com o poller falhando, o agente publica e suspende sem 500 e o DO não reinicia", async () => {
		instalarDia0();
		await stub().importarDoTse({ motivo: "teste" });
		await marcarInstancia();
		await derrubarPoller();

		expect((await publicar()).status).toBe(201);
		expect((await suspender()).status).toBe(201);
		expect(await instanciaMarcada()).toBe(true);
	});

	it("com o poller falhando, o cron, o primeiro acesso e o plano B aplicam sem 500", async () => {
		await marcarInstancia();
		await derrubarPoller();
		instalarDia0();

		const cron = await selfComScheduled().scheduled({
			cron: "0 9 * * *",
			scheduledTime: new Date("2026-10-25T21:00:00Z"),
		});
		expect(cron.outcome).toBe("ok");
		expect((await stub().obterEstado()).registros).toBe(57);

		await zerarPesquisas();
		const pesquisas = await fetchWorker(new Request("http://presidente2026.test/api/pesquisas"));
		expect(pesquisas.status).toBe(200);
		expect((await stub().obterEstado()).registros).toBe(57);

		await zerarPesquisas();
		const recorte = await recorteNacionalDeZips(dia0Pesquisa, dia0Contratante);
		const planoB = await planoBCom(recorte);
		expect(planoB.status).toBe(200);
		expect(await planoB.json()).toEqual({ status: "aplicado", upserts: recorte.length, removidos: 0 });
		expect((await stub().obterEstado()).registros).toBe(recorte.length);
		expect(await instanciaMarcada()).toBe(true);
	});

	it("com o aviso perdido, o cron pergunta ao poller e congela; o agente não pergunta", async () => {
		instalarDia0();
		await stub().importarDoTse({ motivo: "teste" });
		await derrubarCongelar();
		await encerrarApuracao();
		await cancelarAlarme();
		expect(await travaGravada()).toBe(false);

		expect((await publicar()).status).toBe(201);
		expect(await travaGravada()).toBe(false);

		instalarDia0();
		const cron = await selfComScheduled().scheduled({
			cron: "0 9 * * *",
			scheduledTime: new Date("2026-10-26T09:00:00Z"),
		});
		expect(cron.outcome).toBe("ok");
		expect(pedidosCdn).toEqual([]);
		expect(await travaGravada()).toBe(true);
		await expect(stub().importarDoTse({ motivo: "cron" })).resolves.toEqual({ kind: "congelado" });
		expect((await suspender()).status).toBe(409);
	});

	it("o pull que acha a apuração encerrada registra a trava pela reconciliação", async () => {
		const log = vi.spyOn(console, "log");
		await derrubarCongelar();
		await encerrarApuracao();
		await cancelarAlarme();
		restaurar!();
		restaurar = null;
		instalarDia0();

		await expect(stub().importarDoTse({ motivo: "cron" })).resolves.toEqual({ kind: "congelado" });
		await expect(stub().importarDoTse({ motivo: "cron" })).resolves.toEqual({ kind: "congelado" });

		expect(eventosTrava(log)).toEqual([{ evento: "trava", resultado: "gravada", origem: "reconciliacao" }]);
	});

	it("com o poller lançando no pull, o import loga o erro da reconciliação e segue", async () => {
		const erro = vi.spyOn(console, "error");
		await derrubarPoller();
		instalarDia0();

		const changeset = await stub().importarDoTse({ motivo: "cron" });

		expect(changeset.kind).toBe("aplicar");
		expect(await travaGravada()).toBe(false);
		expect(eventosTrava(erro)).toEqual([
			{ evento: "trava", resultado: "erro", origem: "reconciliacao", erro: "poller fora do ar" },
		]);
	});

	it("com o aviso perdido, o primeiro acesso e o plano B também congelam", async () => {
		await derrubarCongelar();
		await encerrarApuracao();
		await cancelarAlarme();
		instalarDia0();

		expect((await fetchWorker(new Request("http://presidente2026.test/api/pesquisas"))).status).toBe(200);
		expect(pedidosCdn).toEqual([]);
		expect((await stub().obterEstado()).registros).toBe(0);
		expect(await travaGravada()).toBe(true);

		await zerarPesquisas();
		const planoB = await planoBCom(await recorteNacionalDeZips(dia0Pesquisa, dia0Contratante));
		expect(planoB.status).toBe(409);
		expect((await stub().obterEstado()).registros).toBe(0);
		expect(await travaGravada()).toBe(true);
	});
});
