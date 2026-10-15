/**
 * PROTOTYPE — módulo de PESQUISAS do 2º turno. Descartável; não mergear na main.
 * Pergunta: como a página mostra as pesquisas (1) antes das 17h, (2) ao lado da apuração ao vivo
 * e (3) no "Pesquisas × urnas"? Três desenhos estruturalmente diferentes via ?variant=A|B|C:
 *   A · Placar        — média como placar de duelo, tabela das pesquisas, "Vêm aí" na lateral
 *   B · Linha do tempo — gráfico como herói até 25/10, feed cronológico; ao vivo a média vira marca no placar
 *   C · Por instituto — tabela de institutos (liga/desliga na linha), gráfico ao lado; no fim, ranking
 * Dados reais: 33 registros nacionais do CSV do TSE (15/10) + 5 pesquisas com números da imprensa.
 */
import { CANDIDATOS_2T } from "./mock-2t.js";
import { corD, esc, foto, nf } from "./tela1-util.js";

const cor = (n) => corD("presidente", n);
cor("22");
cor("13");
const F = CANDIDATOS_2T[0];
const L = CANDIDATOS_2T[1];
const p1 = new Intl.NumberFormat("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
const n1 = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 1 });
const ELEICAO = Date.UTC(2026, 9, 25, 20, 0, 0); // 25/10 17h de Brasília

/* ---------- datas ---------- */
const dia = (iso) => Date.UTC(+iso.slice(0, 4), +iso.slice(5, 7) - 1, +iso.slice(8, 10)) / 864e5;
const iso = (d) => new Date(d * 864e5).toISOString().slice(0, 10);
const ddmm = (s) => `${s.slice(8, 10)}/${s.slice(5, 7)}`;
const libEfetiva = (r) => (r.liberacao > r.campoFim ? r.liberacao : r.campoFim);

/* ---------- modelo ---------- */
function mediaEm(pub, d) {
	const desde = iso(dia(d) - 14);
	const ult = new Map();
	for (const p of pub) if (p.data <= d && p.data > desde) ult.set(p.cnpj, p);
	const ps = [...ult.values()];
	if (!ps.length) return null;
	const vf = ps.reduce((s, p) => s + p.vf, 0) / ps.length;
	return { data: d, vf, vl: 100 - vf, v: 2 * vf - 100, n: ps.length, ps };
}

export function modelo(dados) {
	const { hoje, registros, resultados } = dados;
	const pub = registros
		.filter((r) => resultados[r.registro])
		.map((r) => {
			const x = resultados[r.registro];
			const vf = (x.flavio / (x.flavio + x.lula)) * 100;
			return { ...r, ...x, data: r.campoFim, vf, vl: 100 - vf, v: 2 * vf - 100 };
		})
		.sort((a, b) => a.data.localeCompare(b.data) || a.registro.localeCompare(b.registro));
	const serieMedia = [...new Set(pub.map((p) => p.data))].map((d) => mediaEm(pub, d)).filter(Boolean);
	const semNumero = registros.filter((r) => !resultados[r.registro]);
	return {
		hoje,
		pub,
		media: mediaEm(pub, hoje),
		serieMedia,
		vemAi: semNumero.filter((r) => libEfetiva(r) > hoje).sort((a, b) => libEfetiva(a).localeCompare(libEfetiva(b))),
		liberadasSemNumero: semNumero.filter((r) => libEfetiva(r) <= hoje).sort((a, b) => libEfetiva(b).localeCompare(libEfetiva(a))),
		registros,
	};
}

/* ---------- textos compartilhados ---------- */
const lider = (v) => (v >= 0 ? F : L);
// Nome de exibição com acento (o TSE grava "FLAVIO BOLSONARO").
const NOME = { 22: "Flávio Bolsonaro", 13: "Lula" };
const curto = (c) => NOME[c.n].split(" ")[0];
const vant = (v) => `${esc(curto(lider(v)))} +${p1.format(Math.abs(v))}`;

function totais(p) {
	const bn =
		p.brancoNuloNaoSabe != null
			? `branco/nulo/não sabe ${n1.format(p.brancoNuloNaoSabe)}%`
			: `branco/nulo ${n1.format(p.brancoNulo)}% · não sabe ${n1.format(p.naoSabe)}%`;
	return `Flávio ${n1.format(p.flavio)}% · Lula ${n1.format(p.lula)}% · ${bn}`;
}

function ficha(r, comFonte = true) {
	const me = r.margem == null ? "margem não informada" : `margem ±${n1.format(r.margem)} p.p.`;
	const ic = r.confianca == null ? "confiança não informada" : `confiança ${n1.format(r.confianca)}%`;
	return `Registro TSE ${esc(r.registro)} · campo ${ddmm(r.campoInicio)} a ${ddmm(r.campoFim)} · ${nf.format(r.entrevistas)} entrevistas · ${me} · ${ic} · contratante: ${esc(r.contratantes.join(", "))}${
		comFonte && r.fonte ? ` · <a href="${esc(r.fonte)}" target="_blank" rel="noopener">fonte ↗</a>` : ""
	}`;
}

