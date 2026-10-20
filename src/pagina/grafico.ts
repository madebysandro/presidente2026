import { escHtml, nf } from "../dominio/texto";
import { serieIntencaoDe, type PontoSerieIntencao } from "../pesquisas/media";
import type { PayloadPesquisas, PesquisaPublicada } from "../pesquisas/tipos";

const Y_LO = 44;
const Y_HI = 56;
const FOLGA_ROTULO = 7.2;

const p1 = new Intl.NumberFormat("pt-BR", {
	minimumFractionDigits: 1,
	maximumFractionDigits: 1,
});

const n1 = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 1 });

export const URL_DADOS_ABERTOS =
	"https://dadosabertos.tse.jus.br/dataset/pesquisas-eleitorais-2026";

export const URL_PESQELE =
	"https://pesqele-divulgacao.tse.jus.br/app/pesquisa/listar.xhtml";

function diaNumero(iso: string): number {
	const [ano, mes, dia] = iso.split("-").map(Number) as [number, number, number];
	return Date.UTC(ano, mes - 1, dia) / 86_400_000;
}

function isoDe(dia: number): string {
	return new Date(dia * 86_400_000).toISOString().slice(0, 10);
}

function somarDias(iso: string, dias: number): string {
	return isoDe(diaNumero(iso) + dias);
}

