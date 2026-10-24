import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { createServer } from "node:http";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { desfechoDoPost } from "./plano-b-desfecho.mjs";

const SCRIPT = fileURLToPath(new URL("./plano-b.mjs", import.meta.url));
const ENCERRADA = JSON.stringify({
	erro: "apuracao_encerrada",
	detalhe: "a apuração do 2º turno foi encerrada; pesquisas e resultados estão congelados",
});

test("200 passa", () => {
	assert.equal(desfechoDoPost(200, '{"contagens":{}}').ok, true);
});

test("409 apuracao_encerrada passa e diz que encerrou", () => {
	const desfecho = desfechoDoPost(409, ENCERRADA);
	assert.equal(desfecho.ok, true);
	assert.match(desfecho.mensagem, /apuração encerrada/);
});

test("409 com outro erro falha", () => {
	assert.equal(desfechoDoPost(409, '{"erro":"outro"}').ok, false);
});

test("409 sem JSON falha", () => {
	assert.equal(desfechoDoPost(409, "apuracao_encerrada").ok, false);
});

test("409 com JSON que não é objeto falha", () => {
	assert.equal(desfechoDoPost(409, "null").ok, false);
	assert.equal(desfechoDoPost(409, '"apuracao_encerrada"').ok, false);
});

test("apuracao_encerrada com outro status falha", () => {
	assert.equal(desfechoDoPost(422, ENCERRADA).ok, false);
	assert.equal(desfechoDoPost(500, ENCERRADA).ok, false);
});

test("401, 422 e 500 falham", () => {
	assert.equal(desfechoDoPost(401, '{"erro":"nao_autorizado"}').ok, false);
	assert.equal(desfechoDoPost(422, '{"erro":"recorte_invalido"}').ok, false);
	assert.equal(desfechoDoPost(500, "erro").ok, false);
});

async function rodarContra(status, corpo) {
	const servidor = createServer((req, res) => {
		req.resume();
		req.on("end", () => {
			res.writeHead(status, { "content-type": "application/json" });
			res.end(corpo);
		});
	});
	await new Promise((ok) => servidor.listen(0, "127.0.0.1", ok));
	const { port } = servidor.address();
	try {
		return await new Promise((ok, falha) => {
			const filho = spawn(process.execPath, [SCRIPT, "--fixture", "--post"], {
				env: {
					...process.env,
					CHAVE_IMPORT: "teste",
					PLANO_B_URL: `http://127.0.0.1:${port}/api/import`,
				},
			});
			let saida = "";
			filho.stdout.on("data", (pedaco) => {
				saida += pedaco;
			});
			filho.stderr.on("data", (pedaco) => {
				saida += pedaco;
			});
			filho.on("error", falha);
			filho.on("close", (codigo) => ok({ codigo, saida }));
		});
	} finally {
		servidor.close();
	}
}

test("o script sai 0 no 409 apuracao_encerrada", async () => {
	const { codigo, saida } = await rodarContra(409, ENCERRADA);
	assert.equal(codigo, 0, saida);
	assert.match(saida, /apuração encerrada/);
});

test("o script sai 1 em outro 409", async () => {
	const { codigo, saida } = await rodarContra(409, '{"erro":"outro"}');
	assert.equal(codigo, 1, saida);
});

test("o script sai 1 no 500", async () => {
	const { codigo, saida } = await rodarContra(500, "falhou");
	assert.equal(codigo, 1, saida);
});
