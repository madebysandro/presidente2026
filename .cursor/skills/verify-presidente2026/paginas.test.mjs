import assert from "node:assert/strict";
import { test } from "node:test";
import {
	LARGURAS,
	alvosDaProva,
	htmlDoisTurno,
	noiteSemSuperficie,
	paginasDoDiff,
} from "./paginas.mjs";

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
	assert.deepEqual(paginasDoDiff(["src/pagina/gerar-base.ts"]), ["/og.png"]);
});

test("a página do 2º turno exige título, fase e marca", () => {
	assert.equal(htmlDoisTurno("Presidente 2026 · 2º turno", "pesquisas", true), true);
	assert.equal(htmlDoisTurno("Presidente 2026 · 2º turno", "", true), false);
	assert.equal(htmlDoisTurno("outro", "pesquisas", true), false);
});

test("diff da noite com a fase pesquisas não conta como noite exercitada", () => {
	assert.equal(noiteSemSuperficie(["src/pagina/ao-vivo.ts"], "pesquisas"), true);
	assert.equal(noiteSemSuperficie(["src/pagina/encerrada.ts"], "pesquisas"), true);
	assert.equal(noiteSemSuperficie(["src/pagina/geografia.ts"], "ao_vivo"), false);
	assert.equal(noiteSemSuperficie(["public/js/ao-vivo.js"], "pesquisas"), true);
	assert.equal(noiteSemSuperficie(["src/pagina/mapa.ts"], "pesquisas"), true);
	assert.equal(noiteSemSuperficie(["public/js/mapa.js"], "pesquisas"), true);
	assert.equal(noiteSemSuperficie(["src/pagina/grafico.ts"], "pesquisas"), false);
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

test("arquivo de imagem não esconde a página", () => {
	assert.deepEqual(alvosDaProva(["src/pesquisas/pesquisas.ts", "routes/og.png.ts"]), [
		{ url: "/", motivo: "sem-pagina-no-diff" },
		{ url: "/og.png", motivo: "diff" },
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
