import { describe, expect, it } from "vitest";
import { eventoImport } from "../src/pesquisas/log-import";
import type { MetaImport, RegistroPesquisas } from "../src/pesquisas/tipos";

const meta: MetaImport = {
	geradoEm: "2026-10-16T08:00:00-03:00",
	etagPesquisa: '"p-1"',
	etagContratante: '"c-1"',
	lastModifiedPesquisa: null,
	lastModifiedContratante: null,
	ultimoImportEm: "2026-10-16T11:00:00.000Z",
	contagens: { nacional: 2, estadual: 0, ambigua: 0 },
};

const registro = { registro: "BR-00001/2026" } as RegistroPesquisas;

describe("evento de log do import (#55)", () => {
	it("aplicado leva contagens e ETags do meta", () => {
		const evento = eventoImport(
			"cron",
			{
				kind: "aplicar",
				meta,
				upserts: [registro, registro],
				remover: ["BR-00009/2026"],
				auditoria: [
					{ em: "x", tipo: "import", registro: null, detalhe: "" },
					{ em: "x", tipo: "removido", registro: "BR-00009/2026", detalhe: "" },
					{ em: "x", tipo: "rejeitado", registro: null, detalhe: "" },
				],
			},
			120,
		);
		expect(evento).toEqual({
			evento: "import",
			motivo: "cron",
			resultado: "aplicado",
			upserts: 2,
			removidos: 1,
			auditoria: 3,
			etagPesquisa: '"p-1"',
			etagContratante: '"c-1"',
			ms: 120,
		});
	});

	it("nao_modificado leva as ETags do meta, sem contagens", () => {
		const evento = eventoImport("primeiro_acesso", { kind: "nao_modificado", meta }, 40);
		expect(evento).toEqual({
			evento: "import",
			motivo: "primeiro_acesso",
			resultado: "nao_modificado",
			etagPesquisa: '"p-1"',
			etagContratante: '"c-1"',
			ms: 40,
		});
	});

	it("congelado não leva ETags nem contagens (#86)", () => {
		const evento = eventoImport("cron", { kind: "congelado" }, 3);
		expect(evento).toEqual({ evento: "import", motivo: "cron", resultado: "congelado", ms: 3 });
	});

	it("erro leva a mensagem", () => {
		const evento = eventoImport(
			"cron",
			{ kind: "erro", erro: new Error("TSE respondeu 503 para https://x") },
			7,
		);
		expect(evento).toEqual({
			evento: "import",
			motivo: "cron",
			resultado: "erro",
			erro: "TSE respondeu 503 para https://x",
			ms: 7,
		});
	});

	it("erro que não é Error vira texto", () => {
		const evento = eventoImport("cron", { kind: "erro", erro: "falhou" }, 1);
		expect(evento).toMatchObject({ resultado: "erro", erro: "falhou" });
	});
});