function mini(p, larg = "") {
	return `<span class="pq-mini ${larg}" role="img" aria-label="Flávio ${p1.format(p.vf)}%, Lula ${p1.format(p.vl)}% dos válidos"><i style="--c:${cor("22")};width:${p.vf}%"></i><i style="--c:${cor("13")};width:${p.vl}%"></i><em></em></span>`;
}

function contagem() {
	const ms = Math.max(0, ELEICAO - Date.now());
	const d = Math.floor(ms / 864e5);
	const h = Math.floor((ms % 864e5) / 36e5);
	const m = Math.floor((ms % 36e5) / 6e4);
	return { d, h, m, txt: `${d} dia${d === 1 ? "" : "s"} e ${h} h` };
}

/* ---------- chips (liga/desliga), lembrados no navegador ---------- */
const CHAVE = "pesq-desligados";
export function desligados() {
	try {
		return new Set(JSON.parse(localStorage.getItem(CHAVE) || "[]"));
	} catch {
		return new Set();
	}
}
function salvar(s) {
	try {
		localStorage.setItem(CHAVE, JSON.stringify([...s]));
	} catch {
		/* ignore */
	}
}
function institutosComNumero(m) {
	return [...new Map(m.pub.map((p) => [p.cnpj, p.nome]))];
}
function chips(m) {
	const off = desligados();
	return `<div class="pq-chips" role="group" aria-label="Institutos no gráfico">${institutosComNumero(m)
		.map(([cnpj, nome]) => `<button type="button" class="pq-chip" data-cnpj="${cnpj}" aria-pressed="${!off.has(cnpj)}">${esc(nome)}</button>`)
		.join("")}<span class="pq-chip pq-chip-media" title="A média fica sempre visível">━ média</span></div>`;
}

