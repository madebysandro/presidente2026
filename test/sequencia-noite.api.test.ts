/**
 * Sequência real início → meio → fim (Presidente 6258).
 */
import { fetchWorker } from "./helpers/fetch-worker";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { forcarConsulta, limparPoller } from "./helpers/poller";
import {
	CICLOS_NOITE,
	instalarTseFalso,
	resolverArquivo,
} from "./helpers/tse-falso";

type ApuracaoApi = {
	versao: number;
	cargos: {
		presidente?: { hora: string; apurado: number };
		governador?: { hora: string; apurado: number };
	};
};

async function lerApuracao(): Promise<ApuracaoApi> {
	const resposta = await fetchWorker(
		new Request("http://presidente2026.test/api/apuracao"),
	);
	expect(resposta.status).toBe(200);
	return resposta.json() as Promise<ApuracaoApi>;
}

describe("GET /api/apuracao — sequência real da noite (#7)", () => {
	let tse: ReturnType<typeof instalarTseFalso>;

	beforeEach(() => {
		tse = instalarTseFalso({ sequenciaNoite: true });
	});

	afterEach(async () => {
		await limparPoller();
	});

	it("serve início → meio → fim em ordem (só Presidente)", async () => {
		expect(CICLOS_NOITE).toHaveLength(3);
		expect(tse.cicloAtual()).toBe(CICLOS_NOITE[0]);

		await forcarConsulta();
		const inicio = await lerApuracao();
		expect(inicio.versao).toBe(1);
		expect(inicio.cargos.presidente?.hora).toBe("18:32:24");
		expect(inicio.cargos.presidente?.apurado).toBeCloseTo(31.896372144, 6);
		expect(inicio.cargos.governador).toBeUndefined();
		expect(resolverArquivo("presidente", CICLOS_NOITE[0])?.etag).toMatch(
			/^"/,
		);

		tse.avancar();
		expect(tse.cicloAtual()).toBe(CICLOS_NOITE[1]);
		await forcarConsulta();
		const meio = await lerApuracao();
		expect(meio.versao).toBe(2);
		expect(meio.cargos.presidente?.apurado).toBeGreaterThan(
			inicio.cargos.presidente!.apurado,
		);

		tse.avancar();
		expect(tse.cicloAtual()).toBe(CICLOS_NOITE[2]);
		await forcarConsulta();
		const fim = await lerApuracao();
		expect(fim.versao).toBe(3);
		expect(fim.cargos.presidente?.apurado).toBeGreaterThan(
			meio.cargos.presidente!.apurado,
		);
	});
});
