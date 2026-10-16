import { describe, expect, it } from "vitest";
import { ErroTse } from "../src/poller/cliente-tse";
import { eventoPoller } from "../src/poller/log";

const base = {
	lidos: 3,
	naoModificados: 26,
	mudou: true,
	cicloCompleto: true,
	apurado: 42.17,
	encerrada: false,
	proximaMs: 60_000,
	erro: null,
	ms: 812,
};

describe("evento de log de um ciclo do poller", () => {
	it("ciclo sem erro vira resultado ok com os campos do ciclo", () => {
		expect(eventoPoller(base)).toEqual({
			evento: "poller",
			resultado: "ok",
			lidos: 3,
			naoModificados: 26,
			mudou: true,
			cicloCompleto: true,
			apurado: 42.17,
			encerrada: false,
			proximaMs: 60_000,
			ms: 812,
		});
	});

	it("ciclo que encerrou não agenda próxima consulta", () => {
		const e = eventoPoller({ ...base, encerrada: true, proximaMs: null, apurado: 100 });
		expect(e).toMatchObject({ resultado: "ok", encerrada: true, proximaMs: null, apurado: 100 });
	});

	it("erro com status do TSE leva statusTse e a mensagem", () => {
		const erro = Object.assign(new Error("TSE respondeu 503"), { status: 503 });
		const e = eventoPoller({ ...base, lidos: 0, mudou: false, erro });
		expect(e).toMatchObject({
			resultado: "erro",
			statusTse: 503,
			erro: "TSE respondeu 503",
			lidos: 0,
			mudou: false,
		});
	});

	it("erro sem status não inventa statusTse", () => {
		const e = eventoPoller({ ...base, erro: new ErroTse("TSE pediu calma (429)", 120) });
		expect(e).toMatchObject({ resultado: "erro", erro: "TSE pediu calma (429)" });
		expect(e).not.toHaveProperty("statusTse");
	});

	it("antes do primeiro boletim o apurado é null", () => {
		expect(eventoPoller({ ...base, apurado: null })).toMatchObject({ apurado: null });
	});
});