/* ---------- gráfico de vantagem (um só, SVG sem biblioteca) ---------- */
function pintarGrafico(el, m, { ate25 = false, alto = 250 } = {}) {
	if (!el) return;
	const off = desligados();
	const W = Math.max(280, Math.floor(el.clientWidth || 320));
	const H = alto;
	const mg = { t: 18, r: 58, b: 26, l: 30 };
	const pw = W - mg.l - mg.r;
	const ph = H - mg.t - mg.b;
	const x0 = dia(m.pub[0].data) - 2;
	const x1 = ate25 ? dia("2026-10-25") : Math.max(dia(m.hoje), dia(m.pub.at(-1).data)) + 1;
	const X = (d) => mg.l + ((d - x0) / (x1 - x0)) * pw;
	const maxAbs = Math.max(4, ...m.pub.map((p) => Math.abs(p.v)));
	const passo = [1, 2, 5, 10].find((s) => (maxAbs * 1.15) / s <= 3) ?? 10;
	const lim = Math.ceil((maxAbs * 1.15) / passo) * passo;
	const Y = (v) => mg.t + (1 - (v + lim) / (2 * lim)) * ph;
	const pX = (p) => X(dia(p.data));

	let grade = "";
	for (let v = -lim; v <= lim + 1e-9; v += passo)
		grade += `<line class="g" x1="${mg.l}" x2="${W - mg.r}" y1="${Y(v)}" y2="${Y(v)}"/><text class="t" x="${mg.l - 6}" y="${Y(v) + 4}" text-anchor="end">${v ? Math.abs(v) : ""}</text>`;
	const k = Math.max(1, Math.ceil((x1 - x0) / (W < 500 ? 4 : 8)));
	for (let d = x0 + 1; d <= x1; d += k) grade += `<text class="t" x="${X(d)}" y="${H - 7}" text-anchor="middle">${ddmm(iso(d))}</text>`;
	const zero = `<line class="ref" x1="${mg.l}" x2="${W - mg.r}" y1="${Y(0)}" y2="${Y(0)}"/><text class="t" x="${W - mg.r + 6}" y="${Y(0) + 4}">empate</text>`;
	const rot = `<text class="t" x="${mg.l + 6}" y="${mg.t + 12}">▲ Flávio à frente</text><text class="t" x="${mg.l + 6}" y="${mg.t + ph - 6}">▼ Lula à frente</text>`;

	const hojeX = X(dia(m.hoje));
	let futuro = `<line class="pq-hoje" x1="${hojeX}" x2="${hojeX}" y1="${mg.t}" y2="${mg.t + ph}"/><text class="t" x="${hojeX + 4}" y="${mg.t + 12}">hoje</text>`;
	if (ate25) {
		const c = contagem();
		futuro =
			`<rect class="t2-falta" x="${hojeX}" y="${mg.t}" width="${X(x1) - hojeX}" height="${ph}"/>` +
			futuro +
			`<line class="pq-dia" x1="${X(x1)}" x2="${X(x1)}" y1="${mg.t}" y2="${mg.t + ph}"/><text class="v" x="${X(x1) + 4}" y="${mg.t + 12}">25/10</text><text class="t" x="${X(x1) + 4}" y="${mg.t + 26}">2º turno</text>` +
			`<text class="t" x="${(hojeX + X(x1)) / 2}" y="${mg.t + ph - 6}" text-anchor="middle">faltam ${c.d} dias</text>` +
			m.vemAi
				.map((r, i) => `<circle class="pq-vem" cx="${X(dia(libEfetiva(r)))}" cy="${Y(0) + ((i % 3) - 1) * 7}" r="3.5"><title>${esc(r.nome)} · liberada em ${ddmm(libEfetiva(r))}</title></circle>`)
				.join("");
	}

	const porInst = new Map();
	for (const p of m.pub) if (!off.has(p.cnpj)) porInst.set(p.cnpj, [...(porInst.get(p.cnpj) ?? []), p]);
	const linhasInst = [...porInst.values()]
		.filter((ps) => ps.length > 1)
		.map((ps) => `<path class="pq-inst" data-cnpj="${ps[0].cnpj}" d="${ps.map((p, i) => `${i ? "L" : "M"}${pX(p).toFixed(1)},${Y(p.v).toFixed(1)}`).join("")}"/>`)
		.join("");
	const pontos = [...porInst.values()]
		.flat()
		.map((p) => `<circle class="pt pq-pt" data-cnpj="${p.cnpj}" cx="${pX(p)}" cy="${Y(p.v)}" r="4.5" fill="${cor(p.v >= 0 ? "22" : "13")}"/>`)
		.join("");
	const dM = m.serieMedia.map((s, i) => `${i ? "L" : "M"}${X(dia(s.data)).toFixed(1)},${Y(s.v).toFixed(1)}`).join("");
	const clipId = `pq-c${Math.random().toString(36).slice(2, 7)}`;
	const media = ["cima", "baixo"]
		.map((lado, i) => `<g clip-path="url(#${clipId}-${lado})"><path class="pq-media" d="${dM}" stroke="${cor(i ? "13" : "22")}"/></g>`)
		.join("");
	const ult = m.serieMedia.at(-1);
	const rotMedia = `<text class="v" x="${X(dia(ult.data)) + 8}" y="${Y(ult.v) + 4}">média ${p1.format(Math.abs(ult.v))}</text>`;

	el.innerHTML = `<svg width="${W}" height="${H}" role="img" aria-label="Vantagem em p.p. nas pesquisas, por data de fim do campo">
    <defs><clipPath id="${clipId}-cima"><rect x="0" y="0" width="${W}" height="${Y(0)}"/></clipPath><clipPath id="${clipId}-baixo"><rect x="0" y="${Y(0)}" width="${W}" height="${H}"/></clipPath></defs>
    ${futuro}${grade}<line class="eixo" x1="${mg.l}" x2="${W - mg.r}" y1="${mg.t + ph}" y2="${mg.t + ph}"/>${zero}${rot}
    ${linhasInst}${media}${pontos}${rotMedia}
    <rect class="hit" x="${mg.l}" y="${mg.t}" width="${pw}" height="${ph}"/></svg><div class="db-tip pq-tip" hidden></div>`;

	const svg = el.querySelector("svg");
	const tip = el.querySelector(".db-tip");
	const visiveis = [...porInst.values()].flat();
	svg.querySelector(".hit").addEventListener("pointermove", (e) => {
		const r = svg.getBoundingClientRect();
		const mx = e.clientX - r.left;
		const my = e.clientY - r.top;
		const p = visiveis.reduce((q, s) => (Math.hypot(pX(s) - mx, Y(s.v) - my) < Math.hypot(pX(q) - mx, Y(q.v) - my) ? s : q), visiveis[0]);
		if (!p) return;
		for (const c of svg.querySelectorAll(".pq-pt, .pq-inst")) c.classList.toggle("foco", c.dataset.cnpj === p.cnpj);
		const md = m.serieMedia.filter((s) => s.data <= p.data).at(-1);
		tip.innerHTML =
			`<b>${esc(p.nome)} · campo até ${ddmm(p.data)}</b>` +
			`<div><i style="background:${cor("22")}"></i>Flávio<span>${p1.format(p.vf)}%</span></div>` +
			`<div><i style="background:${cor("13")}"></i>Lula<span>${p1.format(p.vl)}%</span></div>` +
			`<div>vantagem<span>${vant(p.v)}</span></div>` +
			(md ? `<div>média em ${ddmm(md.data)}<span>${vant(md.v)}</span></div>` : "") +
			`<p class="pq-tip-ficha">${esc(totais(p))}<br>${ficha(p, false)}</p>`;
		tip.hidden = false;
		tip.style.left = `${Math.max(0, Math.min(pX(p) + 12, r.width - tip.offsetWidth))}px`;
		tip.style.top = `${mg.t}px`;
	});
	svg.querySelector(".hit").addEventListener("pointerleave", () => {
		tip.hidden = true;
		for (const c of svg.querySelectorAll(".foco")) c.classList.remove("foco");
	});
}

