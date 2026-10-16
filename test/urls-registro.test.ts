import { describe, expect, it } from "vitest";
import { URL_ZIP_CONTRATANTE, URL_ZIP_PESQUISA, urlsRegistroTse } from "../src/pesquisas/fontes";

describe("URLs do registro do TSE", () => {
	it("sem override continua no CDN oficial", () => {
		expect(urlsRegistroTse()).toEqual({
			pesquisa: URL_ZIP_PESQUISA,
			contratante: URL_ZIP_CONTRATANTE,
		});
		expect(URL_ZIP_PESQUISA).toBe(
			"https://cdn.tse.jus.br/estatistica/sead/odsele/pesquisa_eleitoral/pesquisa_eleitoral_2026.zip",
		);
		expect(URL_ZIP_CONTRATANTE).toBe(
			"https://cdn.tse.jus.br/estatistica/sead/odsele/pesquisa_eleitoral/pesquisa_contratante_2026.zip",
		);
	});

	it("CDN_PESQUISAS troca só o host, para o ensaio local", () => {
		expect(urlsRegistroTse({ CDN_PESQUISAS: "http://127.0.0.1:9/" })).toEqual({
			pesquisa:
				"http://127.0.0.1:9/estatistica/sead/odsele/pesquisa_eleitoral/pesquisa_eleitoral_2026.zip",
			contratante:
				"http://127.0.0.1:9/estatistica/sead/odsele/pesquisa_eleitoral/pesquisa_contratante_2026.zip",
		});
	});
});
