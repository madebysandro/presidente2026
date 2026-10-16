/**
 * Aceite #22: rota interna do plano B.
 * Seam: POST /api/import — auth, recorte e upsert no mesmo DO do cron.
 */
import { runInDurableObject } from "cloudflare:test";
import { env } from "cloudflare:workers";
import { beforeEach, describe, expect, it } from "vitest";
import dia0ContratanteUrl from "../fixtures/pesquisas-tse/fixture_dia0_contratante.zip?inline";
import dia0PesquisaUrl from "../fixtures/pesquisas-tse/fixture_dia0_pesquisa.zip?inline";
import { recorteNacionalDeZips } from "../src/pesquisas/plano-b";
import type { Pesquisas } from "../src/pesquisas/pesquisas";
import type { RegistroPesquisas } from "../src/pesquisas/tipos";
import { bytesDeDataUrl, instalarCdnPesquisas } from "./helpers/cdn-pesquisas";
import { fetchWorker } from "./helpers/fetch-worker";
import { NACIONAIS } from "./helpers/nacionais-oracle";

const CHAVE_AGENTE = "teste-chave-agente";
const CHAVE_IMPORT = "teste-chave-import";

const dia0Pesquisa = bytesDeDataUrl(dia0PesquisaUrl);
const dia0Contratante = bytesDeDataUrl(dia0ContratanteUrl);

function stub(): DurableObjectStub<Pesquisas> {
	return env.PESQUISAS.getByName("singleton") as DurableObjectStub<Pesquisas>;
}

async function limpar(): Promise<void> {
	await runInDurableObject(stub(), async (_inst, state) => {
		await state.storage.deleteAll();
	});
}

function ids(lista: readonly { registro: string }[]): string[] {
	return [...lista].map((item) => item.registro).sort();
}

function post(bearer: string | null, registros: readonly RegistroPesquisas[]) {
	const headers = new Headers({ "content-type": "application/json" });
	if (bearer) headers.set("authorization", `Bearer ${bearer}`);
	return fetchWorker(
		new Request("https://presidente2026.test/api/import", {
			method: "POST",
			headers,
			body: JSON.stringify({ registros }),
		}),
	);
}

beforeEach(async () => {
	await limpar();
});

describe("plano B do import (#22)", () => {
	it("a fixture do ZIP gera as 33 nacionais do oráculo", async () => {
		const registros = await recorteNacionalDeZips(dia0Pesquisa, dia0Contratante);
		expect(registros).toHaveLength(33);
		expect(ids(registros)).toEqual(ids(NACIONAIS));
		expect(registros.every((registro) => registro.classificacao === "nacional")).toBe(true);
	});

	it("só CHAVE_IMPORT grava; a chave do agente não entra nesta rota nem a de import no agente", async () => {
		const registros = await recorteNacionalDeZips(dia0Pesquisa, dia0Contratante);
		expect((await post(null, registros)).status).toBe(401);
		expect((await post(CHAVE_AGENTE, registros)).status).toBe(401);
		expect((await stub().obterEstado()).registros).toBe(0);

		const ok = await post(CHAVE_IMPORT, registros);
		expect(ok.status).toBe(200);
		await expect(ok.json()).resolves.toEqual({
			status: "aplicado",
			upserts: 33,
			removidos: 0,
		});
		await expect(stub().obterContagens()).resolves.toMatchObject({ nacional: 33 });

		const deNovo = await post(CHAVE_IMPORT, registros);
		expect(deNovo.status).toBe(200);
		expect((await stub().obterEstado()).registros).toBe(33);

		const agente = await fetchWorker(
			new Request("https://presidente2026.test/api/agente/pendentes", {
				headers: { authorization: `Bearer ${CHAVE_IMPORT}` },
			}),
		);
		expect(agente.status).toBe(401);
	});

	it("não apaga estadual e marca a nacional que sumiu do recorte", async () => {
		instalarCdnPesquisas({
			pesquisa: dia0Pesquisa,
			contratante: dia0Contratante,
			etagPesquisa: '"dia0-pesquisa"',
			etagContratante: '"dia0-contratante"',
			condicional304: false,
		});
		const cheio = await stub().importarDoTse({ motivo: "teste" });
		if (cheio.kind !== "aplicar") throw new Error(cheio.kind);
		const estadual = cheio.upserts.find((registro) => registro.classificacao === "estadual");
		const nacional = cheio.upserts.find((registro) => registro.classificacao === "nacional");
		if (!estadual || !nacional) throw new Error("fixture sem os dois tipos");
		const recorte = cheio.upserts.filter(
			(registro) => registro.classificacao === "nacional" && registro.registro !== nacional.registro,
		);
		const resposta = await post(CHAVE_IMPORT, recorte);
		expect(resposta.status).toBe(200);
		await expect(resposta.json()).resolves.toMatchObject({ removidos: 1 });
		await expect(stub().obterRegistro(nacional.registro)).resolves.toMatchObject({
			removidoDoTse: true,
		});
		await expect(stub().obterRegistro(estadual.registro)).resolves.toMatchObject({
			classificacao: "estadual",
			removidoDoTse: false,
		});
		await expect(stub().obterContagens()).resolves.toMatchObject({
			nacional: 32,
			estadual: 24,
		});
	});

	it("recorte vazio ou com estadual não grava", async () => {
		expect((await post(CHAVE_IMPORT, [])).status).toBe(422);
		const estadual = {
			registro: "BR-00001/2026",
			cnpj: "1",
			instituto: "X",
			contratantes: ["recursos próprios"],
			campoInicio: "2026-10-06",
			campoFim: "2026-10-08",
			liberacao: "2026-10-08",
			liberacaoEfetiva: "2026-10-08",
			entrevistas: 1000,
			margem: 2,
			confianca: 95,
			classificacao: "estadual",
			removidoDoTse: false,
		} as RegistroPesquisas;
		expect((await post(CHAVE_IMPORT, [estadual])).status).toBe(422);
		expect((await stub().obterEstado()).registros).toBe(0);
	});
});
