import { ABERTURA_2T_MS, type FaseApuracao } from "../apuracao/abertura";
import { escHtml, nf, pf } from "../dominio/texto";
import type { EstadoApuracao, MomentoNoite, TendenciaCandidato } from "../dominio/tipos";
import type { PayloadPesquisas } from "../pesquisas/tipos";
import { FLAVIO, LULA, porExtenso } from "./topo";

const PAD = 8;

const p1 = new Intl.NumberFormat("pt-BR", {
	minimumFractionDigits: 1,
	maximumFractionDigits: 1,
});

/** O que o gráfico lê de cada leitura. Aceita o histórico que o RPC devolve. */
export type HistoricoNoite = ReadonlyArray<{
	c: {
		presidente?: {
			ap: number;
			c?: Record<string, readonly number[] | undefined>;
		};
	};
}>;

export type VistaNoite = {
	fase: FaseApuracao;
	agora: Date;
	pesquisas: PayloadPesquisas;
	apuracao: EstadoApuracao;
	historico: HistoricoNoite;
};

/** Relógio com que a página pede a média. Ao vivo, nunca antes de 25/10 17h. */
export function relogioDaPagina(fase: FaseApuracao, agora: Date): Date {
	if (fase === "pesquisas") return agora;
	if (agora.getTime() >= ABERTURA_2T_MS) return agora;
	return new Date(ABERTURA_2T_MS);
}

function n2(n: number): string {
	return (Math.round(n * 100) / 100).toFixed(2);
}

function nomeLado(n: string | undefined): string {
	if (n === FLAVIO.numero) return FLAVIO.nome;
	if (n === LULA.numero) return LULA.nome;
	return "sem nome";
}

function presidente(vista: VistaNoite) {
	return vista.apuracao.cargos.presidente;
}

export function arquivoZerado(apuracao: EstadoApuracao): boolean {
	const cargo = apuracao.cargos.presidente;
	if (!cargo || cargo.apurado !== 0) return false;
	const votos = cargo.candidatos.reduce(
		(soma, candidato) => soma + (Number.isFinite(candidato.votos) ? candidato.votos : 0),
		0,
	);
	return votos <= 0;
}

function horaTse(vista: VistaNoite): string {
	const hora = presidente(vista)?.hora ?? "";
	return /^\d{2}:\d{2}:\d{2}$/.test(hora) ? hora : "sem horário";
}

export function textoIdade(consultadoEm: number | null | undefined, agora: number): string {
	if (consultadoEm == null || !Number.isFinite(consultadoEm)) return "ainda sem leitura";
	const segundos = Math.max(0, Math.round((agora - consultadoEm) / 1000));
	if (segundos < 60) return "agora há pouco";
	return `há ${Math.floor(segundos / 60)} min`;
}

export function textoFaixaProxima(
	fase: FaseApuracao,
	proxima: number | null | undefined,
	agora: number,
): string {
	if (fase === "encerrada") return "Sem nova consulta";
	if (proxima == null || !Number.isFinite(proxima)) {
		return fase === "pesquisas" ? "Próxima consulta às 17h" : "Sem nova consulta";
	}
	const segundos = Math.max(0, Math.round((proxima - agora) / 1000));
	if (segundos >= 86_400) {
		const quando = new Intl.DateTimeFormat("pt-BR", {
			timeZone: "America/Sao_Paulo",
			day: "2-digit",
			month: "2-digit",
			hour: "2-digit",
			minute: "2-digit",
			hourCycle: "h23",
		}).format(new Date(proxima));
		return `Próxima consulta ${quando}`;
	}
	if (segundos >= 3_600) {
		const horas = Math.floor(segundos / 3_600);
		const min = Math.floor((segundos % 3_600) / 60);
		return `Próxima consulta em ${horas} h ${String(min).padStart(2, "0")} min`;
	}
	const min = Math.floor(segundos / 60);
	const seg = String(segundos % 60).padStart(2, "0");
	return `Próxima consulta em ${min} min ${seg} s`;
}

function rotuloFase(fase: FaseApuracao): string {
	if (fase === "ao_vivo") return "Ao vivo";
	if (fase === "encerrada") return "Encerrada";
	return "Aguardando 17h";
}

function attrNumero(nome: string, valor: number | null | undefined): string {
	if (valor == null || !Number.isFinite(valor)) return "";
	return ` ${nome}="${valor}"`;
}

