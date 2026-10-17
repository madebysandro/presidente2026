import assert from "node:assert/strict";
import { test } from "node:test";
import { bindingsRecusados, recusarBindings } from "./pre-deploy.mjs";

function limpo() {
	return {
		configText: 'export default { cloudflare: { account_id: "abc" } };\n',
		lock: {
			source: { account_id: "abc" },
			resolved: { account_id: "abc" },
		},
		buildJson: { name: "presidente2026", assets: {}, main: "index.js" },
	};
}

test("a denylist é só ratelimits", () => {
	assert.deepEqual(bindingsRecusados, ["ratelimits"]);
});

test("config limpa passa", () => {
	assert.deepEqual(recusarBindings(limpo()), { ok: true });
});

test("ratelimits com espaços antes dos dois pontos falha", () => {
	const entrada = limpo();
	entrada.configText += "ratelimits  : []\n";
	const resultado = recusarBindings(entrada);
	assert.equal(resultado.ok, false);
	assert.ok(resultado.erros.some((erro) => erro.includes("void.config.ts")));
});

test("ratelimits: no config falha", () => {
	const entrada = limpo();
	entrada.configText += "ratelimits: []\n";
	const resultado = recusarBindings(entrada);
	assert.equal(resultado.ok, false);
	assert.ok(
		resultado.erros.some(
			(erro) => erro.includes("ratelimits") && erro.includes("void.config.ts"),
		),
	);
});

test("lock source.ratelimits falha", () => {
	const entrada = limpo();
	entrada.lock.source.ratelimits = [{ name: "LIMITE_AGENTE_CHAVE" }];
	const resultado = recusarBindings(entrada);
	assert.equal(resultado.ok, false);
	assert.ok(
		resultado.erros.some(
			(erro) => erro.includes("ratelimits") && erro.includes("void.lock.json"),
		),
	);
});

test("lock resolved.ratelimits falha", () => {
	const entrada = limpo();
	entrada.lock.resolved.ratelimits = [{ name: "LIMITE_AGENTE_CHAVE" }];
	const resultado = recusarBindings(entrada);
	assert.equal(resultado.ok, false);
	assert.ok(
		resultado.erros.some(
			(erro) => erro.includes("ratelimits") && erro.includes("void.lock.json"),
		),
	);
});

test('lock text com "ratelimits" falha', () => {
	const entrada = limpo();
	entrada.lock.text = '{ "ratelimits": [] }';
	const resultado = recusarBindings(entrada);
	assert.equal(resultado.ok, false);
	assert.ok(
		resultado.erros.some(
			(erro) => erro.includes("ratelimits") && erro.includes("void.lock.json"),
		),
	);
});

test("build com ratelimits não vazio falha", () => {
	const entrada = limpo();
	entrada.buildJson.ratelimits = [{ name: "LIMITE_AGENTE_CHAVE" }];
	const resultado = recusarBindings(entrada);
	assert.equal(resultado.ok, false);
	assert.ok(
		resultado.erros.some(
			(erro) => erro.includes("ratelimits") && erro.includes("LIMITE_AGENTE_CHAVE"),
		),
	);
});

test("build com ratelimits vazio passa", () => {
	const entrada = limpo();
	entrada.buildJson.ratelimits = [];
	assert.deepEqual(recusarBindings(entrada), { ok: true });
});
