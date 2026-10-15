/**
 * PROTOTYPE — Tela 1 do 2º turno (Presidente). Marcação .db-* de produção + poucos blocos .t2-*.
 * Lê o estado no formato da API (mock) e o 1º turno real (estado-1t.json).
 */

import { barraViva } from "./movimento/fluxo-barras.js";
import { CANDIDATOS_2T, ELEITORADO_2T, REGIOES } from "./mock-2t.js";
import { cf, conta, corD, deltaPp, esc, foto, nf, nomeBonito, pf, spark } from "./tela1-util.js";

const [K22, K13] = CANDIDATOS_2T.map((k) => k.n);
// A cor segue a entidade, atribuída uma vez na ordem do arquivo do TSE (22, 13).
const cor = (n) => corD("presidente", n);
cor(K22);
cor(K13);
const nomeDe = (n) => nomeBonito(CANDIDATOS_2T.find((k) => k.n === n).nome);
const pp = (v) => `${pf.format(Math.abs(v))} p.p.`;
const mi = (v) => cf.format(v);

/* ---------- placar (duelo) ---------- */

function lado(c, lider, ctx) {
	const { P, encerrada, pre } = ctx;
	const eleito = encerrada && c.eleito;
	const selo = pre
		? ""
		: eleito
			? '<span class="t2-selo t2-eleito">✓ Eleito</span>'
			: lider
				? '<span class="t2-selo">lidera</span>'
				: "";
	return `<div class="t2-lado ${lider && !pre ? "lider" : ""}" style="--c:${cor(c.n)}" data-flip="duelo-${c.n}">
      <div class="t2-quem">${foto(c, "db-rosto t2-rosto")}
        <span class="db-nome"><b title="${esc(c.nomeUrna)}">${esc(nomeBonito(c.nome))}</b><small>${esc(c.partido)} · ${c.n} · ${esc(c.agr)}</small></span></div>
      <b class="db-heroi">${conta(`t2-${c.n}-p`, c.pct, "p")}</b>
      <span class="t2-votos">${conta(`t2-${c.n}-v`, c.votos)} votos ${selo}</span>
    </div>`;
}

export function cartaoDuelo(ctx) {
	const { P, an, hist, viradas, pre, encerrada } = ctx;
	const por = Object.fromEntries(P.candidatos.map((c) => [c.n, c]));
	const a = por[K22];
	const b = por[K13];
	const lider = P.candidatos[0];
	const outro = P.candidatos[1];
	const margem = lider.pct - outro.pct;
	const ultVirada = viradas.at(-1);
	const viradaRecente = ultVirada && hist.length - hist.findIndex((h) => h.c.presidente.ap >= ultVirada.ap) <= 3;

	const frase = pre
		? `Apuração começa às 17h (horário de Brasília). O arquivo oficial do 2º turno já está publicado, com ${nf.format(ELEITORADO_2T)} eleitores e os dois candidatos zerados.`
		: encerrada
			? `<b>${esc(nomeDe(lider.n))} eleito</b> com ${pf.format(lider.pct)}% dos votos válidos, ${pp(margem)} (${mi(lider.votos - outro.votos)} votos) à frente de ${esc(nomeDe(outro.n))}.`
			: `<b>${esc(nomeDe(lider.n))} lidera</b> por ${pp(margem)} (${mi(lider.votos - outro.votos)} votos) com ${pf.format(P.apurado)}% das seções apuradas.${viradaRecente ? ` <span class="t2-chip">↻ virada às ${ultVirada.hora.slice(0, 5)}</span>` : ""}`;

	const larg = (c) => (pre ? 50 : c.pct);
	return `<article class="db-card t2-duelo">
    <header class="db-card-topo">
      <div><h2>Presidente · 2º turno</h2><span>Brasil · 25/10/2026 · ${pre ? "aguardando a apuração" : encerrada ? "resultado final" : "apuração em andamento"}</span></div>
      <div class="db-apu">${conta("t2-ap", P.apurado, "p")}<small>das seções apuradas</small></div>
    </header>
    <div class="t2-placar">
      ${lado(a, lider.n === a.n, ctx)}
      <div class="t2-meio">${
				pre
					? '<span class="t2-x">×</span>'
					: `<small>vantagem</small><b>${pf.format(margem)}</b><small>p.p.</small>`
			}</div>
      ${lado(b, lider.n === b.n, ctx)}
    </div>
    <div class="t2-cabo" role="img" aria-label="${pre ? "Sem votos apurados" : `${esc(nomeDe(a.n))} ${pf.format(a.pct)}%, ${esc(nomeDe(b.n))} ${pf.format(b.pct)}%`}">
      <i style="--c:${cor(a.n)};width:${larg(a)}%"></i><i style="--c:${cor(b.n)};width:${larg(b)}%"></i><em></em>
    </div>
    <p class="t2-frase">${frase}</p>
    <figure class="db-fig">
      <figcaption><span>Vantagem em p.p. dos válidos conforme as seções são apuradas · eixo até 100%</span>
        <span class="db-leg"><span><i class="db-sw" style="background:${cor(a.n)}"></i>${esc(nomeDe(a.n))} à frente</span><span><i class="db-sw" style="background:${cor(b.n)}"></i>${esc(nomeDe(b.n))} à frente</span></span></figcaption>
      <div class="db-graf t2-graf" data-margem></div>
    </figure>
    ${analise(P, an, ctx)}
    ${momentos(hist, viradas, P, encerrada)}
  </article>`;
}

