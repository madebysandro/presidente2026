/**
 * Aceite #20: fixture encerrada na API e na página.
 * Seam: GET /api/apuracao, GET /api/pesquisas, GET / e o fragmento.
 */
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import dia0ContratanteUrl from "../fixtures/pesquisas-tse/fixture_dia0_contratante.zip?inline";
import dia0PesquisaUrl from "../fixtures/pesquisas-tse/fixture_dia0_pesquisa.zip?inline";
import { ABERTURA_2T_MS } from "../src/apuracao/abertura";
import { corpoDoPasso } from "../src/apuracao/noite-sintetica";
import type { PayloadPesquisas } from "../src/pesquisas/tipos";
import { bytesDeDataUrl, instalarCdnPesquisas } from "./helpers/cdn-pesquisas";
import { FAIXA_AO_VIVO_OU_PAUSADA } from "./helpers/faixa";
import { fetchWorker } from "./helpers/fetch-worker";
import { forcarConsulta, lerAlarme, limparPoller, stubPoller } from "./helpers/poller";
import { instalarTseFalso } from "./helpers/tse-falso";

type ApuracaoApi = {
	fase?: string;
	encerrada?: boolean;
	proximaConsulta: number | null;
	analise?: {
		fechamento?: { comparecimento: number; viradas: number } | null;
		majoritarias?: {
			presidente?: {
				validosAApurar: number | null;
				tendencias: unknown[];
			};
		};
	};
};

function instalarCdn() {
	instalarCdnPesquisas({
		pesquisa: bytesDeDataUrl(dia0PesquisaUrl),
		contratante: bytesDeDataUrl(dia0ContratanteUrl),
		etagPesquisa: '"dia0-pesquisa"',
		etagContratante: '"dia0-contratante"',
		condicional304: false,
	});
}

async function lerApuracao(): Promise<ApuracaoApi> {
	const resposta = await fetchWorker(new Request("http://presidente2026.test/api/apuracao"));
	expect(resposta.status).toBe(200);
	return resposta.json() as Promise<ApuracaoApi>;
}

async function htmlPagina(): Promise<string> {
	const resposta = await fetchWorker(new Request("http://presidente2026.test/"));
	expect(resposta.status).toBe(200);
	return resposta.text();
}

describe("fase encerrada na API e na página (#20)", () => {
	let tse: ReturnType<typeof instalarTseFalso>;

	beforeEach(() => {
		instalarCdn();
		tse = instalarTseFalso();
	});

	afterEach(async () => {
		await limparPoller();
	});

	it("com a apuração fechada, o JSON e a página ficam em encerrada e o poller não agenda outro ciclo", async () => {
		tse.usarNoiteSintetica([
			corpoDoPasso({
				apurado: 100,
				votos22: 9_000_000,
				votos13: 8_000_000,
				tf: "s",
				pcn: "75,0",
				hora: "22:10:00",
			}),
		]);
		tse.definirVarianteSecoes({ padrao: "100,00", tf: "s" });
		await forcarConsulta();
		expect(await lerAlarme()).toBeNull();
		await forcarConsulta();

		expect(await lerAlarme()).toBeNull();
		const dados = await lerApuracao();
		expect(dados.fase).toBe("encerrada");
		expect(dados.encerrada).toBe(true);
		expect(dados.proximaConsulta).toBeNull();
		expect(dados.analise?.majoritarias?.presidente?.validosAApurar).toBeNull();
		expect(dados.analise?.majoritarias?.presidente?.tendencias).toEqual([]);
		expect(dados.analise?.fechamento?.comparecimento).toBeCloseTo(75, 5);
		expect(dados.analise?.fechamento?.viradas).toBe(0);

		const pesquisas = await fetchWorker(new Request("http://presidente2026.test/api/pesquisas"));
		expect(pesquisas.status).toBe(200);
		const corpo = (await pesquisas.json()) as PayloadPesquisas;
		expect(corpo.fase).toBe("encerrada");
		expect(corpo.fase).not.toBe("ao_vivo");
		expect(corpo.fase).not.toBe("pesquisas");

		const html = await htmlPagina();
		expect(html).toContain('data-fase="encerrada"');
		expect(html).toContain("Resultado final · 2º turno");
		expect(html).toContain('data-eleito="22"');
		expect(html).not.toContain('data-eleito="13"');
		expect(html).toContain("75,0%");
		expect(html).toContain("1º turno 78,9%");
		expect(html).toContain("Pesquisas × urnas");
		expect(html).not.toContain("data-estimativas");
		expect(html).not.toContain("até a votação");
		expect(html).not.toContain("Ao vivo");
		expect(html).not.toContain("Aguardando 17h");
		expect(html).not.toMatch(/undefined|NaN/);

		const fragmento = await fetchWorker(
			new Request("http://presidente2026.test/?fragmento=1"),
		);
		const pedaco = (await fragmento.json()) as { fase: string; faixa: string; miolo: string };
		expect(pedaco.fase).toBe("encerrada");
		expect(pedaco.faixa).toContain("Resultado final · 2º turno");
		expect(pedaco.faixa).not.toContain("Ao vivo");
		expect(pedaco.miolo).toContain("data-analise-final");
		expect(pedaco.miolo).toContain("data-pesquisas-urnas");
		expect(pedaco.miolo).not.toContain("data-estimativas");
		expect(pedaco.miolo).not.toContain("até a votação");
	});

	it("ao vivo não mistura o carimbo, o selo nem a comparação com as urnas", async () => {
		tse.usarNoiteSintetica([
			corpoDoPasso({
				apurado: 48,
				votos22: 4_000_000,
				votos13: 4_500_000,
				tf: "n",
				pcn: "72,0",
				hora: "18:40:00",
			}),
		]);
		await stubPoller().fixarAgora(ABERTURA_2T_MS + 2 * 60 * 60 * 1000);
		await forcarConsulta();

		const dados = await lerApuracao();
		expect(dados.fase).toBe("ao_vivo");
		expect(dados.encerrada).toBeFalsy();
		expect(dados.analise?.fechamento).toBeNull();
		expect(dados.proximaConsulta).toEqual(expect.any(Number));

		const pesquisas = await fetchWorker(new Request("http://presidente2026.test/api/pesquisas"));
		const corpo = (await pesquisas.json()) as PayloadPesquisas;
		expect(corpo.fase).toBe("ao_vivo");

		const html = await htmlPagina();
		expect(html).toMatch(FAIXA_AO_VIVO_OU_PAUSADA);
		expect(html).toContain("data-estimativas");
		expect(html).not.toContain("Resultado final");
		expect(html).not.toContain("✓ Eleito");
		expect(html).not.toContain("data-pesquisas-urnas");
		expect(html).not.toContain("data-analise-final");
		expect(html).not.toContain("até a votação");
	});
});
