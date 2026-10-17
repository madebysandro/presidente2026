import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

test("deploy.cloudflare.mode é atomic", () => {
	const texto = readFileSync(new URL("../void.config.ts", import.meta.url), "utf8");
	const modo = texto.match(/deploy:\s*\{[\s\S]*?mode:\s*(["'])([^"']+)\1/);
	assert.ok(modo, "void.config.ts declara deploy.cloudflare.mode");
	assert.equal(modo[2], "atomic");
	assert.notEqual(modo[2], "staged");
	assert.doesNotMatch(texto, /mode:\s*["']staged["']/);
});
