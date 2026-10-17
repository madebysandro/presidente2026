import assert from "node:assert/strict";
import { test } from "node:test";
import { LARGURAS, alvosDaProva, paginasDoDiff } from "./paginas.mjs";

test("as larguras da prova são 390 e 1280", () => {
	assert.deepEqual(LARGURAS, [390, 1280]);
});

test("arquivo da página inicial vira só a URL /", () => {
	assert.deepEqual(paginasDoDiff(["src/pagina/grafico.ts"]), ["/"]);
	assert.deepEqual(paginasDoDiff(["public/css/tres-semanas.css"]), ["/"]);
	assert.deepEqual(paginasDoDiff(["./public/js/calendario.js"]), ["/"]);
	assert.deepEqual(paginasDoDiff(["routes/index.ts"]), ["/"]);
});

test("arquivo da imagem OG vira só /og.png", () => {
	assert.deepEqual(paginasDoDiff(["routes/og.png.ts"]), ["/og.png"]);
	assert.deepEqual(paginasDoDiff(["src/pagina/previa-png.ts"]), ["/og.png"]);
});

test("previa.ts entra na página e na imagem", () => {
	assert.deepEqual(paginasDoDiff(["src/pagina/previa.ts"]), ["/", "/og.png"]);
});

test("diff sem página ainda prova a superfície primária", () => {
	assert.deepEqual(paginasDoDiff(["AGENTS.md"]), []);
	assert.deepEqual(alvosDaProva(["AGENTS.md", ".cursor/skills/verify-presidente2026/SKILL.md"]), [
		{ url: "/", motivo: "sem-pagina-no-diff" },
	]);
});

test("diff com página marca o motivo diff e não repete a URL", () => {
	assert.deepEqual(
		alvosDaProva(["src/pagina/topo.ts", "src/pagina/topo.ts", "routes/og.png.ts"]),
		[
			{ url: "/", motivo: "diff" },
			{ url: "/og.png", motivo: "diff" },
		],
	);
});
