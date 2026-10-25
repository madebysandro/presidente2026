import { escHtml } from "../dominio/texto";
import { urlFonteValida } from "../pesquisas/validar-resultado";
import type { FichaPublica, PayloadPesquisas, PesquisaPublicada, TotaisPublicos } from "../pesquisas/tipos";
import { textoFicha } from "./grafico";
import { FLAVIO, LULA, porExtenso } from "./topo";

const INICIO_RETA = "2026-10-05";
const FIM_RETA = "2026-10-25";
const DIA_VOTACAO = "2026-10-25";
const INICIO_ULTIMA_SEMANA = "2026-10-19";

const SEMANA_CURTA = ["seg", "ter", "qua", "qui", "sex", "sáb", "dom"] as const;
const SEMANA_LONGA = [
	"domingo",
	"segunda",
	"terça",
	"quarta",
	"quinta",
	"sexta",
	"sábado",
] as const;

const p1 = new Intl.NumberFormat("pt-BR", {
	minimumFractionDigits: 1,
	maximumFractionDigits: 1,
});

const n1 = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 1 });

type TipoDia = "eleicao" | "hoje" | "passado" | "futuro";

function somarDias(iso: string, dias: number): string {
	const [ano, mes, dia] = iso.split("-").map(Number) as [number, number, number];
	const utc = new Date(Date.UTC(ano, mes - 1, dia + dias));
	const y = utc.getUTCFullYear();
	const m = String(utc.getUTCMonth() + 1).padStart(2, "0");
	const d = String(utc.getUTCDate()).padStart(2, "0");
	return `${y}-${m}-${d}`;
}

function diasRetaFinal(): string[] {
	const dias: string[] = [];
	for (let iso = INICIO_RETA; iso <= FIM_RETA; iso = somarDias(iso, 1)) dias.push(iso);
	return dias;
}

function indiceSemana(iso: string): number {
	const [ano, mes, dia] = iso.split("-").map(Number) as [number, number, number];
	return new Date(Date.UTC(ano, mes - 1, dia)).getUTCDay();
}

