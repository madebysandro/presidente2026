import { contaUfs, descreverUf } from "../../public/js/mapa-tom.mjs";
import { NOMES_UF } from "../config/ufs";
import { escHtml } from "../dominio/texto";
import type { VistaNoite } from "./ao-vivo";
import { GEOMETRIA_UF } from "./mapa-geometria";

/** UFs pequenas demais para o rótulo dentro: ele vai para fora, com uma guia. */
const ROTULO_FORA: Record<string, readonly [number, number]> = {
	rn: [1010, 262],
	pb: [1010, 302],
	pe: [1010, 342],
	al: [1010, 382],
	se: [1010, 422],
	es: [905, 624],
	rj: [850, 712],
	df: [700, 470],
};

const SIGLAS = Object.keys(GEOMETRIA_UF);

function dadosAttr(dados: Record<string, string>): string {
	return Object.entries(dados)
		.map(([chave, valor]) => ` data-${chave.replace(/[A-Z]/g, (m) => `-${m.toLowerCase()}`)}="${escHtml(valor)}"`)
		.join("");
}

/** As 27 UFs na cor de quem lidera; o exterior fica de fora. O mapa.js atualiza a cada leitura do poller. */
export function htmlMapaBrasil(vista: VistaNoite): string {
	const ufs = vista.apuracao.ufs ?? {};
	const caminhos: string[] = [];
	const guias: string[] = [];
	const rotulos: string[] = [];
	for (const sigla of SIGLAS) {
		const geo = GEOMETRIA_UF[sigla]!;
		const nome = NOMES_UF[sigla] ?? sigla.toUpperCase();
		const uf = descreverUf(nome, ufs[sigla]);
		const estilo = uf.estilo ? ` style="${uf.estilo}"` : "";
		caminhos.push(
			`<path class="a-br-uf ${uf.classe}" data-uf="${sigla}" data-nome="${escHtml(nome)}"${estilo} tabindex="0" aria-label="${escHtml(uf.aria)}"${dadosAttr(uf.dados)} d="${geo.d}"/>`,
		);
		const [cx, cy] = geo.c;
		const fora = ROTULO_FORA[sigla];
		const [x, y] = fora ?? [cx, cy];
		if (fora) guias.push(`<line x1="${cx}" y1="${cy}" x2="${x - 6}" y2="${y - 6}"/>`);
		const classe = `a-br-rot${fora ? " a-br-fora" : ""}${uf.claro ? " a-br-claro" : ""}${uf.lado == null ? " a-br-rot-vazio" : ""}`;
		rotulos.push(
			`<text class="${classe}" data-rotulo="${sigla}" x="${x}" y="${y}"><tspan class="a-br-s" x="${x}">${sigla.toUpperCase()}</tspan><tspan class="a-br-p" x="${x}" dy="1.1em">${uf.rotulo}</tspan></text>`,
		);
	}
	const svg = `<svg class="a-br-svg" viewBox="-10 -10 1150 1010" role="group" aria-label="Mapa do Brasil com a cor de quem lidera em cada estado"><defs><pattern id="a-br-hach" width="8" height="8" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect class="a-br-hach-fundo" width="8" height="8"/><line class="a-br-hach-traco" x1="0" y1="0" x2="0" y2="8"/></pattern></defs><g class="a-br-ufs">${caminhos.join("")}</g><g class="a-br-guias" aria-hidden="true">${guias.join("")}</g><g class="a-br-rotulos" aria-hidden="true">${rotulos.join("")}</g></svg>`;
	const chips = [...SIGLAS].sort().map((sigla) => {
		const uf = descreverUf(NOMES_UF[sigla] ?? sigla.toUpperCase(), ufs[sigla]);
		return `<button type="button" class="a-br-chip" data-uf-chip="${sigla}" data-lado="${uf.lado ?? ""}" aria-pressed="false" aria-label="${escHtml(uf.aria)}">${sigla.toUpperCase()}</button>`;
	});
	const listaChips = `<div class="a-br-chips" role="group" aria-label="Escolha um estado">${chips.join("")}</div>`;
	const conta = contaUfs(ufs, SIGLAS);
	const placar = `<div class="a-br-conta"><div class="a-br-conta-l"><strong data-mapa-n="l">${conta.l}</strong><span>estados Lula</span></div><div class="a-br-conta-f"><strong data-mapa-n="f">${conta.f}</strong><span>estados Flávio</span></div></div>`;
	const detalhe = `<div class="a-br-det" data-mapa-det aria-live="polite"><span>Toque num estado para ver votos e seções apuradas.</span></div>`;
	const legenda = `<p class="a-br-leg"><span><i class="a-br-cor-l"></i>Lula lidera</span><span><i class="a-br-cor-f"></i>Flávio lidera</span><span><i class="a-br-cor-vazio"></i>Sem seções apuradas</span><small>Contornos: <a href="https://github.com/codeforgermany/click_that_hood">click_that_hood</a> (MIT)</small></p>`;
	return `<section class="a-geo a-br" data-mapa-br aria-labelledby="a-br-titulo"><h2 id="a-br-titulo">Apuração por estado</h2><p>Cada estado na cor de quem lidera; tom mais forte, vantagem maior. Toque num estado<span class="a-br-so-mouse"> ou passe o mouse</span> para ver os números.</p><div class="a-br-quadro">${svg}</div>${listaChips}<aside class="a-br-lado">${placar}${detalhe}${legenda}</aside></section>`;
}
