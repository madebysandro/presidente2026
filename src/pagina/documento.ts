import { escHtml } from "../dominio/texto";
import type { EstadoApuracao } from "../dominio/tipos";
import type { PayloadPesquisas } from "../pesquisas/tipos";
import {
	htmlCaboApuracao,
	htmlFaixa,
	htmlGraficoNoite,
	htmlMomentos,
	htmlPesquisasNoite,
	htmlPlacar,
	type HistoricoNoite,
	type VistaNoite,
} from "./ao-vivo";
import { htmlAnaliseFinal, htmlPesquisasUrnas } from "./encerrada";
import { htmlGeografiaCheia, htmlGeografiaLateral } from "./geografia";
import { htmlMapaBrasil } from "./mapa";
import { dadosAbertura } from "./abertura";
import { htmlCalendario } from "./calendario";
import { htmlComoCalculamos, htmlRodape, htmlVantagem } from "./grafico";
import { htmlMetasPrevia, ORIGEM_PREVIA } from "./previa";
import { htmlTopo } from "./topo";

export type NoiteDaPagina = {
	apuracao: EstadoApuracao;
	historico: HistoricoNoite;
};

function vistaDe(payload: PayloadPesquisas, agora: Date, noite?: NoiteDaPagina): VistaNoite {
	const apuracao: EstadoApuracao = noite?.apuracao ?? {
		versao: 0,
		consultadoEm: null,
		proximaConsulta: null,
		erro: null,
		fase: payload.fase,
		cargos: {},
	};
	return {
		fase: apuracao.fase ?? payload.fase,
		agora,
		pesquisas: payload,
		apuracao,
		historico: noite?.historico ?? [],
	};
}

function htmlMiolo(vista: VistaNoite): string {
	if (vista.fase === "pesquisas") {
		return `${htmlTopo(vista.pesquisas, vista.agora)}${htmlCalendario(vista.pesquisas, vista.agora)}${htmlVantagem(vista.pesquisas)}${htmlComoCalculamos()}${htmlRodape()}`;
	}
	const esquerda = `${htmlGraficoNoite(vista)}${htmlAnaliseFinal(vista)}${htmlMomentos(vista)}`;
	const direita = `${htmlPesquisasNoite(vista)}${htmlPesquisasUrnas(vista)}${htmlGeografiaLateral(vista)}`;
	return `<header class="a-topo"><p class="a-marca">Presidente 2026, 2º turno</p>${htmlPlacar(vista)}${htmlCaboApuracao(vista)}</header>${htmlMapaBrasil(vista)}<div class="a-noite-grade"><div class="a-noite-esq">${esquerda}<!--/esq--></div><div class="a-noite-dir">${direita}<!--/dir--></div></div>${htmlGeografiaCheia(vista)}${htmlCalendario(vista.pesquisas, vista.agora, { encolher: true })}${htmlComoCalculamos()}${htmlRodape()}`;
}

export function fragmentoPagina(payload: PayloadPesquisas, agora: Date, noite?: NoiteDaPagina) {
	const vista = vistaDe(payload, agora, noite);
	return {
		fase: vista.fase,
		versao: vista.apuracao.versao,
		faixa: htmlFaixa(vista),
		miolo: htmlMiolo(vista),
	};
}

export function documentoPesquisas(
	payload: PayloadPesquisas,
	agora: Date,
	noite?: NoiteDaPagina,
	origem = ORIGEM_PREVIA,
): string {
	const vista = vistaDe(payload, agora, noite);
	const abertura = escHtml(JSON.stringify(dadosAbertura(vista.pesquisas)));
	return `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Presidente 2026 · 2º turno</title>
${htmlMetasPrevia(vista.pesquisas, agora, origem)}
<link rel="icon" href="/favicon.svg" type="image/svg+xml">
<link rel="stylesheet" href="/css/tres-semanas.css">
</head>
<body>
<main class="a" data-abertura="${abertura}" data-fase="${escHtml(vista.fase)}" data-versao="${vista.apuracao.versao}">
${htmlFaixa(vista)}
<div data-miolo>
${htmlMiolo(vista)}
</div>
</main>
<script src="/js/relogio.js" defer></script>
<script src="/js/calendario.js" defer></script>
<script type="module" src="/js/grafico.js"></script>
<script src="/js/movimento.js" defer></script>
<script src="/js/ao-vivo.js" defer></script>
<script type="module" src="/js/mapa.js"></script>
<script defer src="https://static.cloudflareinsights.com/beacon.min.js" data-cf-beacon='{"token": "aef83da97b4846a5ae996d5d11524a11"}'></script>
</body>
</html>`;
}