function analise(P, a, ctx) {
	if (ctx.pre || !a) return "";
	const nm = (x) => esc(nomeDe(x.n));
	const itens = [
		[
			"VANTAGEM DO LÍDER",
			`${nf.format(a.vantagemVotos)} votos · ${pf.format(a.vantagemPp)} p.p. ${spark(a.evolucaoVantagemPp, 56, 18)}`,
			`${nm(a.defensor)} sobre ${nm(a.perseguidor)}`,
		],
	];
	if (ctx.encerrada) {
		const T = P.totais;
		itens.push(
			["COMPARECIMENTO", `${pf.format(T.comparecimento)}%`, `1º turno: ${pf.format(ctx.e1.cargos.presidente.totais.comparecimento)}%`],
			["BRANCOS E NULOS", `${pf.format(T.brancos + T.nulos)}%`, `1º turno: ${pf.format(ctx.e1.cargos.presidente.totais.brancos + ctx.e1.cargos.presidente.totais.nulos)}%`],
			["VIRADAS NA NOITE", `${ctx.viradas.length}`, ctx.viradas.length ? `a última às ${ctx.viradas.at(-1).hora.slice(0, 5)}, com ${pf.format(ctx.viradas.at(-1).ap)}% apurado` : "o líder da 1ª leitura venceu"],
		);
	} else {
		itens.push(
			["VÁLIDOS A APURAR (EST.)", `≈ ${cf.format(a.validosAApurar)}`, `${pf.format(100 - P.apurado)}% das seções ainda faltam`],
			[
				"PARA VIRAR",
				a.foraDeAlcance ? "fora de alcance" : `+${pf.format(a.margemParaVirarPp)} p.p.`,
				`${nm(a.perseguidor)} precisa superar ${nm(a.defensor)} por essa margem no que falta`,
			],
			[
				"TENDÊNCIA RECENTE",
				a.tendencias.length
					? a.tendencias.map((t) => `<span class="db-tend">${esc(nomeDe(t.n))} ${deltaPp(t.ppPor10pct)}</span>`).join("")
					: '<span class="db-vazio">aguardando mais leituras</span>',
				"p.p. a cada 10% de seções, nas últimas leituras",
			],
		);
	}
	return `<dl class="db-analise">${itens
		.map(([r, v, sub]) => `<div><dt>${r}</dt><dd>${v}</dd>${sub ? `<dd class="db-sub">${sub}</dd>` : ""}</div>`)
		.join("")}</dl>`;
}

function momentos(hist, viradas, P, encerrada) {
	if (!hist.length) {
		return `<section class="db-sec"><h3>Momentos da noite <small>viradas e marcos aparecem aqui</small></h3>
      <p class="db-vazio db-fig-final">Nenhuma seção apurada ainda. A 1ª leitura do TSE costuma sair poucos minutos depois das 17h.</p></section>`;
	}
	const m = (h) => h.c.presidente;
	const lid = (p) => (p.c[K22][0] >= p.c[K13][0] ? K22 : K13);
	const marg = (p) => Math.abs(p.c[K22][1] - p.c[K13][1]);
	const ev = [];
	const p0 = m(hist[0]);
	ev.push([p0.hora, p0.ap, `${esc(nomeDe(lid(p0)))} abre na frente por ${pp(marg(p0))}`, ""]);
	let maior = p0;
	for (const h of hist) if (lid(m(h)) === lid(p0) && marg(m(h)) > marg(maior)) maior = m(h);
	if (maior !== p0) ev.push([maior.hora, maior.ap, `maior vantagem de ${esc(nomeDe(lid(p0)))}: ${pp(marg(maior))}`, ""]);
	const meio = hist.find((h) => m(h).ap >= 50);
	if (meio) ev.push([m(meio).hora, m(meio).ap, `metade das seções apuradas · ${esc(nomeDe(lid(m(meio))))} +${pp(marg(m(meio)))}`, ""]);
	for (const v of viradas) ev.push([v.hora, v.ap, `<b>${esc(nomeDe(v.para))} passa à frente</b> de ${esc(nomeDe(v.de))}`, "virada"]);
	if (encerrada) ev.push([P.hora, 100, `<b>${esc(nomeDe(P.candidatos[0].n))} eleito</b> · ${pp(P.candidatos[0].pct - P.candidatos[1].pct)} de vantagem`, "fim"]);
	ev.sort((x, y) => x[1] - y[1]);
	return `<section class="db-sec"><h3>Momentos da noite <small>calculados a partir das leituras do acompanhamento</small></h3>
    <ol class="t2-momentos">${ev
			.map(
				([h, ap, txt, cls]) =>
					`<li class="${cls}"><span class="t2-hora">${h.slice(0, 5)}</span><span class="t2-ap">${pf.format(ap)}%</span><span>${cls === "virada" ? "↻ " : cls === "fim" ? "✓ " : ""}${txt}</span></li>`,
			)
			.join("")}</ol></section>`;
}

/* ---------- gráfico da vantagem (SVG, sem biblioteca) ---------- */

