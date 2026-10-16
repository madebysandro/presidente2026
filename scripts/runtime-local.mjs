/**
 * Runtime local da Void (Miniflare), sem CLI de deploy.
 * O build emite um JSON do Worker em dist/ssr; este módulo acha esse
 * arquivo pela forma (nome, assets, main) e confere os invariantes
 * que o site precisa em produção.
 */
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, isAbsolute, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

export const RAIZ = join(dirname(fileURLToPath(import.meta.url)), "..");
const ACCOUNT = "aaec42ffcbeebcd4cda5beff4af4c439";
const CPU_MS = 300_000;
const LIMITES = [
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

function falha(mensagem) {
	console.error(mensagem);
	process.exit(1);
}

function absoluto(base, caminho) {
	if (typeof caminho !== "string" || caminho.length === 0) return caminho;
	return isAbsolute(caminho) ? caminho : resolve(base, caminho);
}

export function acharConfigDoBuild(dir) {
	if (!existsSync(dir)) falha(`config do build: falta ${dir}`);
	const achados = [];
	for (const nome of readdirSync(dir)) {
		if (!nome.endsWith(".json")) continue;
		const caminho = join(dir, nome);
		let json;
		try {
			json = JSON.parse(readFileSync(caminho, "utf8"));
		} catch {
			continue;
		}
		if (
			json &&
			json.name === "presidente2026" &&
			json.assets &&
			typeof json.main === "string"
		) {
			achados.push({ caminho, json, dir: dirname(caminho) });
		}
	}
	if (achados.length !== 1) {
		falha(
			`config do build: esperava 1 JSON do Worker em ${dir}, achei ${achados.length}`,
		);
	}
	return achados[0];
}

function classesSqlite(config) {
	const nomes = new Set();
	for (const migracao of config.migrations ?? []) {
		for (const nome of migracao.new_sqlite_classes ?? []) nomes.add(nome);
	}
	return nomes;
}

export function objetosDuraveis(config) {
	const sqlite = classesSqlite(config);
	const objetos = {};
	for (const binding of config.durable_objects?.bindings ?? []) {
		objetos[binding.name] = {
			className: binding.class_name,
			useSQLite: sqlite.has(binding.class_name),
		};
	}
	return objetos;
}

/** Módulos ESM do bundle. O entry `index.js` vem primeiro. */
export function modulosDoBundle(dir) {
	const modules = [];
	function andar(atual) {
		for (const nome of readdirSync(atual)) {
			if (nome === ".vite" || nome.endsWith(".map")) continue;
			const caminho = join(atual, nome);
			if (statSync(caminho).isDirectory()) {
				andar(caminho);
				continue;
			}
			if (!nome.endsWith(".js")) continue;
			modules.push({ type: "ESModule", path: caminho });
		}
	}
	andar(dir);
	modules.sort((a, b) => {
		const principal = (caminho) =>
			relative(dir, caminho).split(sep).join("/") === "index.js" ? 0 : 1;
		return principal(a.path) - principal(b.path) || a.path.localeCompare(b.path);
	});
	return modules;
}

export function opcoesMiniflare({ config, base, vars, notFound }) {
	const assets = config.assets ?? {};
	const directory = absoluto(base, assets.directory ?? "./public");
	return {
		compatibilityDate: config.compatibility_date,
		compatibilityFlags: config.compatibility_flags ?? [],
		bindings: vars,
		durableObjects: objetosDuraveis(config),
		assets: {
			directory,
			binding: assets.binding ?? "ASSETS",
			run_worker_first: assets.run_worker_first ?? true,
			routerConfig: { has_user_worker: true },
			assetConfig: {
				not_found_handling: notFound ?? assets.not_found_handling,
			},
		},
		limits: { cpuMs: config.limits?.cpu_ms ?? CPU_MS },
	};
}

/** Confere void.config.ts, o lock e o JSON do build. Devolve o que o teste usa. */
export function conferirProjeto(raiz = RAIZ) {
	const lockPath = join(raiz, "void.lock.json");
	const configPath = join(raiz, "void.config.ts");
	const builtMain = join(raiz, "dist/ssr/index.js");
	if (!existsSync(lockPath)) falha("conferir: falta void.lock.json");
	if (!existsSync(builtMain)) {
		falha("conferir: falta dist/ssr/index.js — rode `vite build` antes dos testes.");
	}
	if (!existsSync(configPath)) falha("conferir: falta void.config.ts");

	const authored = readFileSync(configPath, "utf8");
	if (!authored.includes(`account_id: "${ACCOUNT}"`)) {
		falha(`conferir: void.config.ts sem account_id ${ACCOUNT}`);
	}
	if (!/notFound:\s*"none"/.test(authored)) {
		falha('conferir: void.config.ts sem notFound: "none"');
	}
	if (!/worker:\s*\{[\s\S]*?limits:\s*\{\s*cpu_ms:\s*300_000/.test(authored)) {
		falha(
			"conferir: void.config.ts worker.limits.cpu_ms ausente (o void deploy lê esse campo)",
		);
	}

	const lock = JSON.parse(readFileSync(lockPath, "utf8"));
	const resolved = lock.resolved;
	if (!resolved || typeof resolved !== "object") {
		falha("conferir: void.lock.json sem `.resolved`");
	}
	if (resolved.account_id !== ACCOUNT) {
		falha(`conferir: void.lock.json resolved.account_id != ${ACCOUNT}`);
	}

	const build = acharConfigDoBuild(join(raiz, "dist/ssr"));
	const builtNotFound = build.json.assets?.not_found_handling;
	if (builtNotFound !== "none") {
		falha(
			`conferir: assets.not_found_handling=${JSON.stringify(builtNotFound)} (quer "none"; senão GET /api/* 404 vira HTML SPA)`,
		);
	}
	if (build.json.limits?.cpu_ms !== CPU_MS) {
		falha(
			`conferir: limits.cpu_ms=${JSON.stringify(build.json.limits?.cpu_ms)} (quer ${CPU_MS}; o CSV do TSE não cabe nos 10 ms do plano Free)`,
		);
	}
	if (build.json.compatibility_date !== "2026-08-22") {
		falha(
			`conferir: compatibility_date=${JSON.stringify(build.json.compatibility_date)} (quer 2026-08-22, vindo de worker)`,
		);
	}
	if (
		build.json.vars?.TSE_BASE !== "https://resultados.tse.jus.br/oficial" ||
		build.json.vars?.ELEICAO_FEDERAL !== "6258"
	) {
		falha(
			`conferir: vars=${JSON.stringify(build.json.vars)} (quer TSE_BASE e ELEICAO_FEDERAL só via worker)`,
		);
	}
	for (const nome of ["CHAVE_AGENTE", "CHAVE_IMPORT"]) {
		if (Object.hasOwn(build.json.vars ?? {}, nome)) {
			falha(
				`conferir: ${nome} não pode ser var em texto puro (é segredo; o build recusa server key em vars)`,
			);
		}
	}
	const segredosObrigatorios = build.json.secrets?.required ?? [];
	for (const nome of ["CHAVE_AGENTE", "CHAVE_IMPORT"]) {
		if (segredosObrigatorios.includes(nome)) {
			falha(
				`conferir: ${nome} obrigatória bloquearia void deploy enquanto o segredo não existir no remoto`,
			);
		}
	}
	if (JSON.stringify(build.json.ratelimits) !== JSON.stringify(LIMITES)) {
		falha(
			`conferir: ratelimits=${JSON.stringify(build.json.ratelimits)} (quer chave 30/60s e IP 5/60s)`,
		);
	}
	const route = Array.isArray(build.json.routes) ? build.json.routes[0] : undefined;
	const routeKeys = route && typeof route === "object" ? Object.keys(route).sort() : [];
	const routeOk =
		build.json.routes?.length === 1 &&
		route?.pattern === "presidente2026.win" &&
		route?.custom_domain === true &&
		routeKeys.length === 2;
	if (build.json.workers_dev !== false || build.json.preview_urls !== false || !routeOk) {
		falha(
			`conferir: tráfego=${JSON.stringify({
				workers_dev: build.json.workers_dev,
				preview_urls: build.json.preview_urls,
				routes: build.json.routes,
			})} (quer workers_dev false, preview_urls false, custom domain presidente2026.win)`,
		);
	}

	return { resolved, build, builtNotFound };
}
