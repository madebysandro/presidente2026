import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import {
	encodeCloudflareVersionMessage,
	parseCloudflareVersionMessage,
} from "@void/deploy-cloudflare";
import {
	bindingsRecusados,
	recusarBindings,
	recusarComandoDeploy,
	recusarPreviews,
} from "./pre-deploy.mjs";

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

test("config sem bloco previews passa", () => {
	assert.deepEqual(recusarPreviews(limpo()), { ok: true });
});

test("previews vazio no config falha", () => {
	const entrada = limpo();
	entrada.configText += "previews: {}\n";
	const resultado = recusarPreviews(entrada);
	assert.equal(resultado.ok, false);
	assert.ok(
		resultado.erros.some(
			(erro) => erro.includes("previews") && erro.includes("void.config.ts"),
		),
	);
});

test("previews com espaços antes dos dois pontos falha", () => {
	const entrada = limpo();
	entrada.configText += "previews  : {}\n";
	const resultado = recusarPreviews(entrada);
	assert.equal(resultado.ok, false);
	assert.ok(resultado.erros.some((erro) => erro.includes("void.config.ts")));
});

test("lock source.previews falha", () => {
	const entrada = limpo();
	entrada.lock.source.previews = {};
	const resultado = recusarPreviews(entrada);
	assert.equal(resultado.ok, false);
	assert.ok(
		resultado.erros.some(
			(erro) => erro.includes("previews") && erro.includes("void.lock.json"),
		),
	);
});

test("o comando de deploy do package.json passa", () => {
	const pacote = JSON.parse(
		readFileSync(new URL("../package.json", import.meta.url), "utf8"),
	);
	assert.equal(pacote.scripts.deploy, "void deploy --platform cloudflare");
	assert.equal(pacote.scripts.predeploy, undefined);
	assert.equal(pacote.scripts.postdeploy, undefined);
	assert.deepEqual(recusarComandoDeploy(pacote.scripts), { ok: true });
});

test("um wrapper que passa --message falha", () => {
	const resultado = recusarComandoDeploy({
		deploy: "void deploy --platform cloudflare --message '2481396 assunto (#1)'",
	});
	assert.equal(resultado.ok, false);
	assert.ok(resultado.erros.some((erro) => erro.includes("workers/message")));
});

test("um script que não é o void deploy falha", () => {
	const resultado = recusarComandoDeploy({
		deploy: "node scripts/deploy-com-mensagem.mjs",
	});
	assert.equal(resultado.ok, false);
});

test("predeploy e postdeploy falham", () => {
	for (const gancho of ["predeploy", "postdeploy"]) {
		const resultado = recusarComandoDeploy({
			deploy: "void deploy --platform cloudflare",
			[gancho]: "node scripts/deploy-com-mensagem.mjs",
		});
		assert.equal(resultado.ok, false);
		assert.ok(resultado.erros.some((erro) => erro.includes(gancho)));
	}
});

const migrationsDoEstado = ["void-durable-pesquisas-v1", "void-durable-poller-v1"];
const gatilhoDoEstado = {
	preserve: true,
	settingsHash: "ab".repeat(32),
	workers_dev: false,
	preview_urls: false,
	routes: [{ pattern: "presidente2026.win", custom_domain: true }],
	crons: [],
	queueConsumers: [],
	workflows: [],
};
const mensagemHumana = "2481396 Fluxo: limpar o diff e provar no app local (#81)";
const estadoLiteral = `void:${JSON.stringify({
	schema: 2,
	migrations: migrationsDoEstado,
	triggerConfig: gatilhoDoEstado,
})}`;

test("o Void 1.1.11 grava o estado em void:{json} e relê schema 2", () => {
	assert.equal(
		encodeCloudflareVersionMessage(migrationsDoEstado, gatilhoDoEstado),
		estadoLiteral,
	);
	const lido = parseCloudflareVersionMessage(estadoLiteral);
	assert.equal(lido.schema, 2);
	assert.deepEqual(lido.migrations, migrationsDoEstado);
	assert.equal(lido.triggerConfig.settingsHash, gatilhoDoEstado.settingsHash);
	assert.equal(lido.triggerConfig.preserve, true);
});

test("schema fora de 1 e 2 não é estado", () => {
	const objeto = JSON.parse(estadoLiteral.slice("void:".length));
	objeto.schema = 3;
	assert.equal(parseCloudflareVersionMessage(`void:${JSON.stringify(objeto)}`), null);
});

test("mensagem humana, prefixo ou sufixo não são estado", () => {
	assert.equal(parseCloudflareVersionMessage(mensagemHumana), null);
	assert.equal(parseCloudflareVersionMessage(`${mensagemHumana}\n${estadoLiteral}`), null);
	assert.equal(parseCloudflareVersionMessage(`${estadoLiteral}\n${mensagemHumana}`), null);
});

test("campo extra no JSON some na releitura e na regravação", () => {
	const objeto = JSON.parse(estadoLiteral.slice("void:".length));
	objeto.nota = mensagemHumana;
	const lido = parseCloudflareVersionMessage(`void:${JSON.stringify(objeto)}`);
	assert.equal(lido.nota, undefined);
	assert.equal(lido.contentHash, undefined);
	assert.equal(encodeCloudflareVersionMessage(lido.migrations, lido.triggerConfig), estadoLiteral);
});

test("chave extra dentro do triggerConfig não volta no parse", () => {
	const codificado = encodeCloudflareVersionMessage(migrationsDoEstado, {
		...gatilhoDoEstado,
		nota: mensagemHumana,
	});
	assert.match(codificado, /"nota"/);
	const lido = parseCloudflareVersionMessage(codificado);
	assert.equal(lido.triggerConfig.nota, undefined);
	assert.equal(encodeCloudflareVersionMessage(lido.migrations, lido.triggerConfig), estadoLiteral);
});

test("contentHash de 64 hex volta no parse e some na regravação de dois argumentos", () => {
	const hash = "cd".repeat(32);
	const comHash = encodeCloudflareVersionMessage(migrationsDoEstado, gatilhoDoEstado, hash);
	const lido = parseCloudflareVersionMessage(comHash);
	assert.equal(lido.contentHash, hash);
	assert.equal(encodeCloudflareVersionMessage(lido.migrations, lido.triggerConfig), estadoLiteral);
});

test("build com previews vazio falha", () => {
	const entrada = limpo();
	entrada.buildJson.previews = {};
	const resultado = recusarPreviews(entrada);
	assert.equal(resultado.ok, false);
	assert.ok(
		resultado.erros.some(
			(erro) => erro.includes("previews") && erro.includes("{}"),
		),
	);
});