export function pintarMargem(hist, viradas, ref = null) {
	const el = document.querySelector("[data-margem]");
	if (!el) return;
	const W = Math.max(280, Math.floor(el.clientWidth || 320));
	const H = 230;
	const m = { t: 18, r: 64, b: 26, l: 38 };
	const pw = W - m.l - m.r;
	const ph = H - m.t - m.b;
	const pts = hist.map((h) => {
		const p = h.c.presidente;
		return { ap: p.ap, v: p.c[K22][1] - p.c[K13][1], hora: p.hora, a: p.c[K22][1], b: p.c[K13][1] };
	});
	// Escala pelas leituras a partir de 10% apurado: as primeiras urnas oscilam muito e achatariam o resto.
	const firmes = pts.filter((p) => p.ap >= 10);
	const maxAbs = Math.max(2, ...(firmes.length ? firmes : pts).map((p) => Math.abs(p.v)), ref ? Math.abs(ref.v) : 0);
	const passo = [1, 2, 5, 10, 20].find((s) => (maxAbs * 1.15) / s <= 3) ?? 10;
	const lim = Math.ceil((maxAbs * 1.15) / passo) * passo;
	const X = (v) => m.l + (v / 100) * pw;
	const Y = (v) => m.t + (1 - (v + lim) / (2 * lim)) * ph;
	const ticksY = [];
	for (let v = -lim; v <= lim + 1e-9; v += passo) ticksY.push(v);
	const grade =
		ticksY
			.map(
				(v) =>
					`<line class="g" x1="${m.l}" x2="${W - m.r}" y1="${Y(v)}" y2="${Y(v)}"/><text class="t" x="${m.l - 6}" y="${Y(v) + 4}" text-anchor="end">${v ? Math.abs(v) : ""}</text>`,
			)
			.join("") +
		[0, 25, 50, 75, 100].map((v) => `<text class="t" x="${X(v)}" y="${H - 7}" text-anchor="middle">${v}%</text>`).join("");
	const zero = `<line class="ref" x1="${m.l}" x2="${W - m.r}" y1="${Y(0)}" y2="${Y(0)}"/><text class="t" x="${W - m.r + 6}" y="${Y(0) + 4}">empate</text>`;
	const rot = `<text class="t" x="${m.l + 6}" y="${m.t + 12}">▲ ${esc(nomeDe(K22))}</text><text class="t" x="${m.l + 6}" y="${m.t + ph - 6}">▼ ${esc(nomeDe(K13))}</text>`;
	if (!pts.length) {
		el.innerHTML = `<svg width="${W}" height="${H}" role="img" aria-label="Vantagem: sem leituras ainda">${grade}${zero}${rot}</svg><p class="db-vazio">A linha aparece com as primeiras seções apuradas.</p>`;
		return;
	}
	const ult = pts.at(-1);
	const falta = ult.ap < 99.99 ? `<rect class="t2-falta" x="${X(ult.ap)}" y="${m.t}" width="${X(100) - X(ult.ap)}" height="${ph}"/><text class="t" x="${(X(ult.ap) + X(100)) / 2}" y="${m.t + 12}" text-anchor="middle">${ult.ap < 92 ? "a apurar" : ""}</text>` : "";
	const d = pts.map((p, i) => `${i ? "L" : "M"}${X(p.ap).toFixed(1)},${Y(p.v).toFixed(1)}`).join("");
	const area = `${d}L${X(ult.ap).toFixed(1)},${Y(0)}L${X(pts[0].ap).toFixed(1)},${Y(0)}Z`;
	const clips = `<clipPath id="t2-cima"><rect x="0" y="${m.t}" width="${W}" height="${Y(0) - m.t}"/></clipPath><clipPath id="t2-baixo"><rect x="0" y="${Y(0)}" width="${W}" height="${m.t + ph - Y(0)}"/></clipPath>`;
	const serie = ["cima", "baixo"]
		.map((lado, i) => {
			const c = cor(i ? K13 : K22);
			return `<g clip-path="url(#t2-${lado})"><path d="${area}" fill="${c}" opacity=".16"/><path class="l" d="${d}" stroke="${c}"/></g>`;
		})
		.join("");
	const marcasVirada = viradas
		.map(
			(v) =>
				`<line class="t2-vline" x1="${X(v.ap)}" x2="${X(v.ap)}" y1="${m.t}" y2="${m.t + ph}"/><circle class="t2-vponto" cx="${X(v.ap)}" cy="${Y(0)}" r="5"/><text class="v" x="${X(v.ap) - 6}" y="${m.t + ph - 6}" text-anchor="end">↻ virada ${v.hora.slice(0, 5)}</text>`,
		)
		.join("");
	const fora = pts.some((p) => Math.abs(p.v) > lim) ? `<text class="t" x="${X(pts[0].ap) + 4}" y="${m.t + 26}">↑ início fora da escala (${pf.format(Math.abs(pts[0].v))})</text>` : "";
	// PROTO-PESQ (variante B): a média das pesquisas como referência tracejada
	const linhaRef = ref ? `<line class="pq-ref" x1="${m.l}" x2="${W - m.r}" y1="${Y(ref.v)}" y2="${Y(ref.v)}"/><text class="t" x="${W - m.r + 6}" y="${Y(ref.v) + 4}">${esc(ref.rotulo)}</text>` : "";
	const cUlt = cor(ult.v >= 0 ? K22 : K13);
	const ponta = `<circle class="ping" cx="${X(ult.ap)}" cy="${Y(ult.v)}" r="4" fill="${cUlt}"/><circle class="pt" cx="${X(ult.ap)}" cy="${Y(ult.v)}" r="4" fill="${cUlt}"/>
    <text class="v" x="${Math.min(X(ult.ap) + 8, W - m.r + 4)}" y="${Y(ult.v) + (ult.v >= 0 ? -8 : 16)}">${pf.format(Math.abs(ult.v))}</text>`;
	el.innerHTML = `<svg width="${W}" height="${H}" role="img" aria-label="Vantagem em pontos percentuais ao longo da apuração">
    <defs>${clips}</defs>${falta}${grade}<line class="eixo" x1="${m.l}" x2="${W - m.r}" y1="${m.t + ph}" y2="${m.t + ph}"/>${zero}${rot}
    ${linhaRef}${serie}${fora}${marcasVirada}${ponta}
    <line class="mira" x1="-10" x2="-10" y1="${m.t}" y2="${m.t + ph}"/>
    <rect class="hit" x="${m.l}" y="${m.t}" width="${pw}" height="${ph}"/>
  </svg><div class="db-tip" hidden></div>`;
	const svg = el.querySelector("svg");
	const tip = el.querySelector(".db-tip");
	const mira = svg.querySelector(".mira");
	const hit = svg.querySelector(".hit");
	hit.addEventListener("pointermove", (e) => {
		const r = svg.getBoundingClientRect();
		const xv = ((e.clientX - r.left - m.l) / pw) * 100;
		const p = pts.reduce((q, s) => (Math.abs(s.ap - xv) < Math.abs(q.ap - xv) ? s : q));
		mira.setAttribute("x1", String(X(p.ap)));
		mira.setAttribute("x2", String(X(p.ap)));
		mira.classList.add("on");
		const linhas = [
			[K22, p.a],
			[K13, p.b],
		].sort((x, y) => y[1] - x[1]);
		tip.innerHTML =
			`<b>${pf.format(p.ap)}% apurado · ${esc(p.hora)}</b>` +
			linhas.map(([n, v]) => `<div><i style="background:${cor(n)}"></i>${esc(nomeDe(n))}<span>${pf.format(v)}%</span></div>`).join("") +
			`<div>vantagem<span>${pf.format(Math.abs(p.v))} p.p.</span></div>`;
		tip.hidden = false;
		tip.style.left = Math.max(0, Math.min(X(p.ap) + 12, r.width - tip.offsetWidth)) + "px";
		tip.style.top = m.t + "px";
	});
	hit.addEventListener("pointerleave", () => {
		tip.hidden = true;
		mira.classList.remove("on");
	});
}

