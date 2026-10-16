import { escHtml } from "../dominio/texto";
import { arred1, arred2 } from "../pesquisas/validos";
import { arquivoZerado, vencedorPorVotos, type VistaNoite } from "./ao-vivo";
import { FLAVIO, LULA, porExtenso } from "./topo";

const p1 = new Intl.NumberFormat("pt-BR", {
	minimumFractionDigits: 1,
	maximumFractionDigits: 1,
});

function pct1(n: number): string {
	return `${p1.format(arred1(n))}%`;
}

function linhaFinal(rotulo: string, agora: number, primeiro: number): string {
	return `<li><b>${rotulo}</b> ${pct1(agora)} · 1º turno ${pct1(primeiro)}</li>`;
}

function textoErro(erro: number): string {
	const mostrado = arred1(erro);
	const abs = p1.format(Math.abs(mostrado));
	if (mostrado > 0) return `+${abs} p.p.`;
	if (mostrado < 0) return `−${abs} p.p.`;
	return `${abs} p.p.`;
}

function candidato(vista: VistaNoite, numero: string) {
	return vista.apuracao.cargos.presidente?.candidatos.find((c) => c.n === numero);
}

function liderDaVantagem(vantagem: number): "22" | "13" | null {
	if (vantagem > 0) return "22";
	if (vantagem < 0) return "13";
	return null;
}

type LinhaUrna = {
	instituto: string;
	erro: number;
	acertou: boolean;
	media: boolean;
};

function linhasDaMedia(vista: VistaNoite): LinhaUrna[] | null {
	const media = vista.pesquisas.media;
	const cargo = vista.apuracao.cargos.presidente;
	if (!media || !cargo || arquivoZerado(vista.apuracao)) return null;
	const flavio = candidato(vista, FLAVIO.numero);
	const lula = candidato(vista, LULA.numero);
	if (!flavio || !lula) return null;
	if (![flavio.pct, lula.pct, flavio.votos, lula.votos].every(Number.isFinite)) return null;
	const vUrna = arred2(flavio.pct - lula.pct);
	const vencedor = vencedorPorVotos(flavio.votos, lula.votos);
	const porRegistro = new Map(vista.pesquisas.publicadas.map((p) => [p.registro, p]));
	const linhas: LinhaUrna[] = [];
	for (const registro of media.registros) {
		const pesquisa = porRegistro.get(registro);
		if (!pesquisa || !Number.isFinite(pesquisa.v)) continue;
		linhas.push(linhaDe(pesquisa.instituto, pesquisa.v - vUrna, pesquisa.v, vencedor, false));
	}
	if (!linhas.length || !Number.isFinite(media.v)) return null;
	linhas.sort(
		(a, b) => Math.abs(a.erro) - Math.abs(b.erro) || a.instituto.localeCompare(b.instituto, "pt-BR"),
	);
	linhas.push(linhaDe("Média", media.v - vUrna, media.v, vencedor, true));
	return linhas;
}

function linhaDe(
	instituto: string,
	erro: number,
	vantagem: number,
	vencedor: "22" | "13" | null,
	media: boolean,
): LinhaUrna {
	const lider = liderDaVantagem(vantagem);
	return {
		instituto,
		erro,
		acertou: lider != null && lider === vencedor,
		media,
	};
}

function itemUrna(linha: LinhaUrna): string {
	const frase = linha.acertou ? "acertou o vencedor" : "não acertou o vencedor";
	const marca = linha.media
		? `data-linha="media"`
		: `data-instituto="${escHtml(linha.instituto)}"`;
	return `<li ${marca} data-acertou="${linha.acertou ? "1" : "0"}"><b>${escHtml(linha.instituto)}</b> <span data-erro>${textoErro(linha.erro)}</span> ${frase}</li>`;
}

export function htmlAnaliseFinal(vista: VistaNoite): string {
	if (vista.fase !== "encerrada") return "";
	const fechamento = vista.apuracao.analise?.fechamento;
	if (!fechamento) {
		return `<section class="a-est" data-analise-final><h2>Análise final</h2><p>A análise final entra com o resultado da apuração.</p></section>`;
	}
	return `<section class="a-est" data-analise-final><h2>Análise final</h2><ul>${linhaFinal("Comparecimento", fechamento.comparecimento, fechamento.comparecimento1t)}${linhaFinal("Brancos", fechamento.brancos, fechamento.brancos1t)}${linhaFinal("Nulos", fechamento.nulos, fechamento.nulos1t)}<li><b>Viradas na noite</b> <span data-viradas>${fechamento.viradas}</span></li></ul></section>`;
}

export function htmlPesquisasUrnas(vista: VistaNoite): string {
	if (vista.fase !== "encerrada") return "";
	const linhas = linhasDaMedia(vista);
	const data = vista.pesquisas.media?.data;
	if (!linhas || !data) {
		return `<section class="a-est" data-pesquisas-urnas><h2>Pesquisas × urnas</h2><p>A comparação entra quando a média final e o resultado das urnas estiverem publicados.</p></section>`;
	}
	return `<section class="a-est" data-pesquisas-urnas><h2>Pesquisas × urnas</h2><p>Erro na vantagem de Flávio: pesquisa menos urna. A média final está congelada em ${escHtml(porExtenso(data))}.</p><ul>${linhas.map(itemUrna).join("")}</ul></section>`;
}
