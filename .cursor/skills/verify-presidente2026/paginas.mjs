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
];

const AMBAS = ["src/pagina/previa.ts"];

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