/* ---------- do 1º ao 2º turno ---------- */

/** Frações do eleitorado (1T final; 2T nas seções apuradas). */
function composicao(e1, P) {
	const T1 = e1.cargos.presidente.totais;
	const c1 = e1.cargos.presidente.candidatos;
	const E1 = T1.eleitorado;
	const v = (n) => c1.find((c) => c.n === n).votos / E1;
	const comp1 = T1.comparecimento / 100;
	const um = {
		[K22]: v(K22),
		[K13]: v(K13),
		outros: (T1.validos - c1.find((c) => c.n === K22).votos - c1.find((c) => c.n === K13).votos) / E1,
		bn: comp1 * ((T1.brancos + T1.nulos) / 100),
		abst: 1 - comp1,
	};
	const T2 = P.totais;
	if (!T2.validos) return { um, dois: null };
	const Ea = T2.eleitoradoApurado;
	const comp2 = T2.comparecimento / 100;
	const por = Object.fromEntries(P.candidatos.map((c) => [c.n, c.votos / Ea]));
	const dois = { [K22]: por[K22], [K13]: por[K13], outros: 0, bn: comp2 - por[K22] - por[K13], abst: 1 - comp2 };
	return { um, dois };
}

const SEG = [
	[K22, () => cor(K22), () => nomeDe(K22)],
	[K13, () => cor(K13), () => nomeDe(K13)],
	["outros", () => "var(--outros)", () => "Outros candidatos"],
	["bn", () => "var(--t2-bn)", () => "Brancos e nulos"],
	["abst", () => "var(--t2-abst)", () => "Abstenção"],
];

function barraComp(rotulo, sub, f) {
	return `<div class="t2-comp-linha"><span class="t2-comp-rot">${rotulo}<small>${sub}</small></span>
    <span class="t2-comp-barra">${SEG.filter(([k]) => f[k] > 0.0005)
			.map(([k, c, nm]) => `<i style="background:${c()};width:${(f[k] * 100).toFixed(2)}%" title="${esc(nm())}: ${pf.format(f[k] * 100)}% do eleitorado"></i>`)
			.join("")}</span></div>`;
}

