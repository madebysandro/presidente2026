import { COLEGIOS_MAIORES } from "../apuracao/escopos";
import { COLEGIOS_1T, colegio1t, liderDeVotos, votosUf1t } from "../apuracao/referencia-1t";
import { NOMES_UF, SIGLAS_UF } from "../config/ufs";
import { escHtml, nf, pf } from "../dominio/texto";
import type {
	CandidatoUf,
	ColegioPresidente,
	ComparacaoTurnos,
	FatiaEleitorado,
} from "../dominio/tipos";
import { arquivoZerado, type VistaNoite } from "./ao-vivo";
import { FLAVIO, LULA } from "./topo";

export type { VistaNoite } from "./ao-vivo";

/** Posição aproximada na grade de 7 colunas. Não é mapa geográfico. */
const GRADE: Record<string, readonly [number, number]> = {
	rr: [2, 0],
	ap: [4, 0],
	am: [1, 1],
	pa: [3, 1],
	ma: [4, 1],
	ce: [5, 1],
	rn: [6, 1],
	ac: [0, 2],
	ro: [1, 2],
	mt: [2, 2],
	to: [3, 2],
	pi: [4, 2],
	pe: [5, 2],
	pb: [6, 2],
	ms: [2, 3],
	go: [3, 3],
	df: [4, 3],
	ba: [5, 3],
	al: [6, 3],
	pr: [2, 4],
	sp: [3, 4],
	mg: [4, 4],
	es: [5, 4],
	se: [6, 4],
	sc: [2, 5],
	rj: [4, 5],
	rs: [2, 6],
	zz: [6, 6],
};

const SEM_2T = `<span class="a-sem2">sem 2º</span>`;

const AVISO_EXTERIOR =
	"O exterior costuma apurar por último: as urnas fecham no fuso de cada país.";

function nomeLado(n: string | null | undefined): string {
	if (n === FLAVIO.numero) return FLAVIO.nome;
	if (n === LULA.numero) return LULA.nome;
	return "sem nome";
}

function classeLado(n: string | null | undefined): string {
	if (n === FLAVIO.numero) return "a-f";
	if (n === LULA.numero) return "a-l";
	return "";
}

function classeTile(n: string | null | undefined): string {
	if (n === FLAVIO.numero) return " a-uf-f";
	if (n === LULA.numero) return " a-uf-l";
	return "";
}

function liderDe(candidatos: readonly CandidatoUf[] | undefined): CandidatoUf | null {
	return vantagemDe(candidatos)?.lider ?? null;
}

function vantagemDe(
	candidatos: readonly CandidatoUf[] | undefined,
): { lider: CandidatoUf; margem: number } | null {
	if (!candidatos?.length) return null;
	const ordenados = [...candidatos].sort((a, b) => b.votos - a.votos);
	const topo = ordenados[0];
	if (!topo || topo.votos <= 0) return null;
	return { lider: topo, margem: topo.pct - (ordenados[1]?.pct ?? 0) };
}

function margemCurta(margem: number): string {
	if (margem < 9.95) return pf.format(margem);
	return String(Math.round(margem));
}

function pctTexto(valor: number | undefined): string {
	if (valor == null || !Number.isFinite(valor)) return "—";
	return `${pf.format(valor)}%`;
}

function deltaPp(valor: number | undefined): string {
	if (valor == null || !Number.isFinite(valor)) return "—";
	const texto = pf.format(Math.abs(valor));
	if (valor > 0) return `+${texto} p.p.`;
	if (valor < 0) return `−${texto} p.p.`;
	return `${texto} p.p.`;
}

function pctDoSnapshot(votos: number, validos: number): number | undefined {
	if (!(validos > 0) || !Number.isFinite(votos)) return undefined;
	return (votos / validos) * 100;
}

function secao(id: string, titulo: string, corpo: string): string {
	return `<section class="a-geo" data-geo="${id}" aria-labelledby="a-geo-${id}"><h2 id="a-geo-${id}">${titulo}</h2>${corpo}</section>`;
}

