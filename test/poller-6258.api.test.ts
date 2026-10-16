/**
 * Aceite #17: ciclo de 39 arquivos, escada das 17h, análise do 2º turno,
 * snapshot do 1º turno e noite sintética com virada.
 */
import { fetchWorker } from "./helpers/fetch-worker";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import brZerado from "../fixtures/tse-6258-zerado/br.json" with { type: "json" };
import spZerado from "../fixtures/tse-6258-zerado/sp.json" with { type: "json" };
import { ABERTURA_2T_MS } from "../src/apuracao/abertura";
import { alvosCiclo } from "../src/apuracao/escopos";
import { corposNoiteVirada } from "../src/apuracao/noite-sintetica";
import {
	forcarConsulta,
	lerAlarme,
	limparPoller,
	stubPoller,
} from "./helpers/poller";
import { instalarTseFalso } from "./helpers/tse-falso";

type ApuracaoApi = {
	fase?: string;
	versao: number;
	encerrada?: boolean;
	proximaConsulta: number | null;
	erro: string | null;
	cargos: {
		presidente?: {
			apurado: number;
			totais: { comparecimento: number; eleitorado: number };
			candidatos: { n: string; votos: number }[];
		};
		governador?: unknown;
		senador?: unknown;
		depfed?: unknown;
		depest?: unknown;
	};
	ufs?: Record<
		string,
		{ uf: string; comparecimento: number; apurado: number; candidatos: { n: string }[] }
	>;
	colegios?: Record<
		string,
		{
			cd: string;
			nome: string;
			comparecimento: number;
			t1?: { eleitorado: number; lider: string | null; votos: Record<string, number> } | null;
		}
	>;
	analise?: {
		majoritarias?: {
			presidente?: {
				primeiroTurno: unknown;
				validosAApurar: number | null;
				vantagemVotos: number;
			};
			governador?: unknown;
		};
		destaques?: unknown[];
		viradas?: { de: string; para: string; ap: number }[];
		momentos?: { tipo: string; n?: string; para?: string }[];
		regioes?: { nome: string; lider: string | null; lider1t: string | null }[];
		comparacao?: {
			primeiro: { flavio: number; lula: number; abstencao: number };
			estimativa: { selo: string } | null;
		};
		fechamento?: {
			comparecimento1t: number;
			viradas: number;
			brancos1t: number;
		} | null;
	};
};

async function lerApuracao(): Promise<ApuracaoApi> {
	const resposta = await fetchWorker(
		new Request("http://presidente2026.test/api/apuracao"),
	);
	expect(resposta.status).toBe(200);
	return resposta.json() as Promise<ApuracaoApi>;
}

describe("fixtures do 6258 zerado e do 1º turno", () => {
	it("o arquivo real zerado do Brasil e de uma UF é a eleição 6258 com apurado 0", () => {
		for (const arq of [brZerado, spZerado]) {
			const bruto = arq as {
				ele: string;
				tf: string;
				s?: { pstn?: string | number };
			};
			expect(String(bruto.ele)).toBe("6258");
			expect(bruto.tf).toBe("n");
			expect(Number(String(bruto.s?.pstn).replace(",", "."))).toBe(0);
		}
	});

	it("o snapshot versionado reproduz os totais-chave da spec", async () => {
		const estado = await import("../fixtures/primeiro-turno/estado-6257.json");
		const colegios = await import("../fixtures/primeiro-turno/colegios-6257.json");
		const e = estado.default as {
			cargos: {
				presidente: {
					totais: { eleitorado: number; validos: number; comparecimento: number };
					candidatos: { n: string; votos: number; pct: number }[];
				};
			};
			ufs: Record<string, { eleitorado: number; candidatos: { n: string; votos: number }[] }>;
		};
		const c = colegios.default as {
			exterior: { eleitorado: number; pctComparecimento: number; votos: Record<string, number> };
			municipios: { cd: string }[];
		};
		const porN = Object.fromEntries(
			e.cargos.presidente.candidatos.map((cand) => [cand.n, cand]),
		);
		expect(e.cargos.presidente.totais.eleitorado).toBe(158_745_502);
		expect(e.cargos.presidente.totais.validos).toBe(119_300_788);
		expect(e.cargos.presidente.totais.comparecimento).toBeCloseTo(78.92, 2);
		expect(porN["22"]!.votos).toBe(56_104_503);
		expect(porN["22"]!.pct).toBeCloseTo(47.03, 2);
		expect(porN["13"]!.votos).toBe(53_879_538);
		expect(porN["13"]!.pct).toBeCloseTo(45.16, 2);
		expect(e.ufs.zz!.eleitorado).toBe(916_534);
		expect(e.ufs.zz!.candidatos.find((cand) => cand.n === "22")!.votos).toBe(143_900);
		expect(e.ufs.zz!.candidatos.find((cand) => cand.n === "13")!.votos).toBe(157_387);
		expect(c.exterior.eleitorado).toBe(916_534);
		expect(c.exterior.pctComparecimento).toBeCloseTo(37.31, 2);
		expect(c.exterior.votos["22"]).toBe(143_900);
		expect(c.exterior.votos["13"]).toBe(157_387);
		expect(c.municipios.map((m) => m.cd)).toEqual([
			"71072",
			"60011",
			"97012",
			"41238",
			"38490",
			"13897",
			"02550",
			"75353",
			"25313",
			"88013",
		]);
	});
});

