#!/usr/bin/env node
/**
 * Sonda as rotas /api/agente* no bundle de dist/ssr, dentro do Miniflare
 * puro (o mesmo runtime do ensaio, sem o resolvedor de módulos do vitest).
 * Pega o que o pool de teste esconde: import que só resolve no Node vira
 * 500 no Worker de produção.
 *
 * Uso: npm run build && node scripts/sondar-agente.mjs
 */
import { join } from "node:path";
import { convertV4MiniflareOptions, Miniflare } from "miniflare";
import { acharConfigDoBuild, modulosDoBundle, opcoesMiniflare, RAIZ } from "./runtime-local.mjs";

const CHAVE = "sonda-local";

function runtime(comChave) {
	const build = acharConfigDoBuild(join(RAIZ, "dist/ssr"));
	const config = build.json;
	const vars = { ...config.vars };
	if (comChave) vars.CHAVE_AGENTE = CHAVE;
	const opcoes = opcoesMiniflare({ config, base: build.dir, vars });
	const convertido = convertV4MiniflareOptions({
		name: config.name,
		modules: modulosDoBundle(build.dir),
		modulesRoot: build.dir,
		compatibilityDate: opcoes.compatibilityDate,
		compatibilityFlags: opcoes.compatibilityFlags,
		bindings: opcoes.bindings,
		durableObjects: opcoes.durableObjects,
		assets: opcoes.assets,
	});
	convertido.workers[0].config.limits = { cpuMs: opcoes.limits.cpuMs };
	return new Miniflare(convertido);
}

// Com chave válida e corpo vazio, as rotas de escrita recusam o corpo
// (4xx que não é 401): passaram da autenticação sem 500.
const CORPO_RECUSADO = (s) => s >= 400 && s < 500 && s !== 401;
const POST_VAZIO = { method: "POST", body: "{}" };

const CASOS = [
	// [rota, opções, bearer, esperado com segredo, esperado sem segredo]
	// GET /api/agente é público (instruções em markdown); só o 429 vale.
	["/api/agente", {}, CHAVE, 200, 200],
	["/api/agente", {}, null, 200, 200],
	["/api/agente/pendentes", {}, CHAVE, 200, 401],
	["/api/agente/pendentes", {}, "errada", 401, 401],
	["/api/agente/pendentes", {}, null, 401, 401],
	["/api/agente/auditoria", {}, CHAVE, 200, 401],
	["/api/agente/auditoria", {}, null, 401, 401],
	["/api/agente/resultados", POST_VAZIO, CHAVE, CORPO_RECUSADO, 401],
	["/api/agente/resultados", POST_VAZIO, null, 401, 401],
	["/api/agente/suspensoes", POST_VAZIO, CHAVE, CORPO_RECUSADO, 401],
	["/api/agente/suspensoes", POST_VAZIO, null, 401, 401],
	["/api/agente/suspensoes/inexistente", { method: "DELETE", body: "{}" }, CHAVE, CORPO_RECUSADO, 401],
	["/api/agente/suspensoes/inexistente", { method: "DELETE", body: "{}" }, null, 401, 401],
];

function confere(status, esperado) {
	return typeof esperado === "function" ? esperado(status) : status === esperado;
}

let falhas = 0;
for (const comChave of [true, false]) {
	const mf = runtime(comChave);
	const url = await mf.ready;
	console.log(`\n== CHAVE_AGENTE ${comChave ? "definida" : "ausente"} ==`);
	let ip = 1;
	for (const [rota, opcoes, bearer, comSegredo, semSegredo] of CASOS) {
		const esperado = comChave ? comSegredo : semSegredo;
		const metodo = opcoes.method ?? "GET";
		const headers = {
			"cf-connecting-ip": `203.0.113.${ip++}`,
			"content-type": "application/json",
		};
		if (bearer) headers.authorization = `Bearer ${bearer}`;
		const res = await fetch(new URL(rota, url), { ...opcoes, method: metodo, headers });
		const corpo = (await res.text()).slice(0, 60).replace(/\s+/g, " ");
		const ok = confere(res.status, esperado);
		if (!ok) falhas++;
		const quer = typeof esperado === "function" ? "4xx≠401" : esperado;
		console.log(
			`${ok ? "ok  " : "FAIL"} ${metodo} ${rota} bearer=${bearer ?? "-"} → ${res.status} (quer ${quer}) ${corpo}`,
		);
	}
	await mf.dispose();
}

if (falhas > 0) {
	console.error(`\nsondar-agente: ${falhas} caso(s) fora do esperado`);
	process.exit(1);
}
console.log("\nsondar-agente: todas as rotas /api/agente* ok");
