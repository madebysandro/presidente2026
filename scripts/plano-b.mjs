/**
 * Plano B (#22). Dry-run da fixture, ou ZIP local + POST se houver chave.
 *
 *   node scripts/plano-b.mjs --fixture
 *   CHAVE_IMPORT=… PLANO_B_URL=https://presidente2026.win/api/import \
 *     node scripts/plano-b.mjs --zip-pesquisa /tmp/pesquisa.zip --zip-contratante /tmp/contratante.zip --post
 *
 * Não imprime a chave.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import * as esbuild from "esbuild";

const RAIZ = join(import.meta.dirname, "..");
const args = new Set(process.argv.slice(2));
const valor = (nome) => {
	const i = process.argv.indexOf(nome);
	return i >= 0 ? process.argv[i + 1] : undefined;
};

const pesquisaPath = args.has("--fixture")
	? join(RAIZ, "fixtures/pesquisas-tse/fixture_dia0_pesquisa.zip")
	: valor("--zip-pesquisa");
const contratantePath = args.has("--fixture")
	? join(RAIZ, "fixtures/pesquisas-tse/fixture_dia0_contratante.zip")
	: valor("--zip-contratante");
if (!pesquisaPath || !contratantePath) {
	console.error("use --fixture ou --zip-pesquisa e --zip-contratante");
	process.exit(1);
}

const outfile = "/tmp/plano-b-recorte.mjs";
await esbuild.build({
	entryPoints: [join(RAIZ, "scripts/plano-b-entrada.ts")],
	bundle: true,
	format: "esm",
	platform: "node",
	outfile,
	logLevel: "silent",
});
const modulo = await import(`${pathToFileURL(outfile).href}?t=${Date.now()}`);
const registros = await modulo.recorteNacionalDeZips(
	readFileSync(pesquisaPath),
	readFileSync(contratantePath),
);
const corpo = JSON.stringify({ registros });
console.error(`nacionais ${registros.length}`);
if (!args.has("--post")) {
	process.stdout.write(corpo);
	process.exit(0);
}
const chave = process.env.CHAVE_IMPORT ?? "";
const url = process.env.PLANO_B_URL ?? "";
if (!chave || !url) {
	console.error("POST pede CHAVE_IMPORT e PLANO_B_URL");
	process.exit(1);
}
const resposta = await fetch(url, {
	method: "POST",
	headers: {
		authorization: `Bearer ${chave}`,
		"content-type": "application/json",
	},
	body: corpo,
});
const texto = await resposta.text();
console.log(`${resposta.status} ${texto.slice(0, 300)}`);
process.exit(resposta.ok ? 0 : 1);
