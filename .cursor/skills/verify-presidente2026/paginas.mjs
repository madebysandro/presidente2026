export const LARGURAS = [390, 1280];

const PAGINA = [
	"routes/index.ts",
	"public/favicon.svg",
];

const PREFIXO_PAGINA = ["src/pagina/", "public/css/", "public/js/"];

const OG = [
	"routes/og.png.ts",
	"src/pagina/og-codec.ts",
	"src/pagina/previa-png.ts",
	"src/pagina/previa-png-media.ts",
	"src/pagina/gerar-base.ts",
];

const AMBAS = ["src/pagina/previa.ts"];

const NOITE = ["src/pagina/ao-vivo.ts", "src/pagina/encerrada.ts", "src/pagina/geografia.ts"];

export function htmlDoisTurno(titulo, fase, temMarca) {
	return titulo === "Presidente 2026 · 2º turno" && fase.length > 0 && temMarca;
}

export function noiteSemSuperficie(arquivos, fase) {
	return fase === "pesquisas" && arquivos.map(normalizar).some((arquivo) => NOITE.includes(arquivo));
}

function normalizar(arquivo) {
	return arquivo.replaceAll("\\", "/").replace(/^\.\//, "");
}

function casa(arquivo, nomes, prefixos = []) {
	return nomes.includes(arquivo) || prefixos.some((prefixo) => arquivo.startsWith(prefixo));
}

export function paginasDoDiff(arquivos) {
	const lista = arquivos.map(normalizar);
	const urls = [];
	const pagina = lista.some(
		(arquivo) =>
			AMBAS.includes(arquivo) ||
			(casa(arquivo, PAGINA, PREFIXO_PAGINA) && !OG.includes(arquivo)),
	);
	const og = lista.some((arquivo) => OG.includes(arquivo) || AMBAS.includes(arquivo));
	if (pagina) urls.push("/");
	if (og) urls.push("/og.png");
	return urls;
}

export function alvosDaProva(arquivos) {
	const urls = paginasDoDiff(arquivos);
	if (urls.length === 0) return [{ url: "/", motivo: "sem-pagina-no-diff" }];
	return urls.map((url) => ({ url, motivo: "diff" }));
}