function htmlEstados(vista: VistaNoite): string {
	const ufs = vista.apuracao.ufs ?? {};
	const viraram = new Set(
		(vista.apuracao.analise?.ufsQueViraram ?? [])
			.filter((item) => item.uf !== "zz")
			.map((item) => item.uf),
	);
	let flavio = 0;
	let lula = 0;
	let flavio1t = 0;
	let lula1t = 0;
	const ordem = [...SIGLAS_UF].sort((a, b) => {
		const pa = GRADE[a] ?? [0, 99];
		const pb = GRADE[b] ?? [0, 99];
		return pa[1] - pb[1] || pa[0] - pb[0];
	});
	const tiles = ordem
		.map((sigla) => {
			const pos = GRADE[sigla] ?? [0, 0];
			const unidade = ufs[sigla];
			const vantagem = vantagemDe(unidade?.candidatos);
			const lider = vantagem?.lider ?? null;
			const lider1 = liderDeVotos(votosUf1t(sigla));
			const virou = sigla !== "zz" && Boolean(lider) && viraram.has(sigla);
			if (sigla !== "zz" && lider?.n === FLAVIO.numero) flavio += 1;
			if (sigla !== "zz" && lider?.n === LULA.numero) lula += 1;
			if (sigla !== "zz" && lider1 === FLAVIO.numero) flavio1t += 1;
			if (sigla !== "zz" && lider1 === LULA.numero) lula1t += 1;
			const nome = NOMES_UF[sigla] ?? unidade?.nome ?? sigla.toUpperCase();
			const rotulo = sigla === "zz" ? "EXT" : sigla.toUpperCase();
			const marca = virou ? " viraram" : "";
			const aria = lider
				? `${nome}: ${nomeLado(lider.n)} lidera no 2º turno${marca}`
				: `${nome}: sem seções apuradas · 1º turno: ${nomeLado(lider1)}`;
			const cor = lider?.n ?? lider1;
			const alfa = vantagem ? Math.round(28 + Math.min(60, vantagem.margem * 2.4)) : 10;
			const miolo = vantagem
				? `<small>${margemCurta(vantagem.margem)}</small>${virou ? "<i>viraram</i>" : ""}`
				: SEM_2T;
			return `<div class="a-uf${classeTile(cor)}${vantagem ? "" : " a-uf-1t"}" data-uf="${escHtml(sigla)}" data-virou="${virou ? "1" : "0"}" style="grid-column:${pos[0] + 1};grid-row:${pos[1] + 1};--a:${alfa}%" aria-label="${escHtml(aria)}"><b>${rotulo}</b>${miolo}</div>`;
		})
		.join("");
	const placar = flavio + lula === 0
		? `No 1º turno, Flávio liderou em ${flavio1t} UFs e Lula em ${lula1t}. O quadro mostra esse 1º turno, apagado, até as primeiras seções.`
		: `Flávio ${flavio} · Lula ${lula} UFs lideradas · ${viraram.size} viraram`;
	const regioes = vista.apuracao.analise?.regioes ?? [];
	const linhas = regioes.length
		? regioes
				.map((regiao) => {
					const lider = regiao.lider;
					const abre = `<li data-regiao="${escHtml(regiao.nome)}" data-virou="${regiao.virou ? "1" : "0"}"><b>${escHtml(regiao.nome)}</b>`;
					if (!lider) return `${abre} ${SEM_2T}</li>`;
					const pct22 = pctTexto(regiao.candidatos.find((c) => c.n === FLAVIO.numero)?.pct);
					const pct13 = pctTexto(regiao.candidatos.find((c) => c.n === LULA.numero)?.pct);
					const marca = regiao.virou ? "<i>viraram</i>" : "";
					return `${abre} <span class="a-f">Flávio ${pct22}</span> <span class="a-l">Lula ${pct13}</span> <span>${escHtml(`${nomeLado(lider)} lidera`)}</span> ${marca}</li>`;
				})
				.join("")
		: `<li>As regiões entram com a leitura das UFs.</li>`;
	return secao(
		"estados",
		"Estados e regiões",
		`<p>A cor segue quem lidera na UF. Sem seções apuradas, o quadro mostra o 1º turno, apagado. Quem mudou de líder leva a marca viraram. O exterior aparece na grade e fica de fora deste placar.</p><p data-placar-ufs>${placar}</p><div class="a-mapa" role="group" aria-label="Grade de UFs em 7 colunas">${tiles}</div><h3>Por região</h3><ul class="a-regioes">${linhas}</ul>`,
	);
}