/** Liga os chips (qualquer [data-cnpj] com aria-pressed) e pinta os gráficos da página. */
export function depois(m) {
	const pintar = () => {
		for (const el of document.querySelectorAll("[data-pq-graf]")) pintarGrafico(el, m, { ate25: el.dataset.pqGraf === "ate25", alto: +el.dataset.alto || 250 });
	};
	pintar();
	document.addEventListener("click", (e) => {
		const b = e.target.closest("button[data-cnpj]");
		if (!b) return;
		const off = desligados();
		off.has(b.dataset.cnpj) ? off.delete(b.dataset.cnpj) : off.add(b.dataset.cnpj);
		salvar(off);
		for (const x of document.querySelectorAll(`button[data-cnpj="${b.dataset.cnpj}"]`)) x.setAttribute("aria-pressed", String(!off.has(b.dataset.cnpj)));
		pintar();
	});
	let t;
	addEventListener("resize", () => {
		clearTimeout(t);
		t = setTimeout(pintar, 150);
	});
	const relogio = document.querySelector("[data-pq-contagem]");
	if (relogio)
		setInterval(() => {
			const c = contagem();
			relogio.innerHTML = `${c.d}<small>d</small> ${String(c.h).padStart(2, "0")}<small>h</small> ${String(c.m).padStart(2, "0")}<small>min</small>`;
		}, 30_000);
}

/* ---------- peças de lista ---------- */
function linhaVemAi(r, liberada) {
	return `<li><span class="pq-data">${ddmm(libEfetiva(r))}</span><span><b>${esc(r.nome)}</b> <small>${esc(r.contratantes.join(", "))}</small>
    <small class="t2-bloco">campo ${ddmm(r.campoInicio)} a ${ddmm(r.campoFim)} · ${nf.format(r.entrevistas)} entrevistas · ${esc(r.registro)}${liberada ? " · <em>liberada, números ainda não cadastrados</em>" : ""}</small></span></li>`;
}

function relogioHtml() {
	const c = contagem();
	return `<b class="pq-relogio" data-pq-contagem>${c.d}<small>d</small> ${String(c.h).padStart(2, "0")}<small>h</small> ${String(c.m).padStart(2, "0")}<small>min</small></b>`;
}

function ladoMedia(c, pct, eLider, n) {
	return `<div class="t2-lado ${eLider ? "lider" : ""}" style="--c:${cor(c.n)}">
      <div class="t2-quem">${foto(c, "db-rosto t2-rosto")}<span class="db-nome"><b>${esc(NOME[c.n])}</b><small>${esc(c.partido)} · ${c.n}</small></span></div>
      <b class="db-heroi">${p1.format(pct)}%</b><span class="t2-votos">dos válidos · média de ${n} institutos</span></div>`;
}

/* =================================================================
 * A · PLACAR — a média vira um placar de duelo; tabela e "Vêm aí" na lateral
 * ================================================================= */