export function cartaoComparacao(ctx) {
	const { P, e1, pre, encerrada } = ctx;
	const { um, dois } = composicao(e1, P);
	const E2 = P.totais.eleitorado;
	const c1 = Object.fromEntries(e1.cargos.presidente.candidatos.map((c) => [c.n, c]));
	const c2 = Object.fromEntries(P.candidatos.map((c) => [c.n, c]));
	const T1 = e1.cargos.presidente.totais;
	const linhaCand = (n) => {
		const d = dois ? (dois[n] - um[n]) * E2 : null;
		return `<tr style="--c:${cor(n)}"><td><div class="db-pessoa">${foto(c2[n], "db-rosto p")}<span><b>${esc(nomeDe(n))}</b></span></div></td>
      <td class="n">${pf.format(c1[n].pct)}%<small class="t2-bloco">${mi(c1[n].votos)}</small></td>
      <td class="n">${dois ? `${pf.format(c2[n].pct)}%<small class="t2-bloco">${mi(c2[n].votos)}${encerrada ? "" : " parcial"}</small>` : "—"}</td>
      <td class="n">${dois ? `${deltaPp(c2[n].pct - c1[n].pct)}<small class="t2-bloco" title="votos, corrigidos pelo eleitorado de cada turno">${d >= 0 ? "+" : "−"}${mi(Math.abs(d))}</small>` : ""}</td></tr>`;
	};
	const linhaOutra = (rot, v1, v2) =>
		`<tr><td>${rot}</td><td class="n">${v1}</td><td class="n">${v2 ?? "—"}</td><td class="n"></td></tr>`;

	let est = "";
	if (dois) {
		// Saldo líquido em "votos equivalentes" (fração do eleitorado × eleitorado do 2º turno).
		const gF = (dois[K22] - um[K22]) * E2;
		const gL = (dois[K13] - um[K13]) * E2;
		const fonte = (um.outros + um.bn - dois.bn + um.abst - dois.abst) * E2;
		const fatia = (g) => (fonte > 0 ? pf.format((g / fonte) * 100) : "—");
		est = `<div class="t2-est">
      <b>Para onde foram os votos? <span class="t2-tag">estimativa</span></b>
      <p>Em relação ao 1º turno, ${esc(nomeDe(K13))} ${gL >= 0 ? "ganhou" : "perdeu"} ≈ ${mi(Math.abs(gL))} e ${esc(nomeDe(K22))} ${gF >= 0 ? "ganhou" : "perdeu"} ≈ ${mi(Math.abs(gF))} votos. No 1º turno, ${mi(um.outros * E1(e1))} foram para outros candidatos${
				dois.abst < um.abst ? ` e a abstenção caiu de ${pf.format(um.abst * 100)}% para ${pf.format(dois.abst * 100)}%` : ""
			}.</p>
      <div class="t2-comp-barra t2-fonte" role="img" aria-label="Divisão estimada do saldo">
        <i style="background:${cor(K22)};width:${Math.max(0, (gF / fonte) * 100).toFixed(1)}%"></i><i style="background:${cor(K13)};width:${Math.max(0, (gL / fonte) * 100).toFixed(1)}%"></i><i style="background:var(--t2-bn);flex:1"></i>
      </div>
      <p class="t2-leg-est"><span><i class="db-sw" style="background:${cor(K22)}"></i>${esc(nomeDe(K22))} ${fatia(gF)}%</span><span><i class="db-sw" style="background:${cor(K13)}"></i>${esc(nomeDe(K13))} ${fatia(gL)}%</span><span><i class="db-sw" style="background:var(--t2-bn)"></i>branco, nulo ou não votou</span></p>
      <p class="db-sub">Se o saldo de cada um viesse só dos votos de outros candidatos e de quem passou a votar. O TSE não publica transferência de votos: isto é saldo líquido, e eleitores podem ter trocado de lado. ${encerrada ? "" : "Com a apuração parcial, supõe o mesmo comportamento nas seções que faltam."}</p>
    </div>`;
	}

	return `<article class="db-card t2-comp">
    <header class="db-card-topo"><div><h2>Do 1º ao 2º turno</h2><span>Presidente · Brasil · 1º turno real (04/10)</span></div></header>
    <section class="db-sec"><h3>Composição do eleitorado <small>% do eleitorado${dois && !encerrada ? " das seções já apuradas" : ""}</small></h3>
      ${barraComp("1º turno", "final", um)}
      ${dois ? barraComp("2º turno", encerrada ? "final" : `${pf.format(P.apurado)}% apurado`, dois) : `<div class="t2-comp-linha"><span class="t2-comp-rot">2º turno<small>25/10</small></span><span class="db-vazio">aparece com as primeiras seções</span></div>`}
      <p class="t2-leg-est">${SEG.map(([, c, nm]) => `<span><i class="db-sw" style="background:${c()}"></i>${esc(nm())}</span>`).join("")}</p>
    </section>
    <div class="db-rolagem"><table class="db-tab t2-tab-comp">
      <thead><tr><th></th><th class="n">1º turno</th><th class="n">2º turno</th><th class="n" title="Diferença em pontos percentuais dos votos válidos e, embaixo, em votos">Δ</th></tr></thead>
      <tbody>${linhaCand(K22)}${linhaCand(K13)}
        ${linhaOutra("Outros candidatos", `${pf.format(um.outros * 100 * (1 / (T1.validos / T1.eleitorado)))}%<small class="t2-bloco">${mi(um.outros * T1.eleitorado)}</small>`, pre ? null : "—")}
        ${linhaOutra("Brancos e nulos", `${pf.format(T1.brancos + T1.nulos)}%`, dois ? `${pf.format(P.totais.brancos + P.totais.nulos)}%` : null)}
        ${linhaOutra("Abstenção", `${pf.format(T1.abstencao)}%`, dois ? `${pf.format(P.totais.abstencao)}%` : null)}
      </tbody></table></div>
    ${est}
  </article>`;
}
const E1 = (e1) => e1.cargos.presidente.totais.eleitorado;

/* ---------- estados e regiões ---------- */

// Cartograma em grade (col, lin) — não é mapa geográfico, é placar com posição aproximada.
const GRADE = {
	rr: [2, 0], ap: [4, 0],
	am: [1, 1], pa: [3, 1], ma: [4, 1], ce: [5, 1], rn: [6, 1],
	ac: [0, 2], ro: [1, 2], mt: [2, 2], to: [3, 2], pi: [4, 2], pe: [5, 2], pb: [6, 2],
	ms: [2, 3], go: [3, 3], df: [4, 3], ba: [5, 3], al: [6, 3],
	pr: [2, 4], sp: [3, 4], mg: [4, 4], es: [5, 4], se: [6, 4],
	sc: [2, 5], rj: [4, 5],
	rs: [2, 6], zz: [6, 6],
};

function liderUf(u) {
	if (!u.validos) return null;
	const [a, b] = u.candidatos;
	return { n: a.n, m: a.pct - b.pct };
}

