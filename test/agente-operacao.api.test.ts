/**
 * Aceite #14: instruções, pendentes, suspensão, substituição e auditoria.
 * Seam: rotas HTTP /api/agente/*.
 */
import { runInDurableObject } from "cloudflare:test";
import { env } from "cloudflare:workers";
import { http, HttpResponse } from "msw";
import { beforeEach, describe, expect, it } from "vitest";
import dia0ContratanteUrl from "../fixtures/pesquisas-tse/fixture_dia0_contratante.zip?inline";
import dia0PesquisaUrl from "../fixtures/pesquisas-tse/fixture_dia0_pesquisa.zip?inline";
import { documentoPesquisas } from "../src/pagina/documento";
import type { Pesquisas } from "../src/pesquisas/pesquisas";
import type { PayloadPesquisas } from "../src/pesquisas/tipos";
import { bytesDeDataUrl, instalarCdnPesquisas } from "./helpers/cdn-pesquisas";
import { fetchWorker } from "./helpers/fetch-worker";
import { network } from "./helpers/rede";
import { SEMENTE_INICIAL } from "./helpers/semente-inicial";

const CHAVE = "teste-chave-agente";
const DATAFOLHA = "BR-02949/2026";
const QUAEST = "BR-08729/2026";
const VEM_AI = "BR-00820/2026";
const FONTE = "https://www.metropoles.com/brasil/datafolha-2o-turno-flavio-tem-52-e-lula-48";
const DECISAO = "https://www.tse.jus.br/decisao/liminar-14";

const dia0Pesquisa = bytesDeDataUrl(dia0PesquisaUrl);
const dia0Contratante = bytesDeDataUrl(dia0ContratanteUrl);

function stub(): DurableObjectStub<Pesquisas> {
	return env.PESQUISAS.getByName("singleton") as DurableObjectStub<Pesquisas>;
}

beforeEach(async () => {
	await runInDurableObject(stub(), async (_inst, state) => {
		await state.storage.deleteAll();
	});
});

function cabecalhos(init?: { chave?: string | null; ip?: string }): Headers {
	const headers = new Headers();
	if (init?.chave !== null) headers.set("authorization", `Bearer ${init?.chave ?? CHAVE}`);
	if (init?.ip) headers.set("cf-connecting-ip", init.ip);
	return headers;
}

function get(caminho: string, init?: { chave?: string | null; ip?: string }) {
	return fetchWorker(
		new Request(`http://presidente2026.test${caminho}`, {
			headers: cabecalhos(init),
		}),
	);
}

function postJson(caminho: string, corpo: unknown, init?: { chave?: string | null; ip?: string }) {
	const headers = cabecalhos(init);
	headers.set("content-type", "application/json");
	return fetchWorker(
		new Request(`http://presidente2026.test${caminho}`, {
			method: "POST",
			headers,
			body: JSON.stringify(corpo),
		}),
	);
}

function apagar(caminho: string, corpo: unknown, init?: { chave?: string | null; ip?: string }) {
	const headers = cabecalhos(init);
	headers.set("content-type", "application/json");
	return fetchWorker(
		new Request(`http://presidente2026.test${caminho}`, {
			method: "DELETE",
			headers,
			body: JSON.stringify(corpo),
		}),
	);
}

async function importar(): Promise<void> {
	instalarCdnPesquisas({
		pesquisa: dia0Pesquisa,
		contratante: dia0Contratante,
		etagPesquisa: '"dia0-pesquisa"',
		etagContratante: '"dia0-contratante"',
		condicional304: false,
	});
	await stub().importarDoTse({ motivo: "teste" });
}