const A = {
	pre(m) {
		const md = m.media;
		const c = contagem();
		const kpi = (rot, val, sub) => `<div class="db-kpi"><span class="db-kpi-rot">${rot}</span><b class="db-kpi-val">${val}</b><span class="db-kpi-sub">${sub}</span></div>`;
		const linhas = [...m.pub]
			.reverse()
			.map(
				(p) => `<tr><td><b>${esc(p.nome)}</b><small class="t2-bloco">${esc(p.contratantes.join(", "))}</small></td>
          <td class="db-oculta-mob">${ddmm(p.campoInicio)}–${ddmm(p.campoFim)}</td>
          <td class="n">${n1.format(p.flavio)}%</td><td class="n">${n1.format(p.lula)}%</td>
          <td class="n db-oculta-mob">${p.brancoNuloNaoSabe != null ? `${n1.format(p.brancoNuloNaoSabe)}%<small class="t2-bloco">br/nulo/NS</small>` : `${n1.format(p.brancoNulo)}%<small class="t2-bloco">NS ${n1.format(p.naoSabe)}%</small>`}</td>
          <td>${mini(p)}<small class="t2-bloco">${p1.format(p.vf)} × ${p1.format(p.vl)}${p.validosFlavio != null ? ` · publ. ${n1.format(p.validosFlavio)} × ${n1.format(p.validosLula)}` : ""}</small></td>
          <td><span class="db-sw" style="background:${cor(lider(p.v).n)}"></span>${vant(p.v)}</td></tr>
          <tr class="pq-ficha-linha"><td colspan="7">${ficha(p)}</td></tr>`,
			)
			.join("");
		return `<section class="db-kpis pq-kpis">
        ${kpi("Média · Flávio", `${p1.format(md.vf)}%`, "dos válidos")}
        ${kpi("Média · Lula", `${p1.format(md.vl)}%`, "dos válidos")}
        ${kpi("Vantagem na média", `${p1.format(Math.abs(md.v))} p.p.`, `${esc(curto(lider(md.v)))} à frente · ${md.n} institutos`)}
        ${kpi("Pesquisas", `${m.pub.length}`, `publicadas · ${m.registros.length} registradas no TSE`)}
        ${kpi("Até a eleição", relogioHtml(), "25/10, 17h · horário de Brasília")}
      </section>
      <div class="t2-grade pq-grade">
        <article class="db-card pq-a-principal">
          <header class="db-card-topo"><div><h2>Pesquisas · 2º turno</h2><span>média simples da última pesquisa de cada instituto com campo nos últimos 14 dias · votos válidos</span></div>
            <div class="db-apu">${md.n}<small>institutos na média</small></div></header>
          <div class="t2-placar">${ladoMedia(F, md.vf, md.v >= 0, md.n)}<div class="t2-meio"><small>vantagem</small><b>${p1.format(Math.abs(md.v))}</b><small>p.p.</small></div>${ladoMedia(L, md.vl, md.v < 0, md.n)}</div>
          <div class="t2-cabo"><i style="--c:${cor("22")};width:${md.vf}%"></i><i style="--c:${cor("13")};width:${md.vl}%"></i><em></em></div>
          <p class="t2-frase"><b>${esc(curto(lider(md.v)))} à frente</b> por ${p1.format(Math.abs(md.v))} p.p. na média de ${md.ps.map((p) => esc(p.nome)).join(", ")}. Faltam ${c.txt} para a eleição.</p>
          <figure class="db-fig"><figcaption><span>Vantagem em p.p. dos válidos, por data de fim do campo</span>${chips(m)}</figcaption>
            <div class="db-graf" data-pq-graf data-alto="250"></div></figure>
          <section class="db-sec"><h3>Pesquisas publicadas <small>mais recente primeiro · totais como o instituto divulgou</small></h3>
            <div class="db-rolagem"><table class="db-tab pq-tab">
              <thead><tr><th>Instituto</th><th class="db-oculta-mob">Campo</th><th class="n">Flávio</th><th class="n">Lula</th><th class="n db-oculta-mob">Br/nulo</th><th>Válidos</th><th>Vantagem</th></tr></thead>
              <tbody>${linhas}</tbody></table></div></section>
        </article>
        <article class="db-card pq-a-vem">
          <header class="db-card-topo"><div><h2>Vêm aí</h2><span>registradas no TSE · data a partir da qual podem ser divulgadas</span></div></header>
          <ol class="pq-vem-lista">${m.vemAi.map((r) => linhaVemAi(r)).join("")}</ol>
          <section class="db-sec"><h3>Já liberadas <small>números ainda não cadastrados</small></h3>
            <ol class="pq-vem-lista pq-apagada">${m.liberadasSemNumero.map((r) => linhaVemAi(r, true)).join("")}</ol></section>
        </article>
      </div>`;
	},
	aoVivo(m, P) {
		const md = m.media;
		const urna = P.candidatos.find((c) => c.n === "22").pct;
		return `<article class="db-card pq-a-vivo">
      <header class="db-card-topo"><div><h2>O que as pesquisas diziam</h2><span>média final · ${md.n} institutos · válidos</span></div></header>
      <ul class="pq-comp">
        <li><span>Pesquisas</span>${mini(md, "larga")}<b>${p1.format(md.vf)} × ${p1.format(md.vl)}</b></li>
        <li><span>Urna · ${p1.format(P.apurado)}%</span>${mini({ vf: urna, vl: 100 - urna }, "larga")}<b>${p1.format(urna)} × ${p1.format(100 - urna)}</b></li>
      </ul>
      <p class="t2-nota">Diferença agora: Flávio ${urna >= md.vf ? "acima" : "abaixo"} da média em ${p1.format(Math.abs(urna - md.vf))} p.p. A apuração parcial não representa o país inteiro.</p>
    </article>`;
	},
	encerrado(m, P) {
		return `<article class="db-card pq-a-vivo">
      <header class="db-card-topo"><div><h2>Pesquisas × urnas</h2><span>erro na vantagem, em p.p. · última pesquisa de cada instituto</span></div></header>
      ${tabelaErro(m, P, false)}
    </article>`;
	},
};

