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
import type { Pesquisas } from "../src/pesquisas/pesquisas";
import { bytesDeDataUrl, instalarCdnPesquisas, pedidosCdn } from "./helpers/cdn-pesquisas";
import { fetchWorker } from "./helpers/fetch-worker";
import { cancelarAlarme, forcarConsulta, lerAlarme, limparPoller, stubPoller } from "./helpers/poller";
import { network } from "./helpers/rede";
import { instalarTseFalso } from "./helpers/tse-falso";
import { trocarNoPrototipo } from "./helpers/troca-prototipo";

const CHAVE = "teste-chave-agente";
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