function linhaLado(
	n: string,
	pct2: number | undefined,
	pct1: number | undefined,
	comDelta: boolean,
): string {
	const tem2 = pct2 != null && Number.isFinite(pct2);
	const delta = comDelta && tem2 && pct1 != null ? ` · ${deltaPp(pct2 - pct1)}` : "";
	const segundo = tem2 ? pctTexto(pct2) : SEM_2T;
	return `<li data-lado="${n}"><span class="${classeLado(n)}">${nomeLado(n)}</span> ${segundo} · 1º turno ${pctTexto(pct1)}${delta}</li>`;
}

function htmlExterior(vista: VistaNoite): string {
	const zz = vista.apuracao.ufs?.zz;
	const lider = liderDe(zz?.candidatos);
	const zerado = lider == null;
	const ref = COLEGIOS_1T.exterior;
	const pct1 = (n: string) => pctDoSnapshot(ref.votos[n] ?? 0, ref.validos);
	const pct2 = (n: string) => zz?.candidatos.find((c) => c.n === n)?.pct;
	const lados = `<ul class="a-lados">${linhaLado(FLAVIO.numero, zerado ? undefined : pct2(FLAVIO.numero), pct1(FLAVIO.numero), !zerado)}${linhaLado(LULA.numero, zerado ? undefined : pct2(LULA.numero), pct1(LULA.numero), !zerado)}</ul>`;
	const liderTxt = lider
		? `${nomeLado(lider.n)} lidera no 2º turno.`
		: "O exterior ainda não tem votos no 2º turno.";
	const aviso = zerado ? `<p data-aviso-exterior>${AVISO_EXTERIOR}</p>` : "";
	const comp2 = !zerado && zz && Number.isFinite(zz.comparecimento) ? zz.comparecimento : undefined;
	const comp1 = ref.pctComparecimento;
	const comp = comp2 == null
		? `Comparecimento no 1º turno ${pctTexto(comp1)}. O 2º turno ainda não tem comparecimento.`
		: `Comparecimento no 2º turno ${pctTexto(comp2)} · no 1º turno ${pctTexto(comp1)} · ${deltaPp(comp2 - comp1)}`;
	return secao(
		"exterior",
		"Exterior",
		`<p data-lider-exterior>${escHtml(liderTxt)}</p>${lados}<p data-comp-exterior>${comp} · ${nf.format(ref.eleitorado)} eleitores no 1º turno.</p>${aviso}`,
	);
}

function linhaComparecimento(
	escopo: string,
	rotulo: string,
	c1: number,
	a1: number,
	c2: number | undefined,
	a2: number | undefined,
): string {
	const segundo = c2 == null || a2 == null
		? "2º turno ainda sem comparecimento"
		: `2º turno comparecimento ${pctTexto(c2)} · abstenção ${pctTexto(a2)} · diferença ${deltaPp(c2 - c1)} no comparecimento e ${deltaPp(a2 - a1)} na abstenção`;
	return `<li data-escopo="${escopo}"><b>${rotulo}</b> <span>1º turno comparecimento ${pctTexto(c1)} · abstenção ${pctTexto(a1)}</span> <span>${segundo}</span></li>`;
}

function htmlComparecimento(vista: VistaNoite): string {
	const brasil = COLEGIOS_1T.brasil;
	const exterior = COLEGIOS_1T.exterior;
	const cargo = vista.apuracao.cargos.presidente;
	const medido = Boolean(cargo) && !arquivoZerado(vista.apuracao);
	const c2 = medido && cargo && Number.isFinite(cargo.totais.comparecimento) ? cargo.totais.comparecimento : undefined;
	const a2 = medido && cargo && Number.isFinite(cargo.totais.abstencao) ? cargo.totais.abstencao : undefined;
	const zz = vista.apuracao.ufs?.zz;
	const liderZz = liderDe(zz?.candidatos);
	const cExt = liderZz && zz && Number.isFinite(zz.comparecimento) ? zz.comparecimento : undefined;
	const aExt = cExt == null ? undefined : 100 - cExt;
	const aBrasil1 = 100 - brasil.pctComparecimento;
	const aExt1 = 100 - exterior.pctComparecimento;
	return secao(
		"comparecimento",
		"Comparecimento e abstenção",
		`<p>Brasil e exterior, com a diferença para o 1º turno. Durante a noite, o 2º turno é o das seções já apuradas.</p><ul class="a-comp">${linhaComparecimento("brasil", "Brasil", brasil.pctComparecimento, aBrasil1, c2, a2)}${linhaComparecimento("exterior", "Exterior", exterior.pctComparecimento, aExt1, cExt, aExt)}</ul>`,
	);
}