describe("GET /api/apuracao — ciclo 6258 (#17)", () => {
	let tse: ReturnType<typeof instalarTseFalso>;

	beforeEach(() => {
		tse = instalarTseFalso();
	});

	afterEach(async () => {
		await limparPoller();
	});

	it("consulta br, 27 UFs, exterior e 10 colégios, sem Pará proporcional", async () => {
		expect(alvosCiclo()).toHaveLength(39);
		await forcarConsulta();
		const dados = await lerApuracao();
		const urls = tse.pedidos.map((p) => p.url);

		expect(urls).toHaveLength(39);
		expect(new Set(urls).size).toBe(39);
		expect(urls.some((u) => u.includes("/br/br-c0001-e006258-u.json"))).toBe(true);
		expect(urls.some((u) => u.includes("/zz/zz-c0001-e006258-u.json"))).toBe(true);
		expect(urls.some((u) => u.includes("/pa/pa-c0001-e006258-u.json"))).toBe(true);
		expect(urls.some((u) => u.includes("/sp/sp71072-c0001-e006258-u.json"))).toBe(true);
		expect(urls.some((u) => u.includes("/am/am02550-c0001-e006258-u.json"))).toBe(true);
		expect(urls.some((u) => u.includes("e006259") || u.includes("-c0003-") || u.includes("-c0006-"))).toBe(false);

		expect(Object.keys(dados.cargos)).toEqual(["presidente"]);
		expect(dados.cargos.governador).toBeUndefined();
		expect(dados.cargos.senador).toBeUndefined();
		expect(Object.keys(dados.ufs ?? {})).toHaveLength(28);
		expect(dados.ufs?.zz?.comparecimento).toBeCloseTo(40.096233785, 6);
		expect(dados.cargos.presidente?.totais.comparecimento).toBeCloseTo(79.146093977, 6);
		expect(dados.colegios?.["71072"]?.comparecimento).toBeCloseTo(77.769803742, 6);
		expect(dados.colegios?.["71072"]?.t1?.eleitorado).toBe(9_145_124);
		expect(dados.colegios?.["71072"]?.t1?.votos["13"]).toBe(3_052_349);
		expect(Object.keys(dados.colegios ?? {})).toHaveLength(10);
		expect(dados.analise?.regioes).toHaveLength(5);
		expect(dados.analise?.majoritarias?.presidente?.primeiroTurno).toBeNull();
		expect(dados.analise?.majoritarias?.governador).toBeUndefined();
		expect(dados.analise?.destaques ?? []).toEqual([]);
		expect(JSON.stringify(dados)).not.toMatch(/vencer no 1/i);
		expect(dados.analise?.comparacao?.primeiro.flavio).toBeCloseTo(
			(56_104_503 / 158_745_502) * 100,
			5,
		);
		expect(dados.analise?.comparacao?.estimativa?.selo).toBe("ESTIMATIVA");
		expect(dados.fase).toBe(
			Date.now() >= ABERTURA_2T_MS ? "ao_vivo" : "pesquisas",
		);
	});

	it("uma UF abaixo de 100% impede encerrar mesmo com o Brasil a 100%", async () => {
		tse.definirVarianteSecoes({
			padrao: "100,00",
			tf: "s",
			porChave: { "pres-pa": "99,50" },
		});
		await forcarConsulta();
		const dados = await lerApuracao();
		expect(dados.cargos.presidente?.apurado).toBe(100);
		expect(dados.ufs?.pa?.apurado).toBeCloseTo(99.5, 5);
		expect(dados.encerrada).toBeFalsy();
		expect(await lerAlarme()).toEqual(expect.any(Number));
	});

	it("antes das 17h a espera não ultrapassa o horário", async () => {
		tse.definirCacheControl("max-age=10");
		const fixo = ABERTURA_2T_MS - 50 * 60 * 1000;
		await stubPoller().fixarAgora(fixo);
		await forcarConsulta();
		for (let i = 0; i < 6; i++) await forcarConsulta();
		const dados = await lerApuracao();
		expect(dados.fase).toBe("pesquisas");
		expect(dados.proximaConsulta).toBeLessThanOrEqual(ABERTURA_2T_MS);
		expect(dados.proximaConsulta! - fixo).toBeGreaterThanOrEqual(50 * 60 * 1000 - 50);
		expect(dados.proximaConsulta! - fixo).toBeLessThanOrEqual(50 * 60 * 1000 + 50);
		expect(await lerAlarme()).toBe(dados.proximaConsulta);
	});

	it("dez segundos antes das 17h a espera cabe no que falta", async () => {
		tse.definirCacheControl("max-age=10");
		const fixo = ABERTURA_2T_MS - 10_000;
		await stubPoller().fixarAgora(fixo);
		await forcarConsulta();
		const dados = await lerApuracao();
		expect(dados.proximaConsulta).toBeLessThanOrEqual(ABERTURA_2T_MS);
		expect(dados.proximaConsulta! - fixo).toBeLessThanOrEqual(10_000);
		expect(dados.proximaConsulta! - fixo).toBeGreaterThanOrEqual(10_000 - 50);
	});

	it("depois das 17h com apurado 0 a espera fica em no máximo 60 s", async () => {
		tse.definirCacheControl("max-age=10");
		tse.definirVarianteSecoes({ padrao: 0, tf: "n" });
		const fixo = ABERTURA_2T_MS + 5 * 60 * 1000;
		await stubPoller().fixarAgora(fixo);
		await forcarConsulta();
		await forcarConsulta();
		const t = fixo;
		await forcarConsulta();
		const dados = await lerApuracao();
		expect(dados.fase).toBe("ao_vivo");
		expect(dados.cargos.presidente?.apurado).toBe(0);
		expect(dados.encerrada).toBeFalsy();
		expect(dados.proximaConsulta! - t).toBeLessThanOrEqual(60_000 + 50);
		expect(dados.proximaConsulta! - t).toBeGreaterThanOrEqual(60_000 - 50);
	});

	it("a noite sintética detecta a virada e os momentos", async () => {
		tse.usarNoiteSintetica(corposNoiteVirada());
		await forcarConsulta();
		expect((await lerApuracao()).analise?.viradas ?? []).toEqual([]);

		tse.avancar();
		await forcarConsulta();
		const meio = await lerApuracao();
		expect(meio.analise?.viradas).toEqual([
			expect.objectContaining({ de: "22", para: "13" }),
		]);

		tse.avancar();
		await forcarConsulta();
		const fim = await lerApuracao();
		expect(fim.analise?.viradas).toHaveLength(2);
		expect(fim.analise?.viradas?.[1]).toEqual(
			expect.objectContaining({ de: "13", para: "22" }),
		);
		const tipos = (fim.analise?.momentos ?? []).map((m) => m.tipo);
		expect(tipos).toContain("abre");
		expect(tipos).toContain("virada");
		expect(tipos).toContain("metade");
		expect(fim.analise?.momentos?.find((m) => m.tipo === "abre")?.n).toBe("22");
		expect(fim.analise?.fechamento).toBeNull();
	});

	it("encerrada tira a estimativa e publica comparecimento com o 1º turno", async () => {
		tse.definirVarianteSecoes({ padrao: "100,00", tf: "s" });
		await forcarConsulta();
		const dados = await lerApuracao();
		expect(dados.fase).toBe("encerrada");
		expect(dados.analise?.majoritarias?.presidente?.validosAApurar).toBeNull();
		expect(dados.analise?.majoritarias?.presidente?.primeiroTurno).toBeNull();
		expect(dados.analise?.fechamento?.comparecimento1t).toBeCloseTo(78.916358094, 5);
		expect(dados.analise?.fechamento?.brancos1t).toBeCloseTo(1.836585643, 5);
		expect(dados.analise?.momentos?.some((m) => m.tipo === "eleito")).toBe(true);
		const hist = await fetchWorker(
			new Request("http://presidente2026.test/api/historico?desde=0"),
		);
		expect(hist.status).toBe(200);
		expect(Array.isArray(await hist.json())).toBe(true);
	});
});
