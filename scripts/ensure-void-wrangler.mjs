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
const configPath = join(root, "void.config.ts");
const builtMain = join(root, "dist/ssr/index.js");
const builtWranglerPath = join(root, "dist/ssr/wrangler.json");
const ACCOUNT = "aaec42ffcbeebcd4cda5beff4af4c439";

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
if (!existsSync(builtWranglerPath)) {
	console.error(
		"ensure-void-wrangler: falta dist/ssr/wrangler.json — rode `vite build` antes dos testes.",
	);
	process.exit(1);
}
if (!existsSync(configPath)) {
	console.error("ensure-void-wrangler: falta void.config.ts");
	process.exit(1);
}

const authored = readFileSync(configPath, "utf8");
if (!authored.includes(`account_id: "${ACCOUNT}"`)) {
	console.error(
		`ensure-void-wrangler: void.config.ts sem account_id ${ACCOUNT}`,
	);
	process.exit(1);
}
if (!/notFound:\s*"none"/.test(authored)) {
	console.error('ensure-void-wrangler: void.config.ts sem notFound: "none"');
	process.exit(1);
}

const lock = JSON.parse(readFileSync(lockPath, "utf8"));
const resolved = lock.resolved;
if (!resolved || typeof resolved !== "object") {
	console.error("ensure-void-wrangler: void.lock.json sem `.resolved`");
	process.exit(1);
}
if (resolved.account_id !== ACCOUNT) {
	console.error(
		`ensure-void-wrangler: void.lock.json resolved.account_id != ${ACCOUNT}`,
	);
	process.exit(1);
}

const builtWrangler = JSON.parse(readFileSync(builtWranglerPath, "utf8"));
const builtNotFound = builtWrangler.assets?.not_found_handling;
if (builtNotFound !== "none") {
	console.error(
		`ensure-void-wrangler: dist/ssr/wrangler.json assets.not_found_handling=${JSON.stringify(builtNotFound)} (quer "none"; senão GET /api/* 404 vira HTML SPA)`,
	);
	process.exit(1);
}

const { $schema: _drop, main: _ignore, ...config } = resolved;
config.main = "dist/ssr/index.js";
config.account_id = ACCOUNT;
// Política de asset 404 vem do wrangler materializado pelo build (não hardcode
// independente): se o build voltar a SPA, o pool de teste espelha e /api/tela2 falha.
config.assets = {
	directory: "./public",
	binding: "ASSETS",
	run_worker_first: true,
	not_found_handling: builtNotFound,
};

writeFileSync(out, `${JSON.stringify(config, null, 2)}\n`);
console.log("ensure-void-wrangler: wrote wrangler.vitest.jsonc");
