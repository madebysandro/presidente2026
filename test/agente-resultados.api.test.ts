/**
 * Aceite #9: POST /api/agente/resultados publica com chave e fonte.
 */
import { runInDurableObject } from "cloudflare:test";
import { env } from "cloudflare:workers";
import { http, HttpResponse } from "msw";
import { beforeEach, describe, expect, it } from "vitest";
import confirmaHtml from "../fixtures/fontes/confirma.html?raw";
import paywallHtml from "../fixtures/fontes/paywall.html?raw";
import semNumerosHtml from "../fixtures/fontes/sem-numeros.html?raw";
import soValidosHtml from "../fixtures/fontes/so-validos.html?raw";
import { chaveConfere } from "../src/pesquisas/chave";
import type { Pesquisas } from "../src/pesquisas/pesquisas";
import { antesDaLiberacao, motivoDaFonte } from "../src/pesquisas/validar-resultado";
import type { PayloadPesquisas } from "../src/pesquisas/tipos";
import {
	bytesDeDataUrl,
	instalarCdnPesquisas,
} from "./helpers/cdn-pesquisas";
import { fetchWorker } from "./helpers/fetch-worker";
import { network } from "./helpers/rede";
import dia0ContratanteUrl from "../fixtures/pesquisas-tse/fixture_dia0_contratante.zip?inline";
import dia0PesquisaUrl from "../fixtures/pesquisas-tse/fixture_dia0_pesquisa.zip?inline";

const CHAVE = "teste-chave-agente";
const IP = "203.0.113.8";
const DATAFOLHA = "BR-02949/2026";
const VETOR = "BR-06957/2026";
const FONTE = "https://www.metropoles.com/brasil/datafolha-49-45";

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

