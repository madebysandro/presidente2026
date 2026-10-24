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
import { restaurarPrototipos, trocarNoPrototipo, trocarTodosNoPrototipo } from "./helpers/troca-prototipo";

const CHAVE = "teste-chave-agente";
const CHAVE_IMPORT = "teste-chave-import";
const DATAFOLHA = "BR-02949/2026";
const FONTE = "https://www.metropoles.com/brasil/datafolha-2o-turno-flavio-tem-52-e-lula-48";
const DECISAO = "https://www.tse.jus.br/decisao/liminar-14";

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

function substituir(): Promise<Response> {
	network.use(http.get(FONTE, () => HttpResponse.html("<p>Datafolha: Flávio 48% e Lula 46%.</p>")));
	return pedido("POST", "/api/agente/resultados", {
		registro: DATAFOLHA,
		totais: { flavio: 48, lula: 46, brancoNulo: 5, naoSabe: 1 },
		validosPublicados: { flavio: 51, lula: 49 },
		fonte: FONTE,
		margem: null,
		confianca: null,
		substituir: true,
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

/** Pesquisas fora do ar para o aviso: `congelar()` lança até o restaurador devolvido. */
function derrubarCongelar(): Promise<() => void> {
	return trocarNoPrototipo(stub(), "congelar", () => {
		throw new Error("pesquisas fora do ar");
	});
}

async function esperaDoAlarme(acao: () => Promise<unknown>): Promise<{ min: number; max: number; alarme: number | null }> {
	const antes = Date.now();
	await acao();
	const depois = Date.now();
	return { min: antes, max: depois, alarme: await lerAlarme() };
}

function eventos(espiao: { mock: { calls: unknown[][] } }, evento: "aviso" | "trava" | "import"): unknown[] {
	return espiao.mock.calls.map(([e]) => e).filter((e) => (e as { evento?: string })?.evento === evento);
}

beforeEach(async () => {
	await runInDurableObject(stub(), async (_inst, state) => {
		await state.storage.deleteAll();
	});
});

afterEach(async () => {
	restaurarPrototipos();
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
		expect(eventos(log, "aviso")).toEqual([
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
		const religar = await derrubarCongelar();

		const primeira = await esperaDoAlarme(() => encerrarApuracao(tse));
		expect(await travaGravada()).toBe(false);
		expect(primeira.alarme).toBeGreaterThanOrEqual(primeira.min + 30_000);
		expect(primeira.alarme).toBeLessThanOrEqual(primeira.max + 30_000);

		const pedidosTse = tse.pedidos.length;
		const segunda = await esperaDoAlarme(() => runDurableObjectAlarm(stubPoller()));
		expect(segunda.alarme).toBeGreaterThanOrEqual(segunda.min + 60_000);
		expect(segunda.alarme).toBeLessThanOrEqual(segunda.max + 60_000);
		expect(tse.pedidos.length).toBe(pedidosTse);
		expect(eventos(erro, "aviso")).toEqual([
			{ evento: "aviso", resultado: "erro", tentativa: 1, proximaMs: 30_000, erro: "pesquisas fora do ar" },
			{ evento: "aviso", resultado: "erro", tentativa: 2, proximaMs: 60_000, erro: "pesquisas fora do ar" },
		]);

		religar();
		expect(await runDurableObjectAlarm(stubPoller())).toBe(true);

		expect(await travaGravada()).toBe(true);
		expect(await lerAlarme()).toBeNull();
		expect(tse.pedidos.length).toBe(pedidosTse);
		expect(eventos(log, "aviso")).toEqual([
			{ evento: "aviso", resultado: "entregue", tentativa: 3, proximaMs: null },
		]);
		await limparPoller();
		expect((await publicar()).status).toBe(409);
		expect((await suspender()).status).toBe(409);
	});

	it("a escada da reentrega sobe até 10 min e fica no teto", async () => {
		const erro = vi.spyOn(console, "error");
		await derrubarCongelar();
		await encerrarApuracao();

		for (let i = 0; i < 5; i++) await runDurableObjectAlarm(stubPoller());

		expect(eventos(erro, "aviso").map((e) => (e as { proximaMs: number }).proximaMs)).toEqual([
			30_000, 60_000, 120_000, 300_000, 600_000, 600_000,
		]);
		expect(await travaGravada()).toBe(false);
	});

	it("o encerramento grava o alarme de guarda antes do aviso: um crash antes do ack não perde a reentrega", async () => {
		const religar = await trocarNoPrototipo(stubPoller(), "entregarAviso", async () => {});
		await encerrarApuracao();
		expect(await lerAlarme()).not.toBeNull();
		expect(await travaGravada()).toBe(false);
		religar();

		expect(await runDurableObjectAlarm(stubPoller())).toBe(true);

		expect(await travaGravada()).toBe(true);
		expect(await lerAlarme()).toBeNull();
	});

	it("o aviso registra a trava uma vez só; o repetido não loga de novo", async () => {
		const log = vi.spyOn(console, "log");

		await stub().congelar();
		await stub().congelar();

		expect(eventos(log, "trava")).toEqual([{ evento: "trava", resultado: "gravada", origem: "aviso" }]);
	});

	it("o GET /api/apuracao reagenda a reentrega quando o alarme se perdeu", async () => {
		const religar = await derrubarCongelar();
		await encerrarApuracao();
		await cancelarAlarme();
		religar();
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

/** O poller cai no meio da apuração: `apuracaoEncerrada()` lança até o `afterEach`. */
async function derrubarPoller(): Promise<void> {
	await trocarNoPrototipo(stubPoller(), "apuracaoEncerrada", () => {
		throw new Error("poller fora do ar");
	});
}

/** Todo método do poller lança, não só o que as pesquisas usam hoje. */
async function derrubarPollerInteiro(): Promise<void> {
	await trocarTodosNoPrototipo(stubPoller(), () => {
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
	it("com o poller inteiro falhando, o agente publica, substitui, suspende e reativa sem 500 e o DO não reinicia", async () => {
		instalarDia0();
		await stub().importarDoTse({ motivo: "teste" });
		await marcarInstancia();
		await derrubarPollerInteiro();
		// Promise nativa: `.rejects` direto no RpcPromise deixa uma rejeição sem dono no vitest.
		await expect((async () => stubPoller().apuracaoEncerrada())()).rejects.toThrow("poller fora do ar");

		expect((await publicar()).status).toBe(201);
		expect((await substituir()).status).toBe(200);
		expect((await suspender()).status).toBe(201);
		expect((await pedido("DELETE", `/api/agente/suspensoes/${DATAFOLHA}`, { motivo: "decisão revogada" })).status).toBe(200);
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
		const religar = await derrubarCongelar();
		await encerrarApuracao();
		await cancelarAlarme();
		religar();
		instalarDia0();

		await expect(stub().importarDoTse({ motivo: "cron" })).resolves.toEqual({ kind: "congelado" });
		await expect(stub().importarDoTse({ motivo: "cron" })).resolves.toEqual({ kind: "congelado" });

		expect(eventos(log, "trava")).toEqual([{ evento: "trava", resultado: "gravada", origem: "reconciliacao" }]);
	});

	it("com o poller lançando no pull, o import loga o erro da reconciliação e segue", async () => {
		const erro = vi.spyOn(console, "error");
		await derrubarPoller();
		instalarDia0();

		const changeset = await stub().importarDoTse({ motivo: "cron" });

		expect(changeset.kind).toBe("aplicar");
		expect(await travaGravada()).toBe(false);
		expect(eventos(erro, "trava")).toEqual([
			{ evento: "trava", resultado: "erro", origem: "reconciliacao", erro: "poller fora do ar" },
		]);
	});

	it("com a trava já gravada e o banco vazio, o primeiro acesso não loga import a cada página", async () => {
		await stub().congelar();
		instalarDia0();
		const log = vi.spyOn(console, "log");

		for (let i = 0; i < 2; i++) {
			expect((await fetchWorker(new Request("http://presidente2026.test/api/pesquisas"))).status).toBe(200);
		}

		expect(pedidosCdn).toEqual([]);
		expect(eventos(log, "import")).toEqual([]);
	});

	it("com o aviso perdido, o primeiro acesso e o plano B também congelam", async () => {
		await derrubarCongelar();
		await encerrarApuracao();
		await cancelarAlarme();
		instalarDia0();
		const log = vi.spyOn(console, "log");

		expect((await fetchWorker(new Request("http://presidente2026.test/api/pesquisas"))).status).toBe(200);
		expect((await fetchWorker(new Request("http://presidente2026.test/api/pesquisas"))).status).toBe(200);
		expect(eventos(log, "import")).toEqual([
			expect.objectContaining({ evento: "import", motivo: "primeiro_acesso", resultado: "congelado" }),
		]);
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
