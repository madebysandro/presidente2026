import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import {
	encodeCloudflareVersionMessage,
	parseCloudflareVersionMessage,
	readCloudflareTriggerConfig,
} from "@void/deploy-cloudflare";
import { acharConfigDoBuild, RAIZ } from "./config-do-build.mjs";

function lerJson(relativo) {
	return JSON.parse(readFileSync(join(RAIZ, relativo), "utf8"));
}

const lock = lerJson("void.lock.json");
const MIGRACOES = lock.resolved.migrations.map((migracao) => migracao.tag);
const NO_AR = readFileSync(join(RAIZ, "fixtures/void/mensagem-versao-1.1.11.txt"), "utf8").trim();

function conferirSnapshot(metadados) {
	assert.ok(metadados, "parseCloudflareVersionMessage devolveu null");
	assert.equal(metadados.schema, 2);
	assert.deepEqual(metadados.migrations, MIGRACOES);
	const gatilhos = metadados.triggerConfig;
	assert.equal(gatilhos.preserve, true);
	assert.equal(gatilhos.workers_dev, false);
	assert.equal(gatilhos.preview_urls, false);
	assert.deepEqual(gatilhos.routes, [{ pattern: "presidente2026.win", custom_domain: true }]);
	assert.match(gatilhos.settingsHash, /^[0-9a-f]{64}$/);
}

test("o void que o deploy usa é o @void/deploy-cloudflare deste teste", () => {
	const voidPkg = lerJson("node_modules/void/package.json");
	const deployPkg = lerJson("node_modules/@void/deploy-cloudflare/package.json");
	assert.equal(voidPkg.dependencies["@void/deploy-cloudflare"], deployPkg.version);
});

test("o void instalado relê a mensagem schema 2 que o 1.1.11 gravou na versão no ar", () => {
	conferirSnapshot(parseCloudflareVersionMessage(NO_AR));
});

test("a mensagem do próximo deploy é schema 2, relida igual e abaixo de 1000 bytes", () => {
	const build = acharConfigDoBuild(join(RAIZ, "dist/ssr"));
	const mensagem = encodeCloudflareVersionMessage(MIGRACOES, {
		...readCloudflareTriggerConfig(build.caminho),
		preserve: true,
	});
	assert.ok(mensagem.startsWith("void:"));
	assert.ok(Buffer.byteLength(mensagem) <= 1000, `${Buffer.byteLength(mensagem)} bytes`);
	assert.doesNotMatch(mensagem, /contentHash/);
	conferirSnapshot(parseCloudflareVersionMessage(mensagem));
});
