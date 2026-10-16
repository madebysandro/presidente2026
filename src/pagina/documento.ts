import { htmlTopo } from "./topo";
import type { PayloadPesquisas } from "../pesquisas/tipos";

export function documentoPesquisas(payload: PayloadPesquisas, agora: Date): string {
	return `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Presidente 2026 · 2º turno</title>
<link rel="icon" href="/favicon.svg" type="image/svg+xml">
<link rel="stylesheet" href="/css/tres-semanas.css">
</head>
<body>
<main class="a">
${htmlTopo(payload, agora)}
</main>
<script src="/js/relogio.js" defer></script>
</body>
</html>`;
}
