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

const { build, builtNotFound } = conferirProjeto(RAIZ);
// vars, limits e compatibility_date saem do JSON do build (bloco worker).
// O lock guarda o bloco cloudflare, que não repete esses campos. Os checks
// de conferirProjeto já recusaram data ou cpu_ms fora do esperado.
const built = build.json;
const opcoes = opcoesMiniflare({
	config: built,
	base: RAIZ,
	notFound: builtNotFound,
	vars: {
		...(built.vars ?? {}),
		CHAVE_AGENTE: "teste-chave-agente",
		CHAVE_IMPORT: "teste-chave-import",
	},
});
// O pool resolve caminhos a partir da raiz do projeto.
opcoes.assets.directory = "./public";

const out = join(RAIZ, "worker.vitest.json");
writeFileSync(out, `${JSON.stringify(opcoes, null, 2)}\n`);
console.log("preparar-teste-void: wrote worker.vitest.json");