function corpoBase(extra: Record<string, unknown> = {}) {
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

function post(
	corpo: unknown,
	init?: { chave?: string | null; ip?: string },
) {
	const headers = new Headers({ "content-type": "application/json" });
	if (init?.chave !== null) headers.set("authorization", `Bearer ${init?.chave ?? CHAVE}`);
	if (init?.ip) headers.set("cf-connecting-ip", init.ip);
	return fetchWorker(
		new Request("http://presidente2026.test/api/agente/resultados", {
			method: "POST",
			headers,
			body: typeof corpo === "string" ? corpo : JSON.stringify(corpo),
		}),
	);
}

async function codigos(res: Response): Promise<string[]> {
	const json = (await res.json()) as { motivos?: { codigo: string }[] };
	return (json.motivos ?? []).map((m) => m.codigo);
}

function servir(url: string, html: string, status = 200) {
	network.use(
		http.get(url, ({ request }) => {
			expect(request.headers.get("user-agent")).toBe("presidente2026.win verificador");
			return new HttpResponse(html, {
				status,
				headers: { "content-type": "text/html" },
			});
		}),
	);
}

describe("chave em tempo constante (#9)", () => {
	it("tamanhos diferentes não lançam e não aceitam", async () => {
		await expect(chaveConfere("curta", "uma-chave-bem-mais-longa")).resolves.toBe(false);
		await expect(chaveConfere("", "x")).resolves.toBe(false);
		await expect(chaveConfere(CHAVE, CHAVE)).resolves.toBe(true);
		await expect(chaveConfere(CHAVE, "")).resolves.toBe(false);
	});
});

describe("POST /api/agente/resultados (#9)", () => {
	it("sem chave ou chave errada responde 401 nao_autorizado e audita", async () => {
		const sem = await post(corpoBase(), { chave: null, ip: IP });
		const errada = await post(corpoBase(), { chave: "outra", ip: IP });
		expect(sem.status).toBe(401);
		expect(errada.status).toBe(401);
		expect(await sem.json()).toEqual({ erro: "nao_autorizado" });
		expect(await errada.json()).toEqual({ erro: "nao_autorizado" });
		const auditoria = await stub().listarAuditoriaAgente();
		expect(auditoria.map((a) => a.status)).toEqual([401, 401]);
		expect(auditoria.every((a) => a.chaveValida === false)).toBe(true);
		expect(auditoria.every((a) => !a.corpo.includes(CHAVE))).toBe(true);
	});

	it("a 6ª tentativa sem chave no minuto responde 429", async () => {
		for (let i = 0; i < 5; i++) {
			const res = await post("{}", { chave: null, ip: IP });
			expect(res.status).toBe(401);
		}
		const sexta = await post("{}", { chave: null, ip: IP });
		expect(sexta.status).toBe(429);
		expect(sexta.headers.get("retry-after")).toBe("60");
		const outroIp = await post("{}", { chave: null, ip: "203.0.113.9" });
		expect(outroIp.status).toBe(401);
		const auditoria = await stub().listarAuditoriaAgente();
		expect(auditoria.some((a) => a.status === 429)).toBe(true);
	});

	it("a 31ª requisição com chave no minuto responde 429", async () => {
		for (let i = 0; i < 30; i++) {
			const res = await post({ registro: "BR-X/2026", fonte: "http://exemplo.test" }, { ip: IP });
			expect(res.status).toBe(422);
		}
		const extra = await post({ registro: "BR-X/2026", fonte: "http://exemplo.test" }, { ip: IP });
		expect(extra.status).toBe(429);
		expect(extra.headers.get("retry-after")).toBe("60");
	});

	it("cada código de recusa da spec aparece na resposta", async () => {
		await importar();
		await runInDurableObject(stub(), async (_inst, state) => {
			state.storage.sql.exec(
				`INSERT INTO registros (
					registro, cnpj, instituto, contratantes_json,
					campo_inicio, campo_fim, liberacao, liberacao_efetiva,
					entrevistas, margem, confianca, classificacao, removido_do_tse
				) VALUES (?, '1', 'Datafolha', '["x"]', '2026-10-01', '2026-10-02', '2026-10-02', '2099-01-01', 100, 2, 95, 'nacional', 0)`,
				"BR-FUT/2026",
			);
			state.storage.sql.exec(
				`INSERT INTO registros (
					registro, cnpj, instituto, contratantes_json,
					campo_inicio, campo_fim, liberacao, liberacao_efetiva,
					entrevistas, margem, confianca, classificacao, removido_do_tse
				) VALUES ('BR-EST/2026', '1', 'Datafolha', '["x"]', '2026-10-01', '2026-10-02', '2026-10-02', '2026-10-02', 100, 2, 95, 'estadual', 0)`,
			);
			state.storage.sql.exec(
				"INSERT INTO suspensoes (registro, desde, motivo) VALUES (?, '2026-10-16', 'liminar')",
				DATAFOLHA,
			);
		});

		servir(FONTE, confirmaHtml);
		const casos: Array<{ corpo: Record<string, unknown>; codigo: string; url?: string; html?: string; statusHtml?: number }> = [
			{ corpo: corpoBase({ registro: "BR-NAO/2026" }), codigo: "registro_desconhecido" },
			{ corpo: corpoBase({ registro: "BR-EST/2026" }), codigo: "registro_nao_nacional" },
			{ corpo: corpoBase({ registro: "BR-FUT/2026" }), codigo: "antes_da_liberacao" },
			{ corpo: corpoBase(), codigo: "suspensa" },
			{ corpo: corpoBase({ totais: { flavio: -1, lula: 45, brancoNulo: 5, naoSabe: 1 } }), codigo: "numeros_invalidos" },
			{ corpo: corpoBase({ totais: { flavio: 46, lula: 46, brancoNulo: 3, naoSabe: 1 } }), codigo: "soma_fora" },
			{
				corpo: corpoBase({
					totais: { flavio: 51, lula: 49, brancoNulo: 3, naoSabe: 1 },
					validosPublicados: { flavio: 52, lula: 48 },
				}),
				codigo: "soma_fora",
			},
			{
				corpo: corpoBase({
					totais: { flavio: 50, lula: 50, brancoNulo: 0, naoSabe: 0 },
					validosPublicados: { flavio: 51.1, lula: 48.9 },
				}),
				codigo: "validos_incoerentes",
			},
			{ corpo: corpoBase({ registro: VETOR, margem: null, confianca: null }), codigo: "falta_margem_confianca" },
			{ corpo: corpoBase({ fonte: "http://www.metropoles.com/x" }), codigo: "fonte_invalida" },
			{ corpo: corpoBase({ fonte: "https://example.com/fora" }), codigo: "fonte_invalida" },
		];
		for (const caso of casos) {
			const res = await post(caso.corpo, { ip: "203.0.113.20" });
			expect(res.status, caso.codigo).toBe(422);
			expect(await codigos(res), caso.codigo).toContain(caso.codigo);
		}

		const soma104 = await post(
			corpoBase({ totais: { flavio: 51, lula: 49, brancoNulo: 3, naoSabe: 1 } }),
			{ ip: "203.0.113.21" },
		);
		expect(await codigos(soma104)).toContain("soma_fora");

		servir("https://www.metropoles.com/some", semNumerosHtml);
		const sem = await post(corpoBase({ fonte: "https://www.metropoles.com/some" }), { ip: "203.0.113.22" });
		expect(await codigos(sem)).toContain("fonte_nao_confirma");

		servir("https://www.metropoles.com/paywall", paywallHtml);
		const paywall = await post(corpoBase({ fonte: "https://www.metropoles.com/paywall" }), { ip: "203.0.113.23" });
		expect(await codigos(paywall)).toContain("fonte_nao_confirma");

		servir("https://www.metropoles.com/pago", paywallHtml, 402);
		const pago = await post(corpoBase({ fonte: "https://www.metropoles.com/pago" }), { ip: "203.0.113.24" });
		expect(await codigos(pago)).toContain("fonte_inacessivel");

		network.use(
			http.get("https://www.metropoles.com/sai", () =>
				HttpResponse.redirect("https://evil.example/x", 302),
			),
		);
		const redirect = await post(corpoBase({ fonte: "https://www.metropoles.com/sai" }), { ip: "203.0.113.25" });
		expect(await codigos(redirect)).toContain("fonte_inacessivel");
	});

	it("soma 97 e 103 passam e válidos a exatamente 1 ponto passam", async () => {
		await importar();
		await runInDurableObject(stub(), async (_inst, state) => {
			state.storage.sql.exec("DELETE FROM suspensoes");
		});
		servir("https://www.metropoles.com/s97", "<p>Datafolha 48% e 45%</p>");
		const s97 = await post(
			corpoBase({
				fonte: "https://www.metropoles.com/s97",
				totais: { flavio: 48, lula: 45, brancoNulo: 3, naoSabe: 1 },
				validosPublicados: null,
			}),
			{ ip: "203.0.113.30" },
		);
		expect(s97.status).toBe(201);

		servir("https://www.metropoles.com/s103", "<p>AtlasIntel 50% e 49%</p>");
		const s103 = await post(
			corpoBase({
				registro: "BR-03663/2026",
				fonte: "https://www.metropoles.com/s103",
				totais: { flavio: 50, lula: 49, brancoNulo: 3, naoSabe: 1 },
				validosPublicados: null,
			}),
			{ ip: "203.0.113.30" },
		);
		expect(s103.status).toBe(201);

		servir("https://www.metropoles.com/exato", "<p>Ipespe 50% e 50%</p>");
		const exato = await post(
			corpoBase({
				registro: "BR-00933/2026",
				fonte: "https://www.metropoles.com/exato",
				totais: { flavio: 50, lula: 50, brancoNulo: 0, naoSabe: 0 },
				validosPublicados: { flavio: 51, lula: 49 },
			}),
			{ ip: "203.0.113.30" },
		);
		expect(exato.status).toBe(201);
		expect(await codigos(exato)).not.toContain("validos_incoerentes");
	});

	it("página com instituto e 49%/45% publica e sai de liberadasSemNumero", async () => {
		await importar();
		servir(FONTE, confirmaHtml);
		const res = await post(corpoBase(), { ip: "203.0.113.40" });
		expect(res.status).toBe(201);
		expect(await res.json()).toEqual({ status: "publicado" });
		const lista = await fetchWorker(new Request("http://presidente2026.test/api/pesquisas"));
		expect(lista.status).toBe(200);
		const corpo = (await lista.json()) as PayloadPesquisas;
		const publicada = corpo.publicadas.find((p) => p.registro === DATAFOLHA);
		expect(publicada).toMatchObject({
			instituto: "Datafolha",
			contratantes: ["Folha de S.Paulo", "TV Globo"],
			entrevistas: 2520,
			margem: 2,
			confianca: 95,
			totais: { flavio: 49, lula: 45, brancoNulo: 5, naoSabe: 1, brancoNuloNaoSabe: null },
			validosPublicados: { flavio: 52, lula: 48 },
			vf: 52.13,
			vl: 47.87,
			v: 4.26,
			fonte: FONTE,
			substituidoEm: null,
		});
		expect(corpo.liberadasSemNumero.some((f) => f.registro === DATAFOLHA)).toBe(false);
		expect(corpo.vemAi.some((f) => f.registro === DATAFOLHA)).toBe(false);
		const auditoria = await stub().listarAuditoriaAgente();
		expect(auditoria.at(-1)).toMatchObject({ status: 201, chaveValida: true, registro: DATAFOLHA });
	});

	it("página só com os válidos publicados também aceita", async () => {
		await importar();
		servir("https://poder360.com.br/datafolha", soValidosHtml);
		const res = await post(corpoBase({ fonte: "https://poder360.com.br/datafolha" }), { ip: "203.0.113.41" });
		expect(res.status).toBe(201);
	});

	it("um único 50% não confirma o par 50 e 50", async () => {
		await importar();
		servir("https://www.metropoles.com/um50", "<p>Ipespe cravou 50% dos votos válidos.</p>");
		const res = await post(
			corpoBase({
				registro: "BR-00933/2026",
				fonte: "https://www.metropoles.com/um50",
				totais: { flavio: 50, lula: 50, brancoNulo: 0, naoSabe: 0 },
				validosPublicados: null,
			}),
			{ ip: "203.0.113.43" },
		);
		expect(res.status).toBe(422);
		expect(await codigos(res)).toContain("fonte_nao_confirma");
	});

	it("aceita 49 % e 49,0% como o mesmo inteiro", async () => {
		await importar();
		servir("https://www.folha.uol.com.br/poder/datafolha", "<p>Datafolha Flávio 49 % , Lula 45%</p>");
		const espaco = await post(
			corpoBase({ fonte: "https://www.folha.uol.com.br/poder/datafolha", validosPublicados: null }),
			{ ip: "203.0.113.42" },
		);
		expect(espaco.status).toBe(201);
		servir("https://www1.folha.uol.com.br/datafolha-virgula", "<p>Datafolha 49,0% e 45,0%</p>");
		const virgula = await post(
			corpoBase({
				registro: "BR-00466/2026",
				fonte: "https://www1.folha.uol.com.br/datafolha-virgula",
				validosPublicados: null,
			}),
			{ ip: "203.0.113.42" },
		);
		expect(virgula.status).toBe(201);
	});

	it("repetir sem substituir recusa ja_publicado", async () => {
		await importar();
		servir(FONTE, confirmaHtml);
		expect((await post(corpoBase(), { ip: "203.0.113.50" })).status).toBe(201);
		const deNovo = await post(corpoBase(), { ip: "203.0.113.50" });
		expect(deNovo.status).toBe(422);
		expect(await codigos(deNovo)).toContain("ja_publicado");
		const troca = await post(corpoBase({ substituir: true }), { ip: "203.0.113.50" });
		expect(troca.status).toBe(200);
		expect(await troca.json()).toEqual({ status: "substituido" });
		const lista = await fetchWorker(new Request("http://presidente2026.test/api/pesquisas"));
		const corpo = (await lista.json()) as PayloadPesquisas;
		expect(corpo.publicadas.find((p) => p.registro === DATAFOLHA)?.substituidoEm).toEqual(
			expect.any(String),
		);
	});

	it("campo que termina em 25/10 antes das 17h fica antes da liberação", () => {
		const registro = { liberacaoEfetiva: "2026-10-25", campoFim: "2026-10-25" };
		expect(antesDaLiberacao(registro, new Date("2026-10-25T16:59:00-03:00"))).toBe(true);
		expect(antesDaLiberacao(registro, new Date("2026-10-25T17:00:00-03:00"))).toBe(false);
	});

	it("corpo grande sem chave responde 401, audita e na 6ª tentativa devolve 429", async () => {
		const grande = "x".repeat(32_769);
		const ip = "203.0.113.77";
		for (let i = 0; i < 5; i++) {
			const res = await post(grande, { chave: null, ip });
			expect(res.status).toBe(401);
			expect(await res.json()).toEqual({ erro: "nao_autorizado" });
		}
		const sexta = await post(grande, { chave: null, ip });
		expect(sexta.status).toBe(429);
		expect(sexta.headers.get("retry-after")).toBe("60");
		const auditoria = await stub().listarAuditoriaAgente();
		expect(auditoria.filter((a) => a.status === 401)).toHaveLength(5);
		expect(auditoria.some((a) => a.status === 429)).toBe(true);
		expect(auditoria.every((a) => a.corpo.length <= 32_768)).toBe(true);
	});

	it("corpo grande com chave não publica", async () => {
		await importar();
		const grande = `${JSON.stringify(corpoBase())}${" ".repeat(32_769)}`;
		const res = await post(grande, { ip: "203.0.113.78" });
		expect(res.status).toBe(422);
		expect(await codigos(res)).toContain("numeros_invalidos");
		const auditoria = await stub().listarAuditoriaAgente();
		expect(auditoria.at(-1)).toMatchObject({ status: 422, chaveValida: true });
		const lista = await fetchWorker(new Request("http://presidente2026.test/api/pesquisas"));
		const corpo = (await lista.json()) as PayloadPesquisas;
		expect(corpo.publicadas.some((p) => p.registro === DATAFOLHA)).toBe(false);
	});

	it("corpo vazio acumula os motivos de registro e de totais", async () => {
		const res = await post({}, { ip: "203.0.113.79" });
		expect(res.status).toBe(422);
		const json = (await res.json()) as { motivos: { codigo: string; detalhe: string }[] };
		const detalhes = json.motivos
			.filter((m) => m.codigo === "numeros_invalidos")
			.map((m) => m.detalhe);
		expect(detalhes).toEqual(expect.arrayContaining(["registro ausente", "totais ausentes"]));
	});

	it("sem página lida a fonte fica inacessível", () => {
		expect(motivoDaFonte(null, null, false)).toEqual({
			codigo: "fonte_inacessivel",
			detalhe: "não foi possível ler a fonte",
		});
		expect(
			motivoDaFonte("<p>Datafolha 49% 45%</p>", null, false)?.codigo,
		).toBe("fonte_nao_confirma");
		expect(motivoDaFonte("<p>ok</p>", null, true)).toBeNull();
	});
});