export function htmlFaixa(vista: VistaNoite): string {
	const hora = horaTse(vista);
	const idade = textoIdade(vista.apuracao.consultadoEm, vista.agora.getTime());
	const proxima = textoFaixaProxima(
		vista.fase,
		vista.apuracao.proximaConsulta,
		vista.agora.getTime(),
	);
	const extra = arquivoZerado(vista.apuracao)
		? `<span data-faixa-extra>arquivo zerado</span>`
		: "";
	const carimbo =
		vista.fase === "encerrada"
			? `<span data-carimbo>Resultado final · 2º turno</span>`
			: "";
	return `<div class="a-faixa" data-faixa data-fase="${escHtml(vista.fase)}"${attrNumero("data-consultado", vista.apuracao.consultadoEm)}${attrNumero("data-proxima-em", vista.apuracao.proximaConsulta)} data-hora-tse="${escHtml(hora)}"><strong>${rotuloFase(vista.fase)}</strong>${carimbo}${extra}<span data-faixa-idade>Dados do TSE ${escHtml(hora)} · ${idade}</span><span data-faixa-proxima>${proxima}</span></div>`;
}

function rosto(lado: typeof FLAVIO | typeof LULA): string {
	return `<img class="a-rosto" data-numero="${lado.numero}" src="${lado.foto}" alt="" width="161" height="225">`;
}

function lado(numero: string, vista: VistaNoite) {
	return presidente(vista)?.candidatos.find((candidato) => candidato.n === numero);
}

function seloEleito(numero: string, vista: VistaNoite): string {
	if (vista.fase !== "encerrada") return "";
	const flavio = lado(FLAVIO.numero, vista);
	const lula = lado(LULA.numero, vista);
	if (!flavio || !lula) return "";
	if (!Number.isFinite(flavio.votos) || !Number.isFinite(lula.votos)) return "";
	const vencedor =
		flavio.votos > lula.votos ? FLAVIO.numero : lula.votos > flavio.votos ? LULA.numero : null;
	if (vencedor !== numero) return "";
	return `<span class="a-eleito" data-eleito="${numero}">✓ Eleito</span>`;
}

export function htmlPlacar(vista: VistaNoite): string {
	const cargo = presidente(vista);
	if (!cargo || arquivoZerado(vista.apuracao)) {
		return `<div class="a-veredito a-placar"><h1>A apuração ainda não tem votos</h1><p>O arquivo zerado do TSE ainda não trouxe votos.</p></div>`;
	}
	const flavio = lado(FLAVIO.numero, vista);
	const lula = lado(LULA.numero, vista);
	const pct = (n: number | undefined) => (n != null && Number.isFinite(n) ? pf.format(n) : "—");
	const votos = (n: number | undefined) => (n != null && Number.isFinite(n) ? nf.format(n) : "—");
	const secoes = Number.isFinite(cargo.apurado) ? pf.format(cargo.apurado) : "—";
	return `<div class="a-veredito a-placar"><h1><span class="a-f">${rosto(FLAVIO)}${FLAVIO.nome} <b>${pct(flavio?.pct)}%</b>${seloEleito(FLAVIO.numero, vista)}</span> <span class="a-x">a</span> <span class="a-l">${rosto(LULA)}${LULA.nome} <b>${pct(lula?.pct)}%</b>${seloEleito(LULA.numero, vista)}</span></h1><p>${votos(flavio?.votos)} a ${votos(lula?.votos)} votos válidos · ${secoes}% das seções apuradas</p></div>`;
}

