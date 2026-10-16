#!/usr/bin/env node
/**
 * Vitest-pool-workers precisa de wrangler com `main`.
 * O `vite`/`voidPlugin` reescreve `.void-wrangler.jsonc` sem `main` em runtime;
 * por isso os testes usam `wrangler.vitest.jsonc` (fora do caminho gerado).
 */
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const out = join(root, "wrangler.vitest.jsonc");
const lockPath = join(root, "void.lock.json");
const builtMain = join(root, "dist/ssr/index.js");

if (!existsSync(lockPath)) {
	console.error("ensure-void-wrangler: falta void.lock.json");
	process.exit(1);
}
if (!existsSync(builtMain)) {
	console.error(
		"ensure-void-wrangler: falta dist/ssr/index.js — rode `vite build` antes dos testes.",
	);
	process.exit(1);
}

const lock = JSON.parse(readFileSync(lockPath, "utf8"));
const resolved = lock.resolved;
if (!resolved || typeof resolved !== "object") {
	console.error("ensure-void-wrangler: void.lock.json sem `.resolved`");
	process.exit(1);
}

const { $schema: _drop, main: _ignore, ...config } = resolved;
config.main = "dist/ssr/index.js";
config.assets = {
	directory: "./public",
	binding: "ASSETS",
	run_worker_first: true,
};

writeFileSync(out, `${JSON.stringify(config, null, 2)}\n`);
console.log("ensure-void-wrangler: wrote wrangler.vitest.jsonc");