function ddmm(iso: string): string {
	return `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;
}

/** Fração do dia civil em Brasília, de 0 a 100. */
function progressoDoDia(agora: Date): number {
	const partes = new Intl.DateTimeFormat("en-US", {
		timeZone: "America/Sao_Paulo",
		hour: "2-digit",
		minute: "2-digit",
		second: "2-digit",
		hourCycle: "h23",
	}).formatToParts(agora);
	const n = (tipo: Intl.DateTimeFormatPartTypes) =>
		Number(partes.find((parte) => parte.type === tipo)?.value ?? "0");
	const hora = n("hour") % 24;
	const segundos = hora * 3600 + n("minute") * 60 + n("second");
	return (segundos / 86_400) * 100;
}

function larguraProgresso(agora: Date): string {
	const pct = Math.round(progressoDoDia(agora) * 10) / 10;
	return `${pct}%`;
}

function tipoDia(iso: string, hoje: string): TipoDia {
	if (iso === DIA_VOTACAO) return "eleicao";
	if (iso === hoje) return "hoje";
	if (iso < hoje) return "passado";
	return "futuro";
}

function porCampo<T extends { campoFim: string; registro: string }>(lista: readonly T[]): T[] {
	return [...lista].sort(
		(a, b) => a.campoFim.localeCompare(b.campoFim) || a.registro.localeCompare(b.registro),
	);
}

function textoTotais(totais: TotaisPublicos): string {
	const resto =
		totais.brancoNuloNaoSabe != null
			? `brancos, nulos e indecisos ${n1.format(totais.brancoNuloNaoSabe)}%`
			: `brancos e nulos ${n1.format(totais.brancoNulo ?? 0)}%, não sabem ${n1.format(totais.naoSabe ?? 0)}%`;
	return `Flávio ${n1.format(totais.flavio)}%, Lula ${n1.format(totais.lula)}%, ${resto}`;
}

function htmlFonte(fonte: string): string {
	if (!urlFonteValida(fonte)) return "";
	return ` <a href="${escHtml(fonte)}" target="_blank" rel="noopener">Ver fonte</a>`;
}

function htmlDetalhe(pesquisa: PesquisaPublicada): string {
	const publicados = pesquisa.validosPublicados
		? `; o instituto publicou ${n1.format(pesquisa.validosPublicados.flavio)} a ${n1.format(pesquisa.validosPublicados.lula)}`
		: "";
	const ficha = `${escHtml(textoFicha(pesquisa))}${htmlFonte(pesquisa.fonte)}`;
	return `<div class="a-det-num"><span class="a-f"><img class="a-mini-rosto" data-numero="${FLAVIO.numero}" src="${FLAVIO.foto}" alt="" width="161" height="225">${FLAVIO.nome} <b data-dvf data-v="${pesquisa.vf}">${p1.format(pesquisa.vf)}</b></span><span class="a-l">${LULA.nome} <b data-dvl data-v="${pesquisa.vl}">${p1.format(pesquisa.vl)}</b><img class="a-mini-rosto" data-numero="${LULA.numero}" src="${LULA.foto}" alt="" width="161" height="225"></span></div><div class="a-barra"><i style="width:${pesquisa.vf}%"></i><i style="width:${pesquisa.vl}%"></i></div><div data-dtxt><p class="a-det-tit"><b>${escHtml(pesquisa.instituto)}</b>, divulgada em ${porExtenso(pesquisa.liberacaoEfetiva)}. Votos válidos calculados dos totais (${escHtml(textoTotais(pesquisa.totais))}${publicados}).</p><p class="a-ficha">${ficha}</p></div>`;
}

function htmlPublicada(pesquisa: PesquisaPublicada, selecionada: boolean): string {
	const rotulo = `${pesquisa.instituto}: Flávio ${p1.format(pesquisa.vf)}%, Lula ${p1.format(pesquisa.vl)}%`;
	const sel = selecionada ? " sel" : "";
	return `<button type="button" class="a-pesq a-item${sel}" data-registro="${escHtml(pesquisa.registro)}" aria-label="${escHtml(rotulo)}"><span>${escHtml(pesquisa.instituto)}</span><span class="a-mini"><i style="width:${pesquisa.vf}%"></i><i style="width:${pesquisa.vl}%"></i></span><small>${p1.format(pesquisa.vf)} a ${p1.format(pesquisa.vl)}</small></button>`;
}

function htmlSemNumero(ficha: FichaPublica): string {
	return `<span class="a-sem a-item">${escHtml(ficha.instituto)} <small>sem números ainda</small></span>`;
}

function htmlFutura(ficha: FichaPublica): string {
	const title = `${ficha.instituto}: campo de ${ddmm(ficha.campoInicio)} a ${ddmm(ficha.campoFim)}, registro ${ficha.registro}`;
	return `<span class="a-vem a-item" title="${escHtml(title)}">${escHtml(ficha.instituto)}</span>`;
}

function htmlLegenda(): string {
	return `<div class="a-leg"><span class="a-leg-pub">pesquisa divulgada</span><span class="a-leg-vem">registrada no TSE, ainda não divulgada</span><span class="a-leg-sem">liberada, números ainda não cadastrados</span><button type="button" class="a-rever" data-rever="tres-semanas">Rever as três semanas</button></div>`;
}

export function htmlCalendario(
	payload: PayloadPesquisas,
	agora: Date,
	opcoes?: { encolher?: boolean },
): string {
	const hoje = payload.hoje;
	const encolher = opcoes?.encolher === true;
	const publicadas = porCampo(payload.publicadas);
	const semNumero = porCampo(payload.liberadasSemNumero);
	const vemAi = porCampo(payload.vemAi);
	const ultima = publicadas.at(-1);
	const selecionada = ultima?.registro ?? "";
	const noDia = <T extends { liberacaoEfetiva: string }>(lista: readonly T[], iso: string) =>
		lista.filter((item) => item.liberacaoEfetiva === iso);

	const dias = diasRetaFinal().filter((iso) => !encolher || iso >= INICIO_ULTIMA_SEMANA);
	const rotulo = encolher
		? "Calendário das pesquisas, última semana"
		: "Calendário das pesquisas, de 5 a 25 de outubro";
	const celulas = dias
		.map((iso) => {
			const tipo = tipoDia(iso, hoje);
			const pubs = noDia(publicadas, iso);
			const semNumeroNoDia = noDia(semNumero, iso);
			const vem = noDia(vemAi, iso);
			const vazio =
				tipo !== "eleicao" &&
				tipo !== "hoje" &&
				!pubs.length &&
				!semNumeroNoDia.length &&
				!vem.length;
			const itens =
				pubs.map((pesquisa) => htmlPublicada(pesquisa, pesquisa.registro === selecionada)).join("") +
				semNumeroNoDia.map(htmlSemNumero).join("") +
				vem.map(htmlFutura).join("");
			const corpo =
				(tipo === "eleicao"
					? `<p class="a-votacao a-item"><b>Votação</b><br>apuração a partir das 17h</p>`
					: "") + itens;
			const agoraHtml =
				tipo === "hoje"
					? `<em class="a-hoje"><i class="a-ponto" aria-hidden="true"></i>agora</em><i class="a-prog" style="width:${larguraProgresso(agora)}" aria-hidden="true"></i>`
					: "";
			return `<div class="a-dia ${tipo}${vazio ? " vazio" : ""}" data-d="${iso}"><span class="a-n">${Number(iso.slice(8, 10))}<small>${SEMANA_LONGA[indiceSemana(iso)]}</small></span>${agoraHtml}${corpo}</div>`;
		})
		.join("");

	const antes = <T extends { liberacaoEfetiva: string }>(lista: readonly T[]) =>
		encolher ? lista.filter((item) => item.liberacaoEfetiva < INICIO_ULTIMA_SEMANA) : [];
	const anteriores = antes(publicadas);
	const anterioresSem = antes(semNumero);
	const anterioresVem = antes(vemAi);
	const htmlAnteriores =
		anteriores.length || anterioresSem.length || anterioresVem.length
			? `<div class="a-anteriores"><p>Pesquisas de antes da última semana</p>${anteriores.map((pesquisa) => htmlPublicada(pesquisa, pesquisa.registro === selecionada)).join("")}${anterioresSem.map(htmlSemNumero).join("")}${anterioresVem.map(htmlFutura).join("")}</div>`
			: "";
	const vivo = ultima ? htmlDetalhe(ultima) : "";
	const moldes = publicadas
		.map(
			(pesquisa) =>
				`<template data-detalhe="${escHtml(pesquisa.registro)}">${htmlDetalhe(pesquisa)}</template>`,
		)
		.join("");

	return `<section class="a-cal${encolher ? " encolhido" : ""}" aria-label="${rotulo}">${SEMANA_CURTA.map((dia) => `<span class="a-sem-tit">${dia}</span>`).join("")}${celulas}</section>${htmlAnteriores}${htmlLegenda()}<section class="a-det" aria-live="polite" data-detalhe-vivo="">${vivo}</section>${moldes}`;
}
