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

const CPU_MS = 300_000;
if (builtWrangler.limits?.cpu_ms !== CPU_MS) {
	console.error(
		`ensure-void-wrangler: dist/ssr/wrangler.json limits.cpu_ms=${JSON.stringify(builtWrangler.limits?.cpu_ms)} (quer ${CPU_MS}; o CSV do TSE não cabe nos 10 ms do plano Free)`,
	);
	process.exit(1);
}
if (!/worker:\s*\{[\s\S]*?limits:\s*\{\s*cpu_ms:\s*300_000/.test(authored)) {
	console.error(
		"ensure-void-wrangler: void.config.ts worker.limits.cpu_ms ausente (o void deploy lê esse campo, não só o wrangler gerado)",
	);
	process.exit(1);
}
const limitesEsperados = [
	{
		name: "LIMITE_AGENTE_CHAVE",
		namespace_id: "625801",
		simple: { limit: 30, period: 60 },
	},
	{
		name: "LIMITE_AGENTE_IP",
		namespace_id: "625802",
		simple: { limit: 5, period: 60 },
	},
];
if (JSON.stringify(builtWrangler.ratelimits) !== JSON.stringify(limitesEsperados)) {
	console.error(
		`ensure-void-wrangler: dist/ssr/wrangler.json ratelimits=${JSON.stringify(builtWrangler.ratelimits)} (quer chave 30/60s e IP 5/60s)`,
	);
	process.exit(1);
}

const route = Array.isArray(builtWrangler.routes) ? builtWrangler.routes[0] : undefined;
const routeKeys = route && typeof route === "object" ? Object.keys(route).sort() : [];
const routeOk =
	builtWrangler.routes?.length === 1 &&
	route?.pattern === "presidente2026.win" &&
	route?.custom_domain === true &&
	routeKeys.length === 2;
if (
	builtWrangler.workers_dev !== false ||
	builtWrangler.preview_urls !== false ||
	!routeOk
) {
	console.error(
		`ensure-void-wrangler: dist/ssr/wrangler.json traffic=${JSON.stringify({
			workers_dev: builtWrangler.workers_dev,
			preview_urls: builtWrangler.preview_urls,
			routes: builtWrangler.routes,
		})} (quer workers_dev false, preview_urls false, custom domain presidente2026.win)`,
	);
	process.exit(1);
}

const { $schema: _drop, main: _ignore, ratelimits: _semBindingNoTeste, ...config } = resolved;
config.main = "dist/ssr/index.js";
config.account_id = ACCOUNT;
// O binding de taxa não zera entre testes e dividiria o balde com o contador do DO.
// Produção continua com ratelimits em dist/ssr/wrangler.json.
// Política de asset 404 vem do wrangler materializado pelo build (não hardcode
// independente): se o build voltar a SPA, o pool de teste espelha e /api/tela2 falha.
config.assets = {
	directory: "./public",
	binding: "ASSETS",
	run_worker_first: true,
	not_found_handling: builtNotFound,
};
// Segredo de teste. Produção usa `wrangler secret put CHAVE_AGENTE` (não vai no void.config).
config.vars = {
	...(config.vars ?? {}),
	CHAVE_AGENTE: "teste-chave-agente",
};

writeFileSync(out, `${JSON.stringify(config, null, 2)}\n`);
console.log("ensure-void-wrangler: wrote wrangler.vitest.jsonc");
