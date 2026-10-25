import { escHtml } from "../dominio/texto";
import { arred2 } from "../pesquisas/validos";
import type { FichaPublica, PayloadPesquisas } from "../pesquisas/tipos";

const FOTO = "https://resultados.tse.jus.br/oficial/ele2026/6258/fotos/br/";

export const FLAVIO = {
	numero: "22",
	nome: "Flávio",
	foto: `${FOTO}280002551544.jpeg`,
} as const;

export const LULA = {
	numero: "13",
	nome: "Lula",
	foto: `${FOTO}280002542548.jpeg`,
} as const;

/** 25/10/2026 00:00 em Brasília. */
const ALVO_VOTACAO_MS = Date.parse("2026-10-25T00:00:00-03:00");

const MESES = [
	"janeiro",
	"fevereiro",
	"março",
	"abril",
	"maio",
	"junho",
	"julho",
	"agosto",
	"setembro",
	"outubro",
	"novembro",
	"dezembro",
] as const;

const p1 = new Intl.NumberFormat("pt-BR", {
	minimumFractionDigits: 1,
	maximumFractionDigits: 1,
});

const n1 = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 1 });

export function contagemVotacao(agora: Date): { dias: number; relogio: string } {
	const ms = Math.max(0, ALVO_VOTACAO_MS - agora.getTime());
	const dias = Math.floor(ms / 86_400_000);
	const h = Math.floor((ms % 86_400_000) / 3_600_000);
	const m = Math.floor((ms % 3_600_000) / 60_000);
	const s = Math.floor((ms % 60_000) / 1000);
	const relogio = [h, m, s].map((n) => String(n).padStart(2, "0")).join(":");
	return { dias, relogio };
}

export function porExtenso(iso: string): string {
	const dia = Number(iso.slice(8, 10));
	const mes = MESES[Number(iso.slice(5, 7)) - 1] ?? "";
	return `${dia} de ${mes}`;
}

function juntarNomes(nomes: readonly string[]): string {
	if (nomes.length <= 1) return nomes[0] ?? "";
	if (nomes.length === 2) return `${nomes[0]} e ${nomes[1]}`;
	return `${nomes.slice(0, -1).join(", ")} e ${nomes.at(-1)}`;
}

function instanteMeiaNoiteBrasilia(iso: string): number {
	return Date.parse(`${iso}T00:00:00-03:00`);
}

function textoAteLiberacao(alvoMs: number, agora: Date): string {
	const falta = alvoMs - agora.getTime();
	if (!(falta > 0)) return "já liberadas";
	const horas = Math.floor(falta / 3_600_000);
	const min = Math.floor((falta % 3_600_000) / 60_000);
	return `em ${horas} h ${String(min).padStart(2, "0")} min`;
}

function textoPontos(margem: number): string {
	return `${n1.format(margem)} ponto${margem === 1 ? "" : "s"}`;
}

function rosto(lado: typeof FLAVIO | typeof LULA, classe: string): string {
	return `<img class="${classe}" data-numero="${lado.numero}" src="${lado.foto}" alt="" width="161" height="225">`;
}

export function htmlVeredito(payload: PayloadPesquisas): string {
	const media = payload.media;
	if (!media) {
		return `<div class="a-veredito"><h1>Ainda não há média</h1><p>As pesquisas publicadas entram aqui, em votos válidos.</p></div>`;
	}
	const institutos = `${n1.format(media.n)} instituto${media.n === 1 ? "" : "s"}`;
	return `<div class="a-veredito"><h1><span class="a-l">${rosto(LULA, "a-rosto")}${LULA.nome} <b data-vl data-v="${media.vl}">${p1.format(media.vl)}</b></span> <span class="a-x">a</span> <span class="a-f">${rosto(FLAVIO, "a-rosto")}${FLAVIO.nome} <b data-vf data-v="${media.vf}">${p1.format(media.vf)}</b></span></h1><p>É a média das últimas pesquisas de <span data-institutos>${institutos}</span>, em votos válidos. Cada quadrado abaixo é um dia da reta final.</p></div>`;
}

export function htmlLegendaCabo(payload: PayloadPesquisas): string {
	const media = payload.media;
	if (!media) return "";
	return `<p class="a-cabo-leg">A faixa clara é a margem de erro média dessas pesquisas, ${textoPontos(media.margem)} para cada lado: a divisa real pode estar em qualquer lugar dela.</p>`;
}

function proximaRodada(vemAi: readonly FichaPublica[]): { data: string; nomes: string[] } | null {
	if (!vemAi.length) return null;
	const data = vemAi.reduce(
		(min, ficha) => (ficha.liberacaoEfetiva < min ? ficha.liberacaoEfetiva : min),
		vemAi[0]!.liberacaoEfetiva,
	);
	const nomes: string[] = [];
	const vistos = new Set<string>();
	const doDia = vemAi
		.filter((ficha) => ficha.liberacaoEfetiva === data)
		.sort(
			(a, b) => a.campoFim.localeCompare(b.campoFim) || a.registro.localeCompare(b.registro),
		);
	for (const ficha of doDia) {
		if (vistos.has(ficha.instituto)) continue;
		vistos.add(ficha.instituto);
		nomes.push(ficha.instituto);
	}
	return nomes.length ? { data, nomes } : null;
}

export function htmlProximaLiberacao(payload: PayloadPesquisas, agora: Date): string {
	const rodada = proximaRodada(payload.vemAi);
	if (!rodada) return "";
	const alvo = instanteMeiaNoiteBrasilia(rodada.data);
	const verbo = rodada.nomes.length === 1 ? "pode" : "podem";
	const quando = Number.isFinite(alvo) ? textoAteLiberacao(alvo, agora) : "";
	const iso = Number.isFinite(alvo) ? new Date(alvo).toISOString() : "";
	return `<p class="a-proxima"><span class="a-ponto" aria-hidden="true"></span><span>${escHtml(juntarNomes(rodada.nomes))} ${verbo} divulgar a partir de ${porExtenso(rodada.data)}, <b data-proxima data-alvo-liberacao="${iso}">${quando}</b>.</span></p>`;
}

function htmlCabo(payload: PayloadPesquisas): string {
	const media = payload.media;
	if (!media) return "";
	const rotulo = `Lula ${p1.format(media.vl)}%, Flávio ${p1.format(media.vf)}%, margem de erro média de ${textoPontos(media.margem)}`;
	return `<div class="a-cabo-linha">${rosto(LULA, "a-ponta")}<div class="a-cabo a-cabo-lf" role="img" aria-label="${escHtml(rotulo)}"><i class="a-cabo-f" data-base="${media.vf}" data-margem="${media.margem}" style="width:${media.vf}%"></i><span class="a-cabo-margem" style="left:${arred2(100 - media.vf - media.margem)}%;width:${arred2(2 * media.margem)}%"></span><em class="a-cabo-50"></em></div>${rosto(FLAVIO, "a-ponta")}</div>`;
}

export function htmlTopo(payload: PayloadPesquisas, agora: Date): string {
	const conta = contagemVotacao(agora);
	const alvo = new Date(ALVO_VOTACAO_MS).toISOString();
	return `<header class="a-topo" data-alvo-votacao="${alvo}"><p class="a-marca">Presidente 2026, 2º turno</p>${htmlVeredito(payload)}<div class="a-conta"><b data-conta>${conta.dias}</b><span>dias e<br><span class="a-relogio" data-relogio>${conta.relogio}</span><br>até a votação</span></div>${htmlCabo(payload)}${htmlLegendaCabo(payload)}${htmlProximaLiberacao(payload, agora)}</header>`;
}