export function cartaoEstados(ctx) {
	const { ufs, pre } = ctx;
	const lista = Object.values(ufs);
	const placar = { [K22]: 0, [K13]: 0 };
	const viraram = [];
	const placar1 = { [K22]: 0, [K13]: 0 };
	for (const u of lista) if (u.uf !== "zz") placar1[u.t1.lider]++;
	for (const u of lista) {
		if (u.uf === "zz") continue;
		const l = liderUf(u);
		if (!l) continue;
		placar[l.n]++;
		if (l.n !== u.t1.lider) viraram.push(u);
	}
	const tiles = lista
		.map((u) => {
			const [col, lin] = GRADE[u.uf];
			const l = liderUf(u);
			const virou = l && l.n !== u.t1.lider;
			const alfa = l ? Math.round(30 + Math.min(55, l.m * 2.2)) : 0;
			const tit = l
				? `${u.nome}: ${nomeDe(l.n)} +${pf.format(l.m)} p.p. · ${pf.format(u.apurado)}% apurado · 1º turno: ${nomeDe(u.t1.lider)}${virou ? " · virou" : ""}`
				: `${u.nome}: sem seções apuradas · 1º turno: ${nomeDe(u.t1.lider)}`;
			return `<div class="t2-uf ${virou ? "virou" : ""} ${l ? "" : "vazio"}" style="grid-column:${col + 1};grid-row:${lin + 1};--c:${l ? cor(l.n) : "var(--superficie-2)"};--a:${alfa}%" title="${esc(tit)}" tabindex="0" aria-label="${esc(tit)}">
        <b>${u.uf === "zz" ? "EXT" : u.uf.toUpperCase()}</b><small>${l ? `${l.m < 9.95 ? pf.format(l.m) : Math.round(l.m)}` : "—"}</small>${virou ? "<i>↻</i>" : ""}</div>`;
		})
		.join("");

	const regioes = Object.entries(REGIOES).map(([r, ufsR]) => {
		const us = ufsR.map((x) => ufs[x]);
		const vv = us.reduce((s, u) => s + u.validos, 0);
		const v = (n) => us.reduce((s, u) => s + (u.candidatos.find((c) => c.n === n)?.votos ?? 0), 0);
		const t1 = (n) => us.reduce((s, u) => s + u.t1[n === K22 ? "F" : "L"], 0);
		const S = us.reduce((s, u) => s + u.secoes, 0);
		const Sa = us.reduce((s, u) => s + u.secoesApuradas, 0);
		const lid1 = t1(K22) >= t1(K13) ? K22 : K13;
		const p = (n) => (vv ? (v(n) / vv) * 100 : null);
		const lid2 = vv ? (v(K22) >= v(K13) ? K22 : K13) : null;
		return { r, a: p(K22), b: p(K13), ap: (Sa / S) * 100, lid1, lid2 };
	});
	const linhaReg = (x) =>
		`<tr><td>${x.r}</td><td class="n">${x.a == null ? "—" : pf.format(x.a) + "%"}</td><td class="n">${x.b == null ? "—" : pf.format(x.b) + "%"}</td><td class="n db-oculta-mob">${pf.format(x.ap)}%</td>
      <td><span class="db-sw" style="background:${cor(x.lid1)}"></span>${esc(nomeDe(x.lid1).split(" ")[0])}${x.lid2 && x.lid2 !== x.lid1 ? ' <span class="t2-virou">↻ virou</span>' : ""}</td></tr>`;

	const ordem = [...lista].sort((p, q) => q.eleitorado - p.eleitorado);
	const linhaUf = (u) => {
		const l = liderUf(u);
		const virou = l && l.n !== u.t1.lider;
		const p = (n) => u.candidatos.find((c) => c.n === n)?.pct ?? 0;
		return `<tr data-flip="uf-${u.uf}"><td><b>${u.uf === "zz" ? "Exterior" : u.uf.toUpperCase()}</b> <small class="db-oculta-mob">${esc(u.nome)}</small></td>
      <td class="n">${pf.format(u.apurado)}%</td>
      <td class="n">${l ? pf.format(p(K22)) + "%" : "—"}</td><td class="n">${l ? pf.format(p(K13)) + "%" : "—"}</td>
      <td>${l ? `<span class="db-sw" style="background:${cor(l.n)}"></span>+${pf.format(l.m)}` : ""}</td>
      <td class="db-oculta-mob"><span class="db-sw" style="background:${cor(u.t1.lider)}"></span>${pf.format(Math.abs(u.t1.pf - u.t1.pl))}</td>
      <td>${virou ? '<span class="t2-virou">↻ virou</span>' : ""}</td></tr>`;
	};

	return `<article class="db-card t2-estados">
    <header class="db-card-topo">
      <div><h2>Estados e regiões</h2><span>cor = quem lidera na UF · intensidade = vantagem · ↻ = líder diferente do 1º turno</span></div>
      <div class="t2-placar-uf">${
				pre
					? `<span class="db-vazio">1º turno: ${esc(nomeDe(K22))} ${placar1[K22]} · ${esc(nomeDe(K13))} ${placar1[K13]} UFs</span>`
					: `<span><i class="db-sw" style="background:${cor(K22)}"></i>${esc(nomeDe(K22))} <b>${placar[K22]}</b></span><span><i class="db-sw" style="background:${cor(K13)}"></i>${esc(nomeDe(K13))} <b>${placar[K13]}</b></span><small>UFs lideradas${viraram.length ? ` · ${viraram.length} viraram` : ""}</small>`
			}</div>
    </header>
    <div class="t2-estados-topo">
      <div class="t2-mapa" role="group" aria-label="Placar por UF em grade">${tiles}</div>
      <section class="db-sec"><h3>Por região <small>% dos válidos · líder no 1º turno</small></h3>
        <div class="db-rolagem"><table class="db-tab">
          <thead><tr><th>Região</th><th class="n">${esc(nomeDe(K22).split(" ")[0])}</th><th class="n">${esc(nomeDe(K13))}</th><th class="n db-oculta-mob">Apurado</th><th>1º turno</th></tr></thead>
          <tbody>${regioes.map(linhaReg).join("")}</tbody></table></div>
        ${viraram.length ? `<p class="t2-viraram">↻ Viraram vs 1º turno: ${viraram.map((u) => `<b>${u.uf.toUpperCase()}</b> (${esc(nomeDe(u.t1.lider).split(" ")[0])} → ${esc(nomeDe(liderUf(u).n).split(" ")[0])})`).join(", ")}</p>` : ""}
      </section>
    </div>
    <section class="db-sec"><h3>Todas as UFs <small>da maior para a menor em eleitorado · vantagem em p.p.</small></h3>
      <div class="db-rolagem t2-rolagem-uf"><table class="db-tab">
        <thead><tr><th>UF</th><th class="n">Apurado</th><th class="n">${esc(nomeDe(K22).split(" ")[0])}</th><th class="n">${esc(nomeDe(K13))}</th><th>Vantagem</th><th class="db-oculta-mob">1º turno</th><th></th></tr></thead>
        <tbody>${ordem.map(linhaUf).join("")}</tbody></table></div>
    </section>
  </article>`;
}