function errosPorInstituto(m, P) {
	const urnaV = P.candidatos.find((c) => c.n === "22").pct - P.candidatos.find((c) => c.n === "13").pct;
	const ult = [...new Map(m.pub.map((p) => [p.cnpj, p])).values()];
	const linhas = ult.map((p) => ({ p, erro: p.v - urnaV, acertou: Math.sign(p.v) === Math.sign(urnaV) })).sort((a, b) => Math.abs(a.erro) - Math.abs(b.erro));
	return { urnaV, linhas, mediaErro: m.media.v - urnaV };
}

function tabelaErro(m, P, ranking) {
	const { urnaV, linhas, mediaErro } = errosPorInstituto(m, P);
	return `<p class="t2-frase">Resultado: <b>${vant(urnaV)}</b>. A média das pesquisas dava <b>${vant(m.media.v)}</b>, erro de ${p1.format(Math.abs(mediaErro))} p.p.</p>
    <div class="db-rolagem"><table class="db-tab"><thead><tr>${ranking ? "<th>#</th>" : ""}<th>Instituto</th><th>Previu</th><th class="n">Erro</th><th>Vencedor</th></tr></thead><tbody>
    ${linhas
			.map(
				(x, i) => `<tr>${ranking ? `<td>${i + 1}º</td>` : ""}<td><b>${esc(x.p.nome)}</b><small class="t2-bloco">campo até ${ddmm(x.p.data)}</small></td><td>${vant(x.p.v)}</td>
      <td class="n">${p1.format(Math.abs(x.erro))}</td><td>${x.acertou ? "✓ acertou" : "✗ errou"}</td></tr>`,
			)
			.join("")}
    <tr class="pq-media-linha">${ranking ? "<td></td>" : ""}<td><b>Média</b></td><td>${vant(m.media.v)}</td><td class="n">${p1.format(Math.abs(mediaErro))}</td><td>${Math.sign(m.media.v) === Math.sign(urnaV) ? "✓ acertou" : "✗ errou"}</td></tr>
    </tbody></table></div>`;
}

/* =================================================================
 * B · LINHA DO TEMPO — gráfico herói até 25/10, feed cronológico; ao vivo a média vira marca no placar
 * ================================================================= */
