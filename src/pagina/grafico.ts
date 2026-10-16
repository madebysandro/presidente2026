import { escHtml, nf } from "../dominio/texto";
import type { PayloadPesquisas, PesquisaPublicada, PontoSerieMedia } from "../pesquisas/tipos";

const PAD_X = 6;
const PAD_Y = 10;

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

function tituloPonto(pesquisa: PesquisaPublicada): string {
	return `${pesquisa.instituto}, campo até ${ddmm(pesquisa.campoFim)}: Flávio ${p1.format(pesquisa.vf)}%, Lula ${p1.format(pesquisa.vl)}%. ${textoFicha(pesquisa)}`;
}

function rotuloMedia(ponto: PontoSerieMedia): string {
	const lider = ponto.v >= 0 ? "Flávio" : "Lula";
	return `média ${lider} +${p1.format(Math.abs(ponto.v))}`;
}

export function htmlVantagem(
	payload: PayloadPesquisas,
	desligados: ReadonlySet<string> = new Set(),
): string {
	const ordenadas = porCampo(payload.publicadas);
	const desligado = (cnpj: string) => (desligados.has(cnpj) ? " off" : "");
	const intro = `<section class="a-tend" aria-labelledby="a-tend-titulo"><h2 id="a-tend-titulo">A vantagem, dia a dia</h2><p>Pontos são pesquisas; a linha é a média. Toque num instituto para tirá-lo do gráfico.</p>`;
	if (!ordenadas.length) {
		return `${intro}<p class="a-graf-vazio">Ainda não há pesquisas publicadas neste gráfico.</p></section>`;
	}

	const serie = [...payload.serieMedia].sort((a, b) => a.data.localeCompare(b.data));
	const dias = [...ordenadas.map((p) => p.campoFim), ...serie.map((s) => s.data), payload.hoje];
	const minIso = dias.reduce((a, b) => (a < b ? a : b));
	const maxIso = dias.reduce((a, b) => (a > b ? a : b));
	const x0 = diaNumero(minIso) - 1;
	const x1 = diaNumero(maxIso) + 1;
	const pico = Math.max(
		6,
		...ordenadas.map((p) => Math.abs(p.v)),
		...serie.map((s) => Math.abs(s.v)),
	);
	const lim = Math.ceil(pico / 2) * 2;
	const px = (iso: string) =>
		PAD_X + ((diaNumero(iso) - x0) / (x1 - x0)) * (100 - 2 * PAD_X);
	const py = (v: number) => PAD_Y + (1 - (v + lim) / (2 * lim)) * (100 - 2 * PAD_Y);

	const nomes = new Map<string, string>();
	const porInst = new Map<string, PesquisaPublicada[]>();
	for (const pesquisa of ordenadas) {
		if (!nomes.has(pesquisa.cnpj)) nomes.set(pesquisa.cnpj, pesquisa.instituto);
		const grupo = porInst.get(pesquisa.cnpj) ?? [];
		grupo.push(pesquisa);
		porInst.set(pesquisa.cnpj, grupo);
	}

	const linhas = [...porInst.values()]
		.filter((grupo) => grupo.length > 1)
		.map((grupo) => {
			const d = grupo
				.map((pesquisa, i) => {
					const cmd = i === 0 ? "M" : "L";
					return `${cmd}${n2(px(pesquisa.campoFim))},${n2(py(pesquisa.v))}`;
				})
				.join("");
			const cnpj = grupo[0]!.cnpj;
			return `<path class="t-inst${desligado(cnpj)}" data-cnpj="${escHtml(cnpj)}" d="${d}" fill="none" stroke-width="1" vector-effect="non-scaling-stroke"/>`;
		})
		.join("");

	const dMedia = serie
		.map((ponto, i) => `${i === 0 ? "M" : "L"}${n2(px(ponto.data))},${n2(py(ponto.v))}`)
		.join("");
	const media = serie.length
		? `<path class="t-media" data-datas="${escHtml(serie.map((ponto) => ponto.data).join(" "))}" d="${dMedia}" fill="none" stroke-width="3" stroke-linejoin="round" stroke-linecap="round" vector-effect="non-scaling-stroke"/>`
		: "";
	const ultimo = serie.at(-1);
	const rotulo = ultimo
		? `<span class="t-rot" style="left:${n2(px(ultimo.data))}%;top:${n2(py(ultimo.v))}%;transform:${px(ultimo.data) > 50 ? "translate(calc(-100% - 8px), -100%)" : "translate(8px, -100%)"}">${escHtml(rotuloMedia(ultimo))}</span>`
		: "";

	const passo = Math.max(1, Math.ceil((x1 - x0) / 4));
	const eixoX: string[] = [];
	for (let dia = x0 + 1; dia <= x1; dia += passo) {
		const iso = isoDe(dia);
		eixoX.push(`<span style="left:${n2(px(iso))}%">${ddmm(iso)}</span>`);
	}

	const pontos = ordenadas
		.map((pesquisa, ordem) => {
			const lado = pesquisa.v >= 0 ? "lado-f" : "lado-l";
			const x = n2(px(pesquisa.campoFim));
			const y = n2(py(pesquisa.v));
			return `<span class="t-pt ${lado}${desligado(pesquisa.cnpj)}" data-registro="${escHtml(pesquisa.registro)}" data-cnpj="${escHtml(pesquisa.cnpj)}" data-ordem="${ordem}" data-x="${x}" data-y="${y}" style="left:${x}%;top:${y}%" title="${escHtml(tituloPonto(pesquisa))}"></span>`;
		})
		.join("");

	const chips = [...nomes]
		.map(
			([cnpj, nome]) =>
				`<button type="button" data-cnpj="${escHtml(cnpj)}" aria-pressed="${desligados.has(cnpj) ? "false" : "true"}">${escHtml(nome)}</button>`,
		)
		.join("");

	const yZero = n2(py(0));
	const yTopo = n2(py(lim));
	const yBase = n2(py(-lim));
	const xHoje = n2(px(payload.hoje));

	return `${intro}<div class="a-chips" role="group" aria-label="Institutos no gráfico">${chips}</div><div class="a-graf"><div class="a-plot" role="img" aria-label="Vantagem de Flávio sobre Lula nas pesquisas, em pontos dos votos válidos"><svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true"><line class="t-zero" x1="0" x2="100" y1="${yZero}" y2="${yZero}" vector-effect="non-scaling-stroke"/><line class="t-hoje-linha" x1="${xHoje}" x2="${xHoje}" y1="0" y2="100" stroke-dasharray="2 3" vector-effect="non-scaling-stroke"/>${linhas}${media}</svg><span class="t-hoje" style="left:${xHoje}%">hoje</span>${pontos}${rotulo}</div><div class="a-eixo-y" aria-hidden="true"><span class="a-eixo-medida">Flávio +${lim}</span><span style="top:${yTopo}%">Flávio +${lim}</span><span style="top:${yZero}%">empate</span><span style="top:${yBase}%">Lula +${lim}</span></div><div class="a-eixo-x" aria-hidden="true">${eixoX.join("")}</div></div></section>`;
}

export function htmlComoCalculamos(): string {
	return `<section class="a-calc" aria-labelledby="a-calc-titulo"><h2 id="a-calc-titulo">Como calculamos</h2><p>Usamos a última pesquisa de cada instituto com entrevistas nos últimos 14 dias e tiramos a média simples dos votos válidos, calculados a partir dos votos totais. Pesquisa mede o momento em que foi feita; não prevê o resultado.</p></section>`;
}

export function htmlRodape(): string {
	return `<footer class="a-rodape"><p>Fonte: Tribunal Superior Eleitoral. O registro das pesquisas está nos <a href="${URL_DADOS_ABERTOS}">dados abertos</a> e no <a href="${URL_PESQELE}">PesqEle</a>.</p></footer>`;
}
