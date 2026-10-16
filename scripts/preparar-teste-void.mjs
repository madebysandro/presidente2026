#!/usr/bin/env node
/**
 * O pool de teste roda o bundle de dist/ssr dentro do Miniflare.
 * A config gerada pelo Vite não traz `main`; este script confere o
 * build e grava as opções do runtime local (sem taxa: o binding não
 * zera entre casos).
 */
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { conferirProjeto, opcoesMiniflare, RAIZ } from "./runtime-local.mjs";

const { resolved, builtNotFound } = conferirProjeto(RAIZ);
const opcoes = opcoesMiniflare({
	config: resolved,
	base: RAIZ,
	notFound: builtNotFound,
	vars: {
		...(resolved.vars ?? {}),
		CHAVE_AGENTE: "teste-chave-agente",
	},
});
// O pool resolve caminhos a partir da raiz do projeto.
opcoes.assets.directory = "./public";

const out = join(RAIZ, "worker.vitest.json");
writeFileSync(out, `${JSON.stringify(opcoes, null, 2)}\n`);
console.log("preparar-teste-void: wrote worker.vitest.json");