const B = {
	pre(m) {
		const md = m.media;
		const futuras = [...m.vemAi].reverse().map(
			(r) => `<li class="pq-fut"><span class="pq-data">${ddmm(libEfetiva(r))}</span><span class="pq-marco"></span>
        <div><b>${esc(r.nome)}</b> <small>vem aí · ${esc(r.contratantes.join(", "))}</small><p class="pq-ficha">campo ${ddmm(r.campoInicio)} a ${ddmm(r.campoFim)} · ${nf.format(r.entrevistas)} entrevistas · ${esc(r.registro)}</p></div></li>`,
		);
		const passadas = [...m.pub.map((p) => ({ p, d: libEfetiva(p) })), ...m.liberadasSemNumero.map((r) => ({ r, d: libEfetiva(r) }))]
			.sort((a, b) => b.d.localeCompare(a.d))
			.map(({ p, r, d }) =>
				p
					? `<li><span class="pq-data">${ddmm(d)}</span><span class="pq-marco cheio" style="--c:${cor(lider(p.v).n)}"></span>
              <div><b>${esc(p.nome)}</b> <small>${esc(p.contratantes.join(", "))}</small>
                <div class="pq-b-linha"><b style="color:var(--tinta)">${p1.format(p.vf)}</b>${mini(p, "larga")}<b>${p1.format(p.vl)}</b><span class="pq-vant">${vant(p.v)}</span></div>
                <p class="pq-ficha">${esc(totais(p))}<br>${ficha(p)}</p></div></li>`
					: `<li class="pq-apagada"><span class="pq-data">${ddmm(d)}</span><span class="pq-marco"></span>
              <div><b>${esc(r.nome)}</b> <small>liberada · números ainda não cadastrados</small><p class="pq-ficha">${esc(r.registro)} · campo ${ddmm(r.campoInicio)} a ${ddmm(r.campoFim)}</p></div></li>`,
			);
		return `<article class="db-card pq-b-heroi">
        <header class="db-card-topo"><div><h2>Pesquisas · 2º turno</h2><span>vantagem em p.p. dos válidos · cada ponto é uma pesquisa registrada no TSE</span></div>
          <div class="db-apu">${relogioHtml()}<small>até 25/10, 17h</small></div></header>
        <p class="pq-manchete"><span style="--c:${cor("22")}">Flávio ${p1.format(md.vf)}%</span> × <span style="--c:${cor("13")}">Lula ${p1.format(md.vl)}%</span>
          <small>na média de ${md.n} institutos (últimos 14 dias) · ${esc(curto(lider(md.v)))} ${p1.format(Math.abs(md.v))} p.p. à frente</small></p>
        ${chips(m)}
        <div class="db-graf" data-pq-graf="ate25" data-alto="320"></div>
      </article>
      <article class="db-card pq-b-feed">
        <header class="db-card-topo"><div><h2>Linha do tempo</h2><span>da eleição para trás · vazado = registrada, ainda não divulgada</span></div></header>
        <ol class="pq-tempo">
          <li class="pq-fut pq-eleicao"><span class="pq-data">25/10</span><span class="pq-marco"></span><div><b>2º turno</b> <small>apuração a partir das 17h</small></div></li>
          ${futuras.join("")}
          <li class="pq-hoje-linha"><span class="pq-data">hoje</span><span></span><div>${ddmm(m.hoje)}</div></li>
          ${passadas.join("")}
        </ol>
      </article>`;
	},
	/** Ao vivo não há cartão: a média vira marca no cabo de guerra e linha no gráfico da apuração. */
	aoVivo() {
		return "";
	},
	marcar(m) {
		const cabo = document.querySelector(".t2-duelo .t2-cabo");
		if (!cabo) return;
		cabo.insertAdjacentHTML("afterend", `<div class="pq-b-regua"><span class="pq-b-marca" style="left:${m.media.vf}%">▲ média das pesquisas · Flávio ${p1.format(m.media.vf)}%</span></div>`);
	},
	refMargem(m) {
		return { v: m.media.v, rotulo: `pesquisas ${p1.format(Math.abs(m.media.v))}` };
	},
	encerrado(m, P) {
		const { urnaV, linhas, mediaErro } = errosPorInstituto(m, P);
		const lim = 10;
		const Xp = (v) => 50 + (v / lim) * 50;
		const fila = (rot, v, extra = "") =>
			`<li><span class="pq-nome">${rot}</span><span class="pq-trilho"><i class="pq-urna" style="left:${Xp(urnaV)}%"></i><b class="pq-ponto ${extra}" style="left:${Xp(v)}%;--c:${cor(lider(v).n)}"></b></span><span class="pq-erro">${p1.format(Math.abs(v - urnaV))}</span></li>`;
		return `<article class="db-card pq-b-fim">
      <header class="db-card-topo"><div><h2>Pesquisas × urnas</h2><span>onde cada instituto colocou a vantagem (ponto) e onde a urna colocou (linha) · erro em p.p.</span></div>
        <div class="db-apu">${p1.format(Math.abs(mediaErro))} p.p.<small>erro da média</small></div></header>
      <div class="pq-escala"><span>Lula +10</span><span>empate</span><span>Flávio +10</span></div>
      <ol class="pq-faixas">${fila("<b>Média</b>", m.media.v, "grande")}${linhas.map((x) => fila(esc(x.p.nome), x.p.v)).join("")}</ol>
      <p class="t2-nota">Linha vertical = resultado da urna (${vant(urnaV)}). Pesquisa mede o momento do campo, não prevê o resultado.</p>
    </article>`;
	},
};

/* =================================================================
 * C · POR INSTITUTO — a tabela de institutos é o controle do gráfico; no fim, ranking
 * ================================================================= */