export function htmlCaboApuracao(vista: VistaNoite): string {
	const flavio = lado(FLAVIO.numero, vista);
	const lula = lado(LULA.numero, vista);
	const media = vista.pesquisas.media;
	const zerado = !presidente(vista) || arquivoZerado(vista.apuracao);
	const largura =
		!zerado && flavio && Number.isFinite(flavio.pct) ? n2(flavio.pct) : "";
	const barra = largura
		? `<i class="a-cabo-f" style="width:${largura}%"></i>`
		: "";
	const marca = media && Number.isFinite(media.vf)
		? `<i class="a-cabo-media" style="left:${n2(media.vf)}%" title="média das pesquisas"></i>`
		: "";
	const legenda = media && Number.isFinite(media.vf)
		? `A marca é a média das pesquisas em ${porExtenso(media.data)}, congelada: Flávio ${p1.format(media.vf)}%.`
		: "A média das pesquisas de 25 de outubro entra nesta marca quando houver número publicado.";
	const pctF = flavio && Number.isFinite(flavio.pct) ? pf.format(flavio.pct) : "—";
	const pctL = lula && Number.isFinite(lula.pct) ? pf.format(lula.pct) : "—";
	const rotulo = zerado
		? "Ainda sem votos apurados. A marca é a média das pesquisas."
		: `Flávio ${pctF}%, Lula ${pctL}%. A marca é a média das pesquisas.`;
	return `<div class="a-cabo-linha">${rosto(FLAVIO).replace("a-rosto", "a-ponta")}<div class="a-cabo-trilha"><div class="a-cabo${zerado ? " a-cabo-vazio" : ""}" role="img" aria-label="${escHtml(rotulo)}">${barra}<em class="a-cabo-50"></em></div>${marca}</div>${rosto(LULA).replace("a-rosto", "a-ponta")}</div><p class="a-cabo-leg">${escHtml(legenda)}</p>`;
}

type PontoNoite = { ap: number; v: number };

function pontosNoite(historico: HistoricoNoite): PontoNoite[] {
	const pontos: PontoNoite[] = [];
	for (const leitura of historico) {
		const bloco = leitura.c.presidente;
		if (!bloco?.c) continue;
		const a = bloco.c[FLAVIO.numero]?.[1];
		const b = bloco.c[LULA.numero]?.[1];
		if (typeof a !== "number" || typeof b !== "number") continue;
		if (!Number.isFinite(a) || !Number.isFinite(b) || !Number.isFinite(bloco.ap)) continue;
		pontos.push({ ap: bloco.ap, v: a - b });
	}
	pontos.sort((a, b) => a.ap - b.ap);
	return pontos;
}

function px(ap: number): number {
	return PAD + (ap / 100) * (100 - 2 * PAD);
}

function py(v: number, lim: number): number {
	return PAD + (1 - (v + lim) / (2 * lim)) * (100 - 2 * PAD);
}

export function htmlGraficoNoite(vista: VistaNoite): string {
	const intro = `<section class="a-noite" aria-labelledby="a-noite-titulo"><h2 id="a-noite-titulo">A vantagem na apuração</h2><p>Eixo de 0 a 100% das seções. A área sombreada ainda vai ser apurada. Flávio fica à esquerda do cabo, mesmo quando a linha cruza o empate.</p>`;
	const pontos = pontosNoite(vista.historico);
	const eixos = `<div class="a-eixo-x" aria-hidden="true"><span style="left:${n2(px(0))}%">0%</span><span style="left:${n2(px(100))}%">100%</span></div>`;
	if (pontos.length === 0) {
		const sombra =
			vista.fase !== "encerrada"
				? `<rect class="t-apurar" x="${n2(px(0))}" width="${n2(px(100) - px(0))}" y="0" height="100"/>`
				: "";
		const grafico = sombra
			? `<div class="a-graf"><div class="a-plot" role="img" aria-label="Vantagem de Flávio sobre Lula conforme as seções são apuradas"><svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">${sombra}</svg></div>${eixos}</div>`
			: eixos;
		return `${intro}<p class="a-graf-vazio">A linha aparece a partir da 2ª leitura do TSE.</p>${grafico}</section>`;
	}
	const pico = Math.max(2, ...pontos.map((ponto) => Math.abs(ponto.v)));
	const lim = Math.ceil(pico / 2) * 2;
	const d = pontos
		.map((ponto, i) => `${i === 0 ? "M" : "L"}${n2(px(ponto.ap))},${n2(py(ponto.v, lim))}`)
		.join("");
	const unico = pontos.length === 1 ? pontos[0] : undefined;
	const marca =
		unico != null
			? `<circle class="t-noite" cx="${n2(px(unico.ap))}" cy="${n2(py(unico.v, lim))}" r="1.6"/>`
			: "";
	const ultimo = pontos[pontos.length - 1]!;
	const sombrear = vista.fase !== "encerrada" && ultimo.ap < 100;
	const sombra = sombrear
		? `<rect class="t-apurar" x="${n2(px(ultimo.ap))}" width="${n2(px(100) - px(ultimo.ap))}" y="0" height="100"/>`
		: "";
	const viradas = (vista.apuracao.analise?.viradas ?? [])
		.filter((virada) => Number.isFinite(virada.ap))
		.map(
			(virada) =>
				`<span class="t-virada" style="left:${n2(px(virada.ap))}%" title="virada"></span>`,
		)
		.join("");
	return `${intro}<div class="a-graf"><div class="a-plot" role="img" aria-label="Vantagem de Flávio sobre Lula conforme as seções são apuradas"><svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">${sombra}<path class="t-noite" d="${d}" fill="none" stroke-width="3" vector-effect="non-scaling-stroke"/>${marca}</svg>${viradas}</div>${eixos}</div></section>`;
}