/* ---------- exterior ---------- */

export function cartaoExterior(ctx) {
	const { ufs, e1, col, compExterior, pre } = ctx;
	const u = ufs.zz;
	const u1 = e1.ufs.zz;
	const linhas = CANDIDATOS_2T.map((k) => {
		const c = u.candidatos.find((x) => x.n === k.n);
		const p1 = u1.candidatos.find((x) => x.n === k.n).pct;
		return `<li class="db-cand" style="--c:${cor(k.n)}">${foto(k, "db-rosto")}
      <span class="db-nome"><b>${esc(nomeBonito(k.nome))}</b><small>1º turno no exterior: ${pf.format(p1)}%</small>
        ${barraViva(`zz-${k.n}`, pre || !u.validos ? 0 : c.pct, null, 0.3, cor(k.n), "<em></em>")}</span>
      <span class="db-pct">${u.validos ? conta(`t2-zz-${k.n}`, c.pct, "p") : "—"}</span>
      <span class="db-delta">${u.validos ? deltaPp(c.pct - p1) : ""}</span></li>`;
	}).join("");
	const X = col.exterior;
	const comp1 = X.pctComparecimento;
	return `<article class="db-card t2-exterior">
    <header class="db-card-topo">
      <div><h2>Exterior</h2><span>Presidente · eleitores fora do país · Δ vs 1º turno no exterior</span></div>
      <div class="db-apu">${conta("t2-zz-ap", u.apurado, "p")}<small>das seções apuradas</small></div>
    </header>
    <ol class="db-cands">${linhas}</ol>
    <dl class="db-analise t2-mini">
      <div><dt>ELEITORADO</dt><dd>${nf.format(X.eleitorado)}</dd><dd class="db-sub">1º turno · ${nf.format(u1.secoes)} seções</dd></div>
      <div><dt>COMPARECIMENTO</dt><dd>${compExterior ? `${pf.format(compExterior)}%` : "—"}</dd><dd class="db-sub">1º turno: ${pf.format(comp1)}% (abstenção ${pf.format(X.pctAbstencao)}%)</dd></div>
    </dl>
    ${u.validos ? "" : '<p class="db-vazio">O exterior costuma ser o último a apurar: as urnas fecham no fuso de cada país.</p>'}
  </article>`;
}

/* ---------- comparecimento e abstenção ---------- */

export function cartaoComparecimento(ctx) {
	const { P, col, compExterior, encerrada } = ctx;
	const linha = (rot, t1, c2) => {
		const c1 = t1.pctComparecimento;
		const a1 = t1.pctAbstencao;
		return `<tr><td><b>${rot}</b><small class="t2-bloco">${cf.format(t1.eleitorado)} eleitores</small></td>
      <td class="n">${pf.format(c1)}%</td><td class="n">${c2 ? `${pf.format(c2)}%<small class="t2-bloco">${deltaPp(c2 - c1, true)}</small>` : "—"}</td>
      <td class="n">${pf.format(a1)}%<small class="t2-bloco">${cf.format(t1.abstencao)}</small></td><td class="n">${c2 ? `${pf.format(100 - c2)}%<small class="t2-bloco">${deltaPp(100 - c2 - a1, true)}</small>` : "—"}</td></tr>`;
	};
	const c2 = P.totais.comparecimento;
	return `<article class="db-card t2-compar">
    <header class="db-card-topo"><div><h2>Comparecimento e abstenção</h2><span>% do eleitorado · 1º turno real (04/10) × 2º turno${encerrada ? "" : " nas seções apuradas"}</span></div></header>
    <div class="db-rolagem"><table class="db-tab">
      <thead><tr><th></th><th class="n">Compar. 1º</th><th class="n">Compar. 2º</th><th class="n">Abst. 1º</th><th class="n">Abst. 2º</th></tr></thead>
      <tbody>${linha("Brasil", col.brasil, c2)}${linha("Exterior", col.exterior, compExterior)}</tbody></table></div>
    <p class="t2-nota">Δ em p.p. vs 1º turno. Comparecimento por município está em "Maiores colégios eleitorais".</p>
  </article>`;
}

/* ---------- maiores colégios eleitorais ---------- */