const C = {
	pre(m) {
		const md = m.media;
		const off = desligados();
		const nomes = new Map(m.registros.map((r) => [r.cnpj, r.nome]));
		const linhas = [...nomes]
			.map(([cnpj, nome]) => {
				const ps = m.pub.filter((p) => p.cnpj === cnpj);
				const ult = ps.at(-1);
				const prox = m.vemAi.find((r) => r.cnpj === cnpj);
				const regs = m.registros.filter((r) => r.cnpj === cnpj);
				return { cnpj, nome, ps, ult, prox, regs };
			})
			.sort((a, b) => (b.ult ? 1 : 0) - (a.ult ? 1 : 0) || (b.ult?.data ?? "").localeCompare(a.ult?.data ?? "") || a.nome.localeCompare(b.nome))
			.map(
				(x) => `<tr class="${x.ult ? "" : "pq-apagada"}">
          <td>${x.ult ? `<button type="button" class="pq-chip pq-chip-mini" data-cnpj="${x.cnpj}" aria-pressed="${!off.has(x.cnpj)}" aria-label="Mostrar ${esc(x.nome)} no gráfico"></button>` : ""}</td>
          <td><details><summary><b>${esc(x.nome)}</b> <small>${x.regs.length} registro${x.regs.length > 1 ? "s" : ""}</small></summary>
            <ul class="pq-hist">${x.regs
							.map((r) => {
								const p = m.pub.find((q) => q.registro === r.registro);
								return `<li>${p ? `<b>${p1.format(p.vf)} × ${p1.format(p.vl)}</b> · ${esc(totais(p))}<br>` : `<em>${libEfetiva(r) > m.hoje ? `libera em ${ddmm(libEfetiva(r))}` : "liberada, sem números"}</em><br>`}${ficha({ ...r, fonte: p?.fonte })}</li>`;
							})
							.join("")}</ul></details></td>
          <td>${x.ult ? `${mini(x.ult)}<small class="t2-bloco">${p1.format(x.ult.vf)} × ${p1.format(x.ult.vl)} · campo até ${ddmm(x.ult.data)}</small>` : '<span class="db-vazio">sem números ainda</span>'}</td>
          <td>${x.ult ? `<span class="db-sw" style="background:${cor(lider(x.ult.v).n)}"></span>${vant(x.ult.v)}` : "—"}</td>
          <td class="db-oculta-mob">${x.ps.length > 1 ? `<span class="pq-spark">${x.ps.map((p) => `<i style="height:${6 + Math.abs(p.v) * 3}px;background:${cor(lider(p.v).n)}" title="${ddmm(p.data)}: ${vant(p.v)}"></i>`).join("")}</span>` : ""}</td>
          <td class="n">${x.prox ? ddmm(libEfetiva(x.prox)) : "—"}</td></tr>`,
			)
			.join("");
		return `<article class="db-card pq-c-faixa">
        <div class="pq-c-media">${foto(F, "db-rosto")}<b>${p1.format(md.vf)}%</b>${mini(md, "larga")}<b>${p1.format(md.vl)}%</b>${foto(L, "db-rosto")}</div>
        <p><b>Média de ${md.n} institutos</b> · últimos 14 dias · ${esc(curto(lider(md.v)))} +${p1.format(Math.abs(md.v))} p.p.</p>
        <span class="pq-c-relogio">${relogioHtml()}<small>até 25/10, 17h</small></span>
      </article>
      <div class="t2-grade pq-grade">
        <article class="db-card pq-c-tab">
          <header class="db-card-topo"><div><h2>Institutos</h2><span>${nomes.size} institutos com pesquisa nacional registrada no TSE · toque no nome para ver todas · ☑ = aparece no gráfico</span></div></header>
          <div class="db-rolagem"><table class="db-tab pq-tab">
            <thead><tr><th></th><th>Instituto</th><th>Última pesquisa (válidos)</th><th>Vantagem</th><th class="db-oculta-mob">Série</th><th class="n">Próxima</th></tr></thead>
            <tbody>${linhas}</tbody></table></div>
        </article>
        <article class="db-card pq-c-graf">
          <header class="db-card-topo"><div><h2>Vantagem ao longo do tempo</h2><span>média em linha grossa · pontos = pesquisas ligadas na tabela</span></div></header>
          <div class="db-graf" data-pq-graf data-alto="300"></div>
        </article>
      </div>`;
	},
	aoVivo(m, P) {
		const urna = P.candidatos.find((c) => c.n === "22").pct;
		const ult = [...new Map(m.pub.map((p) => [p.cnpj, p])).values()].filter((p) => m.media.ps.includes(p));
		return `<article class="db-card pq-a-vivo">
      <header class="db-card-topo"><div><h2>Pesquisas × apuração parcial</h2><span>Flávio, % dos válidos</span></div></header>
      <div class="db-rolagem"><table class="db-tab"><tbody>
        ${ult.map((p) => `<tr><td>${esc(p.nome)}<small class="t2-bloco">campo até ${ddmm(p.data)}</small></td><td class="n">${p1.format(p.vf)}%</td><td class="n">${dDelta(urna - p.vf)}</td></tr>`).join("")}
        <tr class="pq-media-linha"><td><b>Média</b></td><td class="n">${p1.format(m.media.vf)}%</td><td class="n">${dDelta(urna - m.media.vf)}</td></tr>
        <tr><td><b>Urna</b><small class="t2-bloco">${p1.format(P.apurado)}% apurado</small></td><td class="n"><b>${p1.format(urna)}%</b></td><td></td></tr>
      </tbody></table></div>
      <p class="t2-nota">Δ = urna menos pesquisa. Com apuração parcial, ainda não diz quem errou.</p>
    </article>`;
	},
	encerrado(m, P) {
		return `<article class="db-card pq-a-vivo">
      <header class="db-card-topo"><div><h2>Quem chegou mais perto</h2><span>ranking pelo erro na vantagem · última pesquisa de cada instituto</span></div></header>
      ${tabelaErro(m, P, true)}
    </article>`;
	},
};

function dDelta(v) {
	return `<span class="d">${v >= 0 ? "▲" : "▼"} ${p1.format(Math.abs(v))}</span>`;
}

export const DESENHOS = { A, B, C };