function ddmm(iso: string): string {
	return `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;
}

function n2(n: number): string {
	return (Math.round(n * 100) / 100).toFixed(2);
}

function porCampo(lista: readonly PesquisaPublicada[]): PesquisaPublicada[] {
	return [...lista].sort(
		(a, b) => a.campoFim.localeCompare(b.campoFim) || a.registro.localeCompare(b.registro),
	);
}

function textoPontos(margem: number): string {
	return `${n1.format(margem)} ponto${margem === 1 ? "" : "s"}`;
}

function textoContratantes(nomes: readonly string[]): string {
	if (nomes.includes("recursos próprios")) return "Feita com recursos próprios";
	return `Contratada por ${nomes.join(" e ")}`;
}

/** Ficha curta para o tooltip do ponto. Sem HTML. */
export function textoFicha(pesquisa: PesquisaPublicada): string {
	return `${pesquisa.instituto} ouviu ${nf.format(pesquisa.entrevistas)} eleitores de ${ddmm(pesquisa.campoInicio)} a ${ddmm(pesquisa.campoFim)}; margem de erro de ${textoPontos(pesquisa.margem)}, confiança de ${n1.format(pesquisa.confianca)}%. ${textoContratantes(pesquisa.contratantes)}. Registro no TSE ${pesquisa.registro}.`;
}

function textoPonto(pesquisa: PesquisaPublicada): string {
	return `${pesquisa.instituto}, ${ddmm(pesquisa.campoFim)}. Flávio ${p1.format(pesquisa.vf)}%. Lula ${p1.format(pesquisa.vl)}%. Margem ±${p1.format(pesquisa.margem)}.`;
}

type JanelaY = { y0: number; y1: number; ticks: number[] };

function janelaY(valores: readonly number[]): JanelaY {
	let lo = Y_LO;
	let hi = Y_HI;
	for (const valor of valores) {
		if (!Number.isFinite(valor)) continue;
		while (valor < lo - 1) lo -= 2;
		while (valor > hi + 1) hi += 2;
	}
	const ticks: number[] = [];
	for (let marca = lo; marca <= hi; marca += 2) ticks.push(marca);
	return { y0: lo - 1, y1: hi + 1, ticks };
}

function extremos(pesquisas: readonly PesquisaPublicada[], serie: readonly PontoSerieIntencao[]): number[] {
	const valores: number[] = [];
	for (const pesquisa of pesquisas) valores.push(pesquisa.vf, pesquisa.vl);
	for (const ponto of serie) {
		valores.push(
			ponto.vf + ponto.margem,
			ponto.vf - ponto.margem,
			ponto.vl + ponto.margem,
			ponto.vl - ponto.margem,
		);
	}
	return valores;
}

function jsonSeguro(valor: unknown): string {
	return JSON.stringify(valor).replaceAll("<", "\\u003c");
}

export function htmlVantagem(
	payload: PayloadPesquisas,
	desligados: ReadonlySet<string> = new Set(),
): string {
	const ordenadas = porCampo(payload.publicadas);
	const intro = `<section class="a-tend" aria-labelledby="a-tend-titulo"><h2 id="a-tend-titulo">Lula × Flávio, pesquisa a pesquisa</h2><p>% dos votos válidos. Ponto = pesquisa; linha = média (última pesquisa de cada instituto nos últimos 14 dias); faixa = margem de erro média.</p>`;
	if (!ordenadas.length) {
		return `${intro}<p class="a-graf-vazio">Ainda não há pesquisas publicadas neste gráfico.</p></section>`;
	}

	const visiveis = ordenadas.filter((pesquisa) => !desligados.has(pesquisa.cnpj));
	const serie = serieIntencaoDe(visiveis, payload.hoje);
	const primeira = ordenadas[0]!.campoFim;
	const x0 = somarDias(primeira, -2);
	const x1 = somarDias(payload.hoje, 2);
	const janela = janelaY(extremos(visiveis, serie));
	const span = diaNumero(x1) - diaNumero(x0);
	const px = (iso: string) => ((diaNumero(iso) - diaNumero(x0)) / span) * 100;
	const py = (valor: number) => ((janela.y1 - valor) / (janela.y1 - janela.y0)) * 100;

	const nomes = new Map<string, string>();
	for (const pesquisa of ordenadas) {
		if (!nomes.has(pesquisa.cnpj)) nomes.set(pesquisa.cnpj, pesquisa.instituto);
	}
	const chips = [...nomes.entries()]
		.sort((a, b) => a[1].localeCompare(b[1], "pt-BR"))
		.map(
			([cnpj, nome]) =>
				`<button type="button" data-cnpj="${escHtml(cnpj)}" aria-pressed="${desligados.has(cnpj) ? "false" : "true"}">${escHtml(nome)}</button>`,
		)
		.join("");

	const grades = janela.ticks
		.map((marca) => {
			const classe = marca === 50 ? "t-cinq" : "t-grade";
			return `<span class="${classe}" style="top:${n2(py(marca))}%"></span>`;
		})
		.join("");

	const faixa = (chave: "vf" | "vl", lado: "f" | "l") => {
		if (!serie.length) return "";
		const cima = serie.map(
			(ponto) => `${n2(px(ponto.data))},${n2(py(ponto[chave] + ponto.margem))}`,
		);
		const baixo = [...serie]
			.reverse()
			.map((ponto) => `${n2(px(ponto.data))},${n2(py(ponto[chave] - ponto.margem))}`);
		return `<polygon class="t-faixa t-faixa-${lado}" points="${cima.concat(baixo).join(" ")}"/>`;
	};

	const linha = (chave: "vf" | "vl", lado: "f" | "l") => {
		if (!serie.length) return "";
		const pontos = serie.map((ponto) => `${n2(px(ponto.data))},${n2(py(ponto[chave]))}`).join(" ");
		const datas = serie.map((ponto) => ponto.data).join(" ");
		const valores = serie.map((ponto) => ponto[chave]).join(" ");
		return `<polyline class="t-media t-media-${lado}" data-datas="${escHtml(datas)}" data-${chave}="${escHtml(valores)}" points="${pontos}" fill="none" stroke-width="3.5" stroke-linejoin="round" stroke-linecap="round" vector-effect="non-scaling-stroke"/>`;
	};

	const xHoje = n2(px(payload.hoje));
	const pontos = visiveis
		.map((pesquisa, ordem) => {
			const x = n2(px(pesquisa.campoFim));
			const quando = ddmm(pesquisa.campoFim);
			const rotulo = escHtml(textoPonto(pesquisa));
			const comum = `data-registro="${escHtml(pesquisa.registro)}" data-cnpj="${escHtml(pesquisa.cnpj)}" data-instituto="${escHtml(pesquisa.instituto)}" data-quando="${quando}" data-vf="${pesquisa.vf}" data-vl="${pesquisa.vl}" data-margem="${pesquisa.margem}" data-ordem="${ordem}"`;
			return (["f", "l"] as const)
				.map((lado) => {
					const valor = lado === "f" ? pesquisa.vf : pesquisa.vl;
					const y = n2(py(valor));
					return `<span class="t-pt lado-${lado}" ${comum} data-x="${x}" data-y="${y}" style="left:${x}%;top:${y}%" role="button" tabindex="0" aria-label="${rotulo}"></span>`;
				})
				.join("");
		})
		.join("");

	const ultimo = serie.at(-1);
	let rotulos = "";
	if (ultimo) {
		let topoF = py(ultimo.vf);
		let topoL = py(ultimo.vl);
		if (Math.abs(topoL - topoF) < FOLGA_ROTULO) {
			const meio = (topoF + topoL) / 2;
			const sinal = topoL >= topoF ? 1 : -1;
			topoF = meio - sinal * (FOLGA_ROTULO / 2);
			topoL = meio + sinal * (FOLGA_ROTULO / 2);
		}
		rotulos = `<span class="t-rot t-rot-f" style="left:${xHoje}%;top:${n2(topoF)}%">Flávio ${p1.format(ultimo.vf)}%</span><span class="t-rot t-rot-l" style="left:${xHoje}%;top:${n2(topoL)}%">Lula ${p1.format(ultimo.vl)}%</span>`;
	}

	const datasEixo: string[] = [];
	for (let dia = diaNumero(x0), i = 0; dia <= diaNumero(x1); dia += 2, i++) {
		const miudo = i % 2 === 1 ? " t-dia-miudo" : "";
		datasEixo.push(
			`<span class="t-dia${miudo}" style="left:${n2(px(isoDe(dia)))}%">${ddmm(isoDe(dia))}</span>`,
		);
	}

	const eixoY = janela.ticks
		.map((marca) => `<span style="top:${n2(py(marca))}%">${marca}%</span>`)
		.join("");

	const aria = ultimo
		? `Intenção de voto em votos válidos. Flávio ${p1.format(ultimo.vf)}%, Lula ${p1.format(ultimo.vl)}%.`
		: "Intenção de voto em votos válidos.";

	const dados = jsonSeguro({
		hoje: payload.hoje,
		pesquisas: ordenadas.map((pesquisa) => ({
			registro: pesquisa.registro,
			cnpj: pesquisa.cnpj,
			instituto: pesquisa.instituto,
			campoFim: pesquisa.campoFim,
			margem: pesquisa.margem,
			flavio: pesquisa.totais.flavio,
			lula: pesquisa.totais.lula,
			vf: pesquisa.vf,
			vl: pesquisa.vl,
		})),
	});

	return `${intro}<div class="a-chips" role="group" aria-label="Institutos no gráfico">${chips}</div><div class="a-caixa"><div class="a-graf"><div class="a-plot"><div class="a-eixo-y" aria-hidden="true">${eixoY}</div><div class="a-escala"><div class="a-area" role="img" aria-label="${escHtml(aria)}"><div class="t-grades" aria-hidden="true">${grades}</div><svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">${faixa("vf", "f")}${faixa("vl", "l")}<line class="t-hoje-linha" x1="${xHoje}" x2="${xHoje}" y1="0" y2="100" vector-effect="non-scaling-stroke"/>${linha("vf", "f")}${linha("vl", "l")}</svg><span class="t-hoje" style="left:${xHoje}%">hoje</span>${pontos}${rotulos}</div><div class="a-eixo-x" aria-hidden="true">${datasEixo.join("")}</div></div></div></div><p class="a-graf-leg">Toque num ponto para ver os números. Toque num instituto para tirá-lo do gráfico.</p><p class="t-tip" hidden></p></div><script type="application/json" id="a-intencao-dados">${dados}</script></section>`;
}

export function htmlComoCalculamos(): string {
	return `<section class="a-calc" aria-labelledby="a-calc-titulo"><h2 id="a-calc-titulo">Como calculamos</h2><p>Usamos a última pesquisa de cada instituto com entrevistas nos últimos 14 dias e tiramos a média simples dos votos válidos, calculados a partir dos votos totais. Pesquisa mede o momento em que foi feita; não prevê o resultado.</p></section>`;
}

export function htmlRodape(): string {
	return `<footer class="a-rodape"><p>Fonte: Tribunal Superior Eleitoral. O registro das pesquisas está nos <a href="${URL_DADOS_ABERTOS}">dados abertos</a> e no <a href="${URL_PESQELE}">PesqEle</a>.</p></footer>`;
}