export function cartaoColegios(ctx) {
	const { colegios, pre } = ctx;
	const linha = (m) => {
		const l = liderUf(m);
		const virou = l && l.n !== m.t1.lider;
		const p = (n) => m.candidatos.find((c) => c.n === n).pct;
		const m1 = Math.abs(m.t1.pf - m.t1.pl);
		return `<tr data-flip="mun-${m.cd}"><td><b>${esc(m.nome)}</b> <small>${m.uf.toUpperCase()}</small><small class="t2-bloco">${cf.format(m.eleitorado)} eleitores</small></td>
      <td class="n db-oculta-mob">${pf.format(m.apurado)}%</td>
      <td class="n">${l ? pf.format(p(K22)) + "%" : "—"}<small class="t2-bloco">1º: ${pf.format(m.t1.pf)}%</small></td>
      <td class="n">${l ? pf.format(p(K13)) + "%" : "—"}<small class="t2-bloco">1º: ${pf.format(m.t1.pl)}%</small></td>
      <td>${l ? `<span class="db-sw" style="background:${cor(l.n)}"></span>+${pf.format(l.m)}` : "—"}<small class="t2-bloco"><span class="db-sw" style="background:${cor(m.t1.lider)}"></span>1º: +${pf.format(m1)}</small></td>
      <td class="n db-oculta-mob">${m.comparecimento ? `${pf.format(m.comparecimento)}%` : "—"}<small class="t2-bloco">1º: ${pf.format(m.t1.comparecimento)}%</small></td>
      <td>${virou ? '<span class="t2-virou">↻ virou</span>' : ""}</td></tr>`;
	};
	const soma = colegios.reduce((s, m) => s + m.eleitorado, 0);
	return `<article class="db-card t2-colegios">
    <header class="db-card-topo">
      <div><h2>Maiores colégios eleitorais</h2><span>os 10 municípios com mais eleitores · ${cf.format(soma)} eleitores, ${pf.format((soma / ctx.col.brasil.eleitorado) * 100)}% do país · ↻ = líder diferente do 1º turno</span></div>
    </header>
    <div class="db-rolagem"><table class="db-tab t2-tab-mun">
      <thead><tr><th>Município</th><th class="n db-oculta-mob">Apurado</th><th class="n">${esc(nomeDe(K22).split(" ")[0])}</th><th class="n">${esc(nomeDe(K13))}</th><th>Vantagem</th><th class="n db-oculta-mob">Comparec.</th><th></th></tr></thead>
      <tbody>${colegios.map(linha).join("")}</tbody></table></div>
    ${pre ? '<p class="t2-nota">Antes das 17h: só o 1º turno (real, TSE). Os números do 2º turno aparecem com as primeiras seções.</p>' : ""}
  </article>`;
}

/* ---------- destaques ---------- */

export function destaques2t(ctx) {
	const { P, ufs, colegios, viradas, pre, encerrada } = ctx;
	if (pre) {
		return [
			"<b>2º turno · 25/10</b>Flavio Bolsonaro (PL) × Lula (PT) para Presidente",
			"<b>Apuração</b>primeiros resultados a partir das 17h (horário de Brasília)",
			"<b>1º turno</b>Flavio Bolsonaro 47,03% × Lula 45,16% · liderou em 15 UFs, Lula em 12",
			"<b>Maior colégio</b>São Paulo, 9,1 milhões de eleitores · no 1º turno: Lula 46,58% × Flavio Bolsonaro 42,13%",
			"<b>Exterior</b>916.534 eleitores fora do país · comparecimento de 37,31% no 1º turno",
			"<b>Eleitorado</b>150,2 milhões aptos no arquivo oficial do 2º turno",
		];
	}
	const it = [];
	const lider = P.candidatos[0];
	it.push(`<b>Presidente · Brasil</b>${esc(nomeDe(lider.n))} ${encerrada ? "eleito com" : "lidera com"} ${pf.format(lider.pct)}% · ${pf.format(P.apurado)}% das seções`);
	for (const [r, us] of Object.entries(REGIOES)) {
		const vv = us.reduce((s, u) => s + ufs[u].validos, 0);
		if (!vv) continue;
		const v = (n) => us.reduce((s, u) => s + ufs[u].candidatos.find((c) => c.n === n).votos, 0);
		const [a, b] = [K22, K13].sort((x, y) => v(y) - v(x));
		it.push(`<b>Presidente · ${r}</b>${esc(nomeDe(a))} ${pf.format((v(a) / vv) * 100)}% × ${esc(nomeDe(b))} ${pf.format((v(b) / vv) * 100)}%`);
	}
	const comVoto = Object.values(ufs).filter((u) => u.uf !== "zz" && u.apurado >= 5);
	const vir = comVoto.filter((u) => liderUf(u).n !== u.t1.lider);
	if (vir.length) it.push(`<b>Viradas vs 1º turno</b>${vir.map((u) => u.nome).join(", ")} mudaram de líder`);
	if (comVoto.length) {
		const ap = [...comVoto].sort((p, q) => liderUf(p).m - liderUf(q).m)[0];
		it.push(`<b>Disputa mais apertada</b>${ap.nome}: ${pf.format(liderUf(ap).m)} p.p. de diferença`);
	}
	if (viradas.length) it.push(`<b>Virada</b>${esc(nomeDe(viradas.at(-1).para))} passou à frente às ${viradas.at(-1).hora.slice(0, 5)}, com ${pf.format(viradas.at(-1).ap)}% apurado`);
	const [sp] = colegios;
	if (sp.validos) it.push(`<b>Maior colégio · ${esc(sp.nome)}</b>${esc(nomeDe(sp.candidatos[0].n))} ${pf.format(sp.candidatos[0].pct)}% × ${esc(nomeDe(sp.candidatos[1].n))} ${pf.format(sp.candidatos[1].pct)}% · ${pf.format(sp.apurado)}% apurado`);
	const zz = ufs.zz;
	if (zz.validos) it.push(`<b>Exterior</b>${esc(nomeDe(zz.candidatos[0].n))} ${pf.format(zz.candidatos[0].pct)}% × ${esc(nomeDe(zz.candidatos[1].n))} ${pf.format(zz.candidatos[1].pct)}% · ${pf.format(zz.apurado)}% apurado`);
	return it;
}