function fatias(fatia: FatiaEleitorado): string {
	const partes: Array<[string, number, string]> = [
		["Flávio", fatia.flavio, "var(--f)"],
		["Lula", fatia.lula, "var(--l)"],
		["Outros", fatia.outros, "var(--suave)"],
		["Brancos e nulos", fatia.brancosNulos, "#9aa3b2"],
		["Abstenção", fatia.abstencao, "var(--regua)"],
	];
	const barra = partes
		.filter(([, valor]) => Number.isFinite(valor) && valor > 0.05)
		.map(([, valor, cor]) => `<i style="width:${Math.max(0, valor).toFixed(2)}%;background:${cor}"></i>`)
		.join("");
	const legenda = partes
		.map(([nome, valor]) => `<span>${nome} ${pctTexto(valor)}</span>`)
		.join(" ");
	return `<div class="a-barra" aria-hidden="true">${barra}</div><p class="a-legenda">${legenda}</p>`;
}

function htmlTransferencia(vista: VistaNoite): string {
	const comparacao: ComparacaoTurnos | undefined = vista.apuracao.analise?.comparacao;
	if (!comparacao) {
		return secao(
			"transferencia",
			"Do 1º ao 2º turno",
			`<p>A comparação dos turnos entra com a leitura da apuração.</p>`,
		);
	}
	const segundo = comparacao.segundo
		? `<div data-composicao="2"><b>2º turno</b>${fatias(comparacao.segundo)}</div>`
		: `<p data-composicao="2">O 2º turno aparece com as primeiras seções.</p>`;
	return secao(
		"transferencia",
		"Do 1º ao 2º turno",
		`<h3>Composição do eleitorado</h3><p>Percentual do eleitorado, para comparar o 1º turno final com o 2º turno nas seções já apuradas.</p><div data-composicao="1"><b>1º turno</b>${fatias(comparacao.primeiro)}</div>${segundo}`,
	);
}

function textoTurnoColegio(colegio: ColegioPresidente | undefined): string {
	if (!colegio || colegio.validos <= 0) return SEM_2T;
	const pct = (n: string) => pctTexto(colegio.candidatos.find((c) => c.n === n)?.pct);
	return `2º turno Flávio ${pct(FLAVIO.numero)} · Lula ${pct(LULA.numero)}`;
}

function htmlColegios(vista: VistaNoite): string {
	const colegios = vista.apuracao.colegios ?? {};
	const itens = COLEGIOS_MAIORES.map((meta) => {
		const colegio = colegios[meta.cd];
		const ref = colegio1t(meta.cd);
		const validos = ref?.validos ?? 0;
		const pct1 = (n: string) => pctTexto(pctDoSnapshot(ref?.votos[n] ?? 0, validos));
		const lider2 = liderDe(colegio?.candidatos);
		const lider1 = ref ? liderDeVotos(ref.votos) : null;
		const virou = Boolean(lider2 && lider1 && lider2.n !== lider1);
		return `<li data-colegio="${escHtml(meta.cd)}"><b>${escHtml(meta.nome)}</b> <small>${meta.uf.toUpperCase()}</small> <span data-turno="2">${textoTurnoColegio(colegio)}</span> <span data-turno="1">1º turno Flávio ${pct1(FLAVIO.numero)} · Lula ${pct1(LULA.numero)}</span>${virou ? " <i>viraram</i>" : ""}</li>`;
	}).join("");
	return secao(
		"colegios",
		"Maiores colégios eleitorais",
		`<p>Os 10 municípios com mais eleitores no 1º turno. A lista é fixa e não muda de ordem durante a noite.</p><ol class="a-colegios">${itens}</ol>`,
	);
}

/** Coluna da direita da grade da noite (#16): exterior e comparecimento. */
export function htmlGeografiaLateral(vista: VistaNoite): string {
	return `${htmlExterior(vista)}${htmlComparecimento(vista)}`;
}

/** Abaixo da grade, na largura toda (#16): estados, colégios e a comparação dos turnos. */
export function htmlGeografiaCheia(vista: VistaNoite): string {
	return `${htmlEstados(vista)}${htmlColegios(vista)}${htmlTransferencia(vista)}`;
}

/** Geografia da noite, na ordem do celular. */
export function htmlGeografia(vista: VistaNoite): string {
	return `${htmlGeografiaLateral(vista)}${htmlGeografiaCheia(vista)}`;
}
