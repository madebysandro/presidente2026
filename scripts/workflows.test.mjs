import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import test from "node:test";

const DIR = new URL("../.github/workflows/", import.meta.url);
const WORKFLOWS = readdirSync(DIR).filter((nome) => /\.ya?ml$/.test(nome));

function ler(nome) {
	return readFileSync(new URL(nome, DIR), "utf8");
}

test("nenhum if: de workflow usa o contexto secrets", () => {
	for (const nome of WORKFLOWS) {
		const linhas = ler(nome)
			.split("\n")
			.filter((linha) => /^\s*(-\s*)?if:.*\bsecrets\./.test(linha));
		assert.deepEqual(linhas, [], nome);
	}
});

test("o envio do Plano B depende de env.TEM_CHAVE, sem a chave no env do job", () => {
	const yml = ler("plano-b-import.yml");
	assert.match(yml, /^ {2}importar:\n(?: {4}.*\n)*? {4}env:\n {6}TEM_CHAVE: \$\{\{ secrets\.CHAVE_IMPORT != '' \}\}\n/m);
	assert.match(yml, /^ {8}if: env\.TEM_CHAVE == 'true'\n/m);
	assert.doesNotMatch(yml, /^ {6}CHAVE_IMPORT:/m);
	assert.match(yml, /^ {10}CHAVE_IMPORT: \$\{\{ secrets\.CHAVE_IMPORT \}\}\n/m);
});

test("o job ci roda o actionlint fixado antes do npm ci", () => {
	const yml = ler("ci.yml");
	const lint = yml.indexOf("uses: docker://rhysd/actionlint:1.7.12");
	assert.notEqual(lint, -1);
	assert.ok(lint < yml.indexOf("- run: npm ci"));
});
