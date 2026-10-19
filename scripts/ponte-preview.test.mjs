import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { test } from "node:test";
import {
	RELATIVO_PONTE,
	RELATIVO_STASH,
	conferirPonte,
	objetoVazio,
	restaurarPonte,
} from "./ponte-preview.mjs";

function diretorio() {
	return mkdtempSync(join(tmpdir(), "ponte-preview-"));
}

function escrever(raiz, relativo, conteudo) {
	const caminho = join(raiz, relativo);
	mkdirSync(dirname(caminho), { recursive: true });
	writeFileSync(caminho, conteudo);
}

test("objeto vazio", () => {
	assert.equal(objetoVazio({}), true);
	assert.equal(objetoVazio({ vars: {} }), false);
	assert.equal(objetoVazio(null), false);
	assert.equal(objetoVazio([]), false);
});

test("regrava a ponte a partir do stash e confere previews vazio", () => {
	const raiz = diretorio();
	try {
		escrever(
			raiz,
			RELATIVO_STASH,
			JSON.stringify({ configPath: "../../dist/ssr/wrangler.json" }),
		);
		escrever(
			raiz,
			"dist/ssr/wrangler.json",
			JSON.stringify({ name: "presidente2026", previews: {} }),
		);
		const resultado = restaurarPonte(raiz);
		assert.equal(resultado.ok, true);
		assert.equal(
			readFileSync(join(raiz, RELATIVO_PONTE), "utf8"),
			readFileSync(join(raiz, RELATIVO_STASH), "utf8"),
		);
		assert.equal(resultado.json.previews && Object.keys(resultado.json.previews).length, 0);
	} finally {
		rmSync(raiz, { recursive: true, force: true });
	}
});

test("ponte ausente e sem stash falha", () => {
	const raiz = diretorio();
	try {
		const resultado = restaurarPonte(raiz);
		assert.equal(resultado.ok, false);
		assert.ok(resultado.erros.some((erro) => erro.includes(RELATIVO_PONTE)));
	} finally {
		rmSync(raiz, { recursive: true, force: true });
	}
});

test("conferir sem ponte falha", () => {
	const raiz = diretorio();
	try {
		const resultado = conferirPonte(raiz);
		assert.equal(resultado.ok, false);
		assert.ok(resultado.erros.some((erro) => erro.includes("wrangler preview")));
	} finally {
		rmSync(raiz, { recursive: true, force: true });
	}
});

test("alvo sem previews falha", () => {
	const raiz = diretorio();
	try {
		escrever(
			raiz,
			RELATIVO_PONTE,
			JSON.stringify({ configPath: "../../dist/ssr/wrangler.json" }),
		);
		escrever(raiz, "dist/ssr/wrangler.json", JSON.stringify({ name: "presidente2026" }));
		const resultado = conferirPonte(raiz);
		assert.equal(resultado.ok, false);
		assert.ok(resultado.erros.some((erro) => erro.includes("previews")));
	} finally {
		rmSync(raiz, { recursive: true, force: true });
	}
});

test("previews com binding falha", () => {
	const raiz = diretorio();
	try {
		escrever(
			raiz,
			RELATIVO_PONTE,
			JSON.stringify({ configPath: "../../dist/ssr/wrangler.json" }),
		);
		escrever(
			raiz,
			"dist/ssr/wrangler.json",
			JSON.stringify({ previews: { vars: { AMBIENTE: "preview" } } }),
		);
		const resultado = conferirPonte(raiz);
		assert.equal(resultado.ok, false);
		assert.ok(resultado.erros.some((erro) => erro.includes("AMBIENTE")));
	} finally {
		rmSync(raiz, { recursive: true, force: true });
	}
});