export function textoMomento(momento: MomentoNoite): string {
	const ap = Number.isFinite(momento.ap) ? `${pf.format(momento.ap)}% das seções` : "sem percentual";
	const hora = /^\d{2}:\d{2}:\d{2}$/.test(momento.hora) ? momento.hora : "sem horário";
	const margem =
		momento.margemPp != null && Number.isFinite(momento.margemPp)
			? `${p1.format(momento.margemPp)} p.p.`
			: "";
	switch (momento.tipo) {
		case "abre":
			return `${hora} · a noite abre com ${nomeLado(momento.n)} na frente${margem ? `, ${margem}` : ""}, ${ap}`;
		case "maior_vantagem":
			return `${hora} · maior vantagem de ${nomeLado(momento.n)}${margem ? `, ${margem}` : ""}, ${ap}`;
		case "metade":
			return `${hora} · metade das seções, ${nomeLado(momento.n)} na frente, ${ap}`;
		case "virada":
			return `${hora} · virou de ${nomeLado(momento.de)} para ${nomeLado(momento.para)}, ${ap}`;
		case "eleito":
			return `${hora} · ${nomeLado(momento.n)} eleito${margem ? `, ${margem}` : ""}, ${ap}`;
		default:
			return `${hora} · ${ap}`;
	}
}

export function htmlMomentos(vista: VistaNoite): string {
	const momentos = vista.apuracao.analise?.momentos ?? [];
	const itens = momentos.length
		? momentos
				.map(
					(momento) =>
						`<li data-tipo="${escHtml(momento.tipo)}">${escHtml(textoMomento(momento))}</li>`,
				)
				.join("")
		: `<li>A noite ainda não tem momentos.</li>`;
	return `<section class="a-momentos" aria-labelledby="a-momentos-titulo"><h2 id="a-momentos-titulo">Momentos da noite</h2><ol>${itens}</ol></section>`;
}

function textoTendencia(tendencia: TendenciaCandidato): string {
	const nome = nomeLado(tendencia.n);
	if (!Number.isFinite(tendencia.ppPor10pct)) return "";
	const sinal = tendencia.ppPor10pct > 0 ? "+" : tendencia.ppPor10pct < 0 ? "−" : "";
	return `${nome} ${sinal}${p1.format(Math.abs(tendencia.ppPor10pct))} p.p.`;
}

export function htmlEstimativas(vista: VistaNoite): string {
	if (vista.fase === "encerrada" || vista.apuracao.encerrada) return "";
	const analise = vista.apuracao.analise?.majoritarias?.presidente;
	if (!analise || analise.validosAApurar == null || !Number.isFinite(analise.validosAApurar)) {
		return `<section class="a-est" data-estimativas><h2>Estimativas</h2><p>Ainda sem base para estimar os votos que faltam.</p></section>`;
	}
	const virar =
		analise.foraDeAlcance || (analise.margemParaVirarPp != null && analise.margemParaVirarPp > 100)
			? "fora de alcance"
			: analise.margemParaVirarPp != null && Number.isFinite(analise.margemParaVirarPp)
				? `${p1.format(analise.margemParaVirarPp)} p.p.`
				: "ainda sem base";
	const tendencias = (analise.tendencias ?? [])
		.map(textoTendencia)
		.filter((texto) => texto.length > 0);
	const tendencia = tendencias.length
		? `${tendencias.join(" e ")} a cada 10% de seções`
		: "aguardando mais leituras";
	return `<section class="a-est" data-estimativas><h2>Estimativas</h2><ul><li><b>Válidos que faltam</b> ${nf.format(analise.validosAApurar)}</li><li><b>Para virar</b> ${virar}</li><li><b>Tendência</b> ${escHtml(tendencia)}</li></ul><p>Supõem que as seções que faltam se parecem com as já apuradas.</p></section>`;
}