function servir(url: string, html: string) {
	network.use(http.get(url, () => HttpResponse.html(html)));
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

async function publicarDatafolha(ip: string): Promise<Response> {
	servir(FONTE, "<p>Datafolha: Flávio 49% e Lula 45%.</p>");
	return postJson("/api/agente/resultados", corpoResultado(), { ip });
}

async function inserirRegistro(parcial: {
	registro: string;
	instituto?: string;
	campoInicio?: string;
	campoFim?: string;
	liberacaoEfetiva?: string;
	margem?: number | null;
	confianca?: number | null;
	classificacao?: string;
}): Promise<void> {
	await stub().obterEstado();
	await runInDurableObject(stub(), async (_inst, state) => {
		state.storage.sql.exec(
			`INSERT INTO registros (
				registro, cnpj, instituto, contratantes_json,
				campo_inicio, campo_fim, liberacao, liberacao_efetiva,
				entrevistas, margem, confianca, classificacao, removido_do_tse
			) VALUES (?, '1', ?, '["Folha"]', ?, ?, ?, ?, 1000, ?, ?, ?, 0)`,
			parcial.registro,
			parcial.instituto ?? "Datafolha",
			parcial.campoInicio ?? "2026-10-01",
			parcial.campoFim ?? "2026-10-02",
			parcial.liberacaoEfetiva ?? "2026-10-02",
			parcial.liberacaoEfetiva ?? "2026-10-02",
			parcial.margem === undefined ? 2 : parcial.margem,
			parcial.confianca === undefined ? 95 : parcial.confianca,
			parcial.classificacao ?? "nacional",
		);
	});
}

describe("GET /api/agente (#14)", () => {
	it("devolve o markdown de instruções sem chave", async () => {
		const res = await get("/api/agente", { chave: null, ip: "203.0.113.14" });
		expect(res.status).toBe(200);
		expect(res.headers.get("content-type")).toContain("text/markdown");
		expect(res.headers.get("cache-control")).toBe("no-store");
		const texto = await res.text();
		expect(texto).toContain("POST /api/agente/resultados");
		expect(texto).toContain('"substituir": false');
		expect(texto).toContain("ja_publicado");
		expect(texto).toContain("fonte_nao_confirma");
		expect(texto).toContain("Nunca invente");
		expect(texto).toContain("17h");
		expect(texto).toContain("decisaoUrl");
		expect(texto).toContain("proximo");
		expect(texto).not.toContain(CHAVE);
	});

	it("a 6ª leitura sem chave no minuto responde 429 e audita", async () => {
		const ip = "203.0.113.15";
		for (let i = 0; i < 5; i++) {
			const res = await get("/api/agente", { chave: null, ip });
			expect(res.status).toBe(200);
		}
		const sexta = await get("/api/agente", { chave: null, ip });
		expect(sexta.status).toBe(429);
		expect(sexta.headers.get("retry-after")).toBe("60");
		expect(await sexta.json()).toEqual({ erro: "limite" });
		const auditoria = await stub().listarAuditoriaAgente();
		expect(auditoria.filter((a) => a.status === 429)).toHaveLength(1);
		expect(auditoria.every((a) => a.rota === "/api/agente" && a.metodo === "GET")).toBe(true);
	});

	it("chave válida não cai no teto de 5 por IP", async () => {
		for (let i = 0; i < 6; i++) {
			const res = await get("/api/agente", { ip: "203.0.113.16" });
			expect(res.status).toBe(200);
		}
	});
});

describe("GET /api/agente/pendentes (#14)", () => {
	it("sem chave responde 401 nao_autorizado e audita", async () => {
		const res = await get("/api/agente/pendentes", { chave: null, ip: "203.0.113.21" });
		expect(res.status).toBe(401);
		expect(await res.json()).toEqual({ erro: "nao_autorizado" });
		const auditoria = await stub().listarAuditoriaAgente();
		expect(auditoria).toHaveLength(1);
		expect(auditoria[0]).toMatchObject({
			status: 401,
			chaveValida: false,
			rota: "/api/agente/pendentes",
			metodo: "GET",
			motivos: ["nao_autorizado"],
		});
		expect(auditoria[0]?.corpo.includes(CHAVE)).toBe(false);
	});

	it("lista só liberadas sem número e publicadas há mais de 7 dias", async () => {
		await inserirRegistro({ registro: "BR-NOVA/2026", instituto: "Datafolha" });
		await inserirRegistro({
			registro: "BR-SEM/2026",
			instituto: "Vetor",
			margem: null,
			confianca: null,
		});
		await inserirRegistro({
			registro: "BR-FUT/2026",
			liberacaoEfetiva: "2099-01-01",
			campoFim: "2099-01-01",
		});
		await inserirRegistro({ registro: "BR-REC/2026", instituto: "Quaest" });
		await inserirRegistro({ registro: "BR-VEL/2026", instituto: "AtlasIntel" });
		await inserirRegistro({ registro: "BR-SUS/2026" });
		await runInDurableObject(stub(), async (_inst, state) => {
			state.storage.sql.exec(
				`INSERT INTO resultados (
					registro, totais_json, validos_publicados_json, vf, vl, v,
					fonte, margem, confianca, cadastrado_em, substituido_em
				) VALUES ('BR-REC/2026', '{}', NULL, 50, 50, 0, 'https://www.poder360.com.br/x', 2, 95, ?, NULL)`,
				new Date().toISOString(),
			);
			state.storage.sql.exec(
				`INSERT INTO resultados (
					registro, totais_json, validos_publicados_json, vf, vl, v,
					fonte, margem, confianca, cadastrado_em, substituido_em
				) VALUES ('BR-VEL/2026', '{}', NULL, 50, 50, 0, 'https://www.poder360.com.br/y', 2, 95, '2020-01-01T00:00:00.000Z', NULL)`,
			);
			state.storage.sql.exec(
				"INSERT INTO suspensoes (registro, desde, motivo) VALUES ('BR-SUS/2026', '2026-10-01', 'liminar')",
			);
		});

		const res = await get("/api/agente/pendentes", { ip: "203.0.113.22" });
		expect(res.status).toBe(200);
		const corpo = (await res.json()) as {
			pendentes: Array<{
				registro: string;
				faltaMargem: boolean;
				faltaConfianca: boolean;
				jaPublicado: boolean;
				campo: { inicio: string; fim: string };
			}>;
		};
		const ids = corpo.pendentes.map((item) => item.registro);
		expect(ids).toEqual(["BR-NOVA/2026", "BR-SEM/2026", "BR-VEL/2026"]);
		expect(corpo.pendentes.find((item) => item.registro === "BR-SEM/2026")).toMatchObject({
			faltaMargem: true,
			faltaConfianca: true,
			jaPublicado: false,
			campo: { inicio: "2026-10-01", fim: "2026-10-02" },
		});
		expect(corpo.pendentes.find((item) => item.registro === "BR-VEL/2026")?.jaPublicado).toBe(true);
		expect(corpo.pendentes.find((item) => item.registro === "BR-NOVA/2026")?.faltaMargem).toBe(false);
	});

	it("fica vazio quando não há trabalho", async () => {
		await inserirRegistro({
			registro: "BR-FUT/2026",
			liberacaoEfetiva: "2099-01-01",
			campoFim: "2099-01-01",
		});
		const res = await get("/api/agente/pendentes", { ip: "203.0.113.23" });
		expect(await res.json()).toEqual({ pendentes: [] });
	});

	it("no dia 25 antes das 17h a pesquisa não entra na lista e o POST recusa", async () => {
		await inserirRegistro({
			registro: "BR-DIA25/2026",
			campoInicio: "2026-10-24",
			campoFim: "2026-10-25",
			liberacaoEfetiva: "2026-10-25",
		});
		const cedo = await stub().listarPendentes({
			bearer: CHAVE,
			ip: "203.0.113.24",
			agora: new Date("2026-10-25T16:59:00-03:00"),
		});
		expect(cedo.status).toBe(200);
		if (cedo.status !== 200) return;
		expect(cedo.corpo.pendentes).toEqual([]);

		servir(FONTE, "<p>Datafolha: Flávio 49% e Lula 45%.</p>");
		const recusa = await stub().receberResultado({
			bearer: CHAVE,
			ip: "203.0.113.25",
			corpo: JSON.stringify(corpoResultado({ registro: "BR-DIA25/2026", fonte: FONTE })),
			corpoExcedeu: false,
			agora: new Date("2026-10-25T16:59:00-03:00"),
		});
		expect(recusa.status).toBe(422);
		if (recusa.status !== 422) return;
		expect(recusa.corpo.motivos.map((m) => m.codigo)).toContain("antes_da_liberacao");

		const naHora = await stub().listarPendentes({
			bearer: CHAVE,
			ip: "203.0.113.26",
			agora: new Date("2026-10-25T17:00:00-03:00"),
		});
		expect(naHora.status).toBe(200);
		if (naHora.status !== 200) return;
		expect(naHora.corpo.pendentes.map((item) => item.registro)).toEqual(["BR-DIA25/2026"]);
	});
});

describe("substituição e suspensão (#14)", () => {
	it("sem substituir recusa ja_publicado; com true guarda o histórico", async () => {
		await importar();
		expect((await publicarDatafolha("203.0.113.30")).status).toBe(201);
		const deNovo = await postJson("/api/agente/resultados", corpoResultado(), { ip: "203.0.113.31" });
		expect(deNovo.status).toBe(422);
		const motivos = (await deNovo.json()) as { motivos: { codigo: string }[] };
		expect(motivos.motivos.map((m) => m.codigo)).toContain("ja_publicado");

		servir(FONTE, "<p>Datafolha: Flávio 48% e Lula 46%.</p>");
		const troca = await postJson(
			"/api/agente/resultados",
			corpoResultado({
				totais: { flavio: 48, lula: 46, brancoNulo: 5, naoSabe: 1 },
				validosPublicados: { flavio: 51, lula: 49 },
				substituir: true,
			}),
			{ ip: "203.0.113.32" },
		);
		expect(troca.status).toBe(200);
		expect(await troca.json()).toEqual({ status: "substituido" });

		const lista = await fetchWorker(new Request("http://presidente2026.test/api/pesquisas"));
		const publico = (await lista.json()) as PayloadPesquisas;
		const publicada = publico.publicadas.find((p) => p.registro === DATAFOLHA);
		expect(publicada?.totais.flavio).toBe(48);
		expect(publicada?.substituidoEm).toEqual(expect.any(String));

		const historico = await runInDurableObject(stub(), (_inst, state) =>
			state.storage.sql
				.exec<{ corpo_json: string }>(
					"SELECT corpo_json FROM resultados_historico WHERE registro = ?",
					DATAFOLHA,
				)
				.toArray(),
		);
		expect(historico).toHaveLength(1);
		expect(JSON.parse(historico[0]?.corpo_json ?? "{}")).toMatchObject({
			totais: { flavio: 49, lula: 45 },
		});
	});

	it("suspender exige decisaoUrl https e tira a pesquisa de tudo; reativar devolve", async () => {
		await importar();
		expect((await publicarDatafolha("203.0.113.40")).status).toBe(201);

		const semUrl = await postJson(
			"/api/agente/suspensoes",
			{ registro: DATAFOLHA, motivo: "liminar" },
			{ ip: "203.0.113.41" },
		);
		expect(semUrl.status).toBe(422);
		const semChave = await postJson(
			"/api/agente/suspensoes",
			{ registro: DATAFOLHA, decisaoUrl: DECISAO, motivo: "liminar" },
			{ chave: null, ip: "203.0.113.42" },
		);
		expect(semChave.status).toBe(401);
		expect(await semChave.json()).toEqual({ erro: "nao_autorizado" });

		const httpUrl = await postJson(
			"/api/agente/suspensoes",
			{ registro: DATAFOLHA, decisaoUrl: "http://www.tse.jus.br/x", motivo: "liminar" },
			{ ip: "203.0.113.43" },
		);
		expect(httpUrl.status).toBe(422);

		const criada = await postJson(
			"/api/agente/suspensoes",
			{ registro: DATAFOLHA, decisaoUrl: DECISAO, motivo: "liminar da Justiça Eleitoral" },
			{ ip: "203.0.113.44" },
		);
		expect(criada.status).toBe(201);
		expect(await criada.json()).toEqual({ status: "suspensa" });

		const agora = new Date("2026-10-16T15:00:00-03:00");
		const escondida = await stub().listarPublico({ agora });
		const idsEscondidos = [
			...escondida.publicadas,
			...escondida.liberadasSemNumero,
			...escondida.vemAi,
		].map((item) => item.registro);
		expect(idsEscondidos).not.toContain(DATAFOLHA);
		expect(escondida.media?.registros ?? []).not.toContain(DATAFOLHA);
		expect(documentoPesquisas(escondida, agora)).not.toContain(DATAFOLHA);

		const api = await fetchWorker(new Request("http://presidente2026.test/api/pesquisas"));
		const publico = (await api.json()) as PayloadPesquisas;
		expect(publico.publicadas.map((p) => p.registro)).not.toContain(DATAFOLHA);
		expect(publico.liberadasSemNumero.map((p) => p.registro)).not.toContain(DATAFOLHA);
		expect(publico.vemAi.map((p) => p.registro)).not.toContain(DATAFOLHA);

		const vemAi = await postJson(
			"/api/agente/suspensoes",
			{ registro: VEM_AI, decisaoUrl: DECISAO, motivo: "liminar" },
			{ ip: "203.0.113.45" },
		);
		expect(vemAi.status).toBe(201);
		const semVemAi = await stub().listarPublico({ agora });
		expect(semVemAi.vemAi.map((item) => item.registro)).not.toContain(VEM_AI);
		expect(documentoPesquisas(semVemAi, agora)).not.toContain(VEM_AI);

		const semMotivo = await apagar(`/api/agente/suspensoes/${DATAFOLHA}`, {}, { ip: "203.0.113.46" });
		expect(semMotivo.status).toBe(422);
		const reativada = await apagar(
			`/api/agente/suspensoes/${DATAFOLHA}`,
			{ motivo: "decisão revogada" },
			{ ip: "203.0.113.47" },
		);
		expect(reativada.status).toBe(200);
		expect(await reativada.json()).toEqual({ status: "reativada" });

		const deVolta = await stub().listarPublico({ agora });
		expect(deVolta.publicadas.map((p) => p.registro)).toContain(DATAFOLHA);
		expect(documentoPesquisas(deVolta, agora)).toContain(DATAFOLHA);
		const apiDeVolta = await fetchWorker(new Request("http://presidente2026.test/api/pesquisas"));
		const publicoDeVolta = (await apiDeVolta.json()) as PayloadPesquisas;
		expect(publicoDeVolta.publicadas.map((p) => p.registro)).toContain(DATAFOLHA);
	});
});

describe("GET /api/agente/auditoria (#14)", () => {
	it("lista aceitos, recusados e tentativas sem chave, com proximo", async () => {
		await importar();
		expect((await publicarDatafolha("203.0.113.50")).status).toBe(201);
		const recusa = await postJson(
			"/api/agente/resultados",
			corpoResultado({ fonte: "http://www.metropoles.com/x" }),
			{ ip: "203.0.113.51" },
		);
		expect(recusa.status).toBe(422);
		const sem = await get("/api/agente/auditoria?desde=2026-10-01T00:00:00.000Z", {
			chave: null,
			ip: "203.0.113.52",
		});
		expect(sem.status).toBe(401);

		const pagina = await get("/api/agente/auditoria?desde=2026-10-01T00:00:00.000Z&limite=2", {
			ip: "203.0.113.53",
		});
		expect(pagina.status).toBe(200);
		const corpo = (await pagina.json()) as {
			entradas: Array<{ status: number; chaveValida: boolean; motivos: string[]; ip: string }>;
			proximo: string | null;
		};
		expect(corpo.entradas).toHaveLength(2);
		expect(corpo.proximo).toContain("depois=");
		expect(corpo.proximo).toContain("desde=");
		const segunda = await get(corpo.proximo ?? "", { ip: "203.0.113.54" });
		const resto = (await segunda.json()) as {
			entradas: Array<{ status: number; chaveValida: boolean; motivos: string[] }>;
			proximo: string | null;
		};
		const todas = [...corpo.entradas, ...resto.entradas];
		expect(todas.some((e) => e.status === 201 && e.chaveValida)).toBe(true);
		expect(todas.some((e) => e.status === 422 && e.motivos.includes("fonte_invalida"))).toBe(true);
		expect(todas.some((e) => e.status === 401 && e.chaveValida === false)).toBe(true);
		expect(resto.proximo === null || resto.entradas.length > 0).toBe(true);
	});

	it("desde inválido responde 422 e a página seguinte não repete o que já passou", async () => {
		const ip = "203.0.113.60";
		for (let i = 0; i < 3; i++) {
			const res = await get("/api/agente/pendentes", { chave: null, ip: `203.0.113.7${i}` });
			expect(res.status).toBe(401);
		}
		await runInDurableObject(stub(), async (_inst, state) => {
			state.storage.sql.exec(
				"UPDATE auditoria_agente SET em = '2020-01-01T00:00:00.000Z' WHERE id = 1",
			);
		});
		const invalido = await get("/api/agente/auditoria?desde=ontem", { ip });
		expect(invalido.status).toBe(422);
		const json = (await invalido.json()) as { motivos: { codigo: string }[] };
		expect(json.motivos.map((m) => m.codigo)).toContain("desde_invalido");

		const recente = await get("/api/agente/auditoria?desde=2026-01-01T00:00:00.000Z&limite=10", {
			ip: "203.0.113.61",
		});
		const corpo = (await recente.json()) as { entradas: Array<{ em: string; status: number }> };
		expect(corpo.entradas.every((e) => e.em >= "2026-01-01T00:00:00.000Z")).toBe(true);
		expect(corpo.entradas.some((e) => e.em.startsWith("2020-"))).toBe(false);
	});
});

describe("semeadura das 5 pesquisas (#14)", () => {
	it("GET /api/pesquisas mostra as cinco, e a Quaest sem válidos publicados", async () => {
		await importar();
		for (const [i, semente] of SEMENTE_INICIAL.entries()) {
			servir(semente.fonte, semente.html);
			const res = await postJson(
				"/api/agente/resultados",
				{
					registro: semente.registro,
					totais: semente.totais,
					validosPublicados: semente.validosPublicados,
					fonte: semente.fonte,
					margem: null,
					confianca: null,
					substituir: false,
				},
				{ ip: `203.0.113.${80 + i}` },
			);
			expect(res.status, semente.registro).toBe(201);
		}

		const res = await fetchWorker(new Request("http://presidente2026.test/api/pesquisas"));
		expect(res.status).toBe(200);
		const publico = (await res.json()) as PayloadPesquisas;
		expect(publico.publicadas.map((p) => p.registro).sort()).toEqual(
			SEMENTE_INICIAL.map((s) => s.registro).sort(),
		);
		const quaest = publico.publicadas.find((p) => p.registro === QUAEST);
		expect(quaest?.validosPublicados).toBeNull();
		expect(quaest?.totais).toEqual({
			flavio: 46,
			lula: 44,
			brancoNulo: 9,
			naoSabe: 1,
			brancoNuloNaoSabe: null,
		});
		expect(quaest?.fonte).toBe(SEMENTE_INICIAL[4]?.fonte);
		const datafolha = publico.publicadas.find((p) => p.registro === DATAFOLHA);
		expect(datafolha?.validosPublicados).toEqual({ flavio: 52, lula: 48 });
		expect(datafolha?.fonte).toBe(SEMENTE_INICIAL[1]?.fonte);

		const noDia = await stub().listarPublico({ agora: new Date("2026-10-15T18:00:00-03:00") });
		expect(noDia.media).toEqual({
			data: "2026-10-15",
			vf: 51.77,
			vl: 48.23,
			v: 3.55,
			n: 4,
			margem: 1.7,
			registros: ["BR-02949/2026", "BR-03663/2026", "BR-01209/2026", "BR-08729/2026"],
		});
	});
});
