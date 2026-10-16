/**
 * PROTOTYPE (#16) — a noite da apuração do 2º turno na linguagem A (papel claro, Archivo, lados fixos, cabo de guerra).
 * Dados de apuração SINTÉTICOS (../segundo-turno/js/mock-2t.js sobre o 1º turno real); pesquisas reais de 15/10.
 */
import { gerar, REGIOES } from "../segundo-turno/js/mock-2t.js";
import { carregar, esc, F, L, n1, nf, p1 } from "../novo-design/js/dados.js";

const ESTADOS = { aguardando: ["pre", "Aguardando 17h"], aovivo: ["parcial", "Ao vivo"], virada: ["virada", "Ao vivo · virada"], encerrada: ["encerrado", "Encerrada"] };
const HEROIS = { 1: "Manchete", 2: "Campo cheio" };
const q = new URLSearchParams(location.search);
const estado = ESTADOS[q.get("estado")] ? q.get("estado") : "aovivo";
const heroi = HEROIS[q.get("heroi")] ? q.get("heroi") : "1";
const calmo = matchMedia("(prefers-reduced-motion: reduce)").matches;
const EASE = "cubic-bezier(.2, .8, .2, 1)";

const json = async (u) => (await fetch(u)).json();
const [e1, col, m] = await Promise.all([json("../segundo-turno/dados/estado-1t.json"), json("../segundo-turno/dados/colegios-1t.json"), carregar("../novo-design/dados/pesquisas.json")]);
const { dados, hist, viradas } = gerar(e1, col, ESTADOS[estado][0]);

const pf = new Intl.NumberFormat("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const mi = (v) => (Math.abs(v) >= 1e6 ? `${n1.format(v / 1e6)} ${Math.abs(v) < 2e6 ? "milhão" : "milhões"}` : nf.format(Math.round(v)));
const votos = (v) => `${mi(v)}${Math.abs(v) >= 1e6 ? " de" : ""} votos`;
const pre = estado === "aguardando";
const fim = estado === "encerrada";
const P = dados.cargos.presidente;
const K = { 22: F, 13: L };
const cls = (n) => (n === "22" ? "a-f" : "a-l");
const corVar = (n) => (n === "22" ? "var(--f)" : "var(--l)");
const cand = (n) => P.candidatos.find((c) => c.n === n);
const A = cand("22");
const B = cand("13");
const lid = pre ? null : A.votos >= B.votos ? "22" : "13";
const outro = lid === "22" ? "13" : "22";
const margem = pre ? 0 : Math.abs(A.pct - B.pct);
const urnaV = A.pct - B.pct;
const vF = pre ? 50 : A.pct;
const md = m.media;
const ultVirada = viradas.at(-1);
const viradaRecente = ultVirada && hist.length - hist.findIndex((h) => h.c.presidente.ap >= ultVirada.ap) <= 3;
const T1 = e1.cargos.presidente;
const pct1 = (n) => T1.candidatos.find((c) => c.n === n).pct;

/* ---------- textos ---------- */
const frase = pre
	? `A apuração começa às 17h (horário de Brasília). A média das pesquisas de ${md.n} institutos dá ${K[md.v >= 0 ? "22" : "13"].curto} à frente por ${p1.format(Math.abs(md.v))} pontos.`
	: fim
		? `<b>${K[lid].nome} eleito</b> com ${pf.format(cand(lid).pct)}% dos votos válidos, ${pf.format(margem)} pontos (${votos(cand(lid).votos - cand(outro).votos)}) à frente de ${K[outro].curto}.`
		: `<b>${K[lid].curto} lidera</b> por ${pf.format(margem)} pontos (${votos(cand(lid).votos - cand(outro).votos)}) com ${pf.format(P.apurado)}% das seções apuradas.${viradaRecente ? ` <span class="ap-chip">↻ virada às ${ultVirada.hora.slice(0, 5)}</span>` : ""}`;

const legCabo = pre
	? `A marca ▾ é a média das pesquisas (${F.curto} ${p1.format(md.vf)}, ${L.curto} ${p1.format(md.vl)}). Às 17h a divisa começa a andar com os votos.`
	: fim
		? `A divisa é o resultado final. A marca ▾ é onde a média das pesquisas a colocava: erro de ${pf.format(Math.abs(md.v - urnaV))} pontos na vantagem.`
		: `A divisa é a apuração agora. A marca ▾ é onde a média das pesquisas a colocava (${F.curto} ${p1.format(md.vf)}).`;

const selo = (n) => (pre || n !== lid ? "" : fim ? '<span class="ap-selo eleito">✓ Eleito</span>' : '<span class="ap-selo">lidera</span>');

/* ---------- faixa de status ---------- */
const status = `<div class="ap-status ap-st-${estado}">
  <span class="ap-st-esq"><i class="ap-st-ponto" aria-hidden="true"></i><b>${pre ? "Aguardando 17h" : fim ? "Encerrada" : "Ao vivo"}</b></span>
  <span class="ap-st-meio">${pre ? "Primeiros resultados às 17:00" : `Dados do TSE ${P.hora} · <span data-ha>agora há pouco</span>`}</span>
  <span class="ap-st-dir">${fim ? "<b>Resultado final · 2º turno</b>" : pre ? "" : 'Próxima consulta <b data-prox>40s</b>'}</span>
  ${fim || pre ? "" : '<i class="ap-st-ciclo" data-ciclo></i>'}
</div>`;

/* ---------- herói ---------- */
const marcaPesq = `<span class="ap-pesq" style="left:${md.vf}%" title="Média das pesquisas: ${F.curto} ${p1.format(md.vf)}%, ${L.curto} ${p1.format(md.vl)}%"><i>▾</i></span>`;

function heroi1() {
	const lado = (n, c) => `<span class="${cls(n)} ${lid && n !== lid ? "ap-atras" : ""}"><img class="a-rosto" src="${K[n].foto}" alt="" width="161" height="225">${K[n].curto} <b data-num="${pre ? "" : c.pct}">${pre ? "–" : pf.format(c.pct)}</b>${selo(n)}</span>`;
	return `<header class="a-topo">
    <p class="a-marca">Presidente 2026, 2º turno · apuração de 25 de outubro</p>
    <div class="a-veredito"><h1>${lado("22", A)} <span class="a-x">a</span> ${lado("13", B)}</h1><p>${frase}</p></div>
    <div class="a-conta"><b>${pre ? "17h" : `<span data-num="${P.apurado}">${pf.format(P.apurado)}</span><small>%</small>`}</b><span>${pre ? "primeiros<br>resultados<br>às 17:00" : fim ? "das seções<br>apuradas<br>resultado final" : "das seções<br>apuradas"}</span></div>
    <div class="a-cabo-linha"><img class="a-ponta" src="${F.foto}" alt="" width="161" height="225">
      <div class="ap-cabo-wrap">${marcaPesq}<div class="a-cabo ${pre ? "ap-cabo-pre" : ""}" role="img" aria-label="${pre ? "Apuração ainda não começou" : `${F.curto} ${pf.format(A.pct)}%, ${L.curto} ${pf.format(B.pct)}%`}">
        <i class="a-cabo-f" data-cabo style="width:${vF}%"></i><em class="a-cabo-50"></em></div></div>
      <img class="a-ponta" src="${L.foto}" alt="" width="161" height="225"></div>
    <p class="a-cabo-leg">${legCabo}</p>
  </header>`;
}

function heroi2() {
	const lado = (n, c) => `<div class="ap-campo-${n === "22" ? "f" : "l"}"><img class="ap-campo-rosto" src="${K[n].foto}" alt="" width="161" height="225"><span>${K[n].curto}<b data-num="${pre ? "" : c.pct}">${pre ? "–" : pf.format(c.pct)}</b>${selo(n)}</span></div>`;
	return `<header class="ap-topo2">
    <p class="a-marca">Presidente 2026, 2º turno · apuração de 25 de outubro</p>
    <div class="ap-campo-wrap">${marcaPesq}<div class="ap-campo ${pre ? "ap-campo-pre" : ""}" data-campo style="--vf:${vF}%">${lado("22", A)}${lado("13", B)}<em class="ap-campo-div"></em><i class="ap-campo-50"></i></div></div>
    <div class="ap-linha-ap"><div class="ap-prog" aria-hidden="true"><i style="width:${pre ? 0 : P.apurado}%"></i></div>
      <p>${frase}</p></div>
    <p class="a-cabo-leg">${legCabo}</p>
  </header>`;
}

/* ---------- blocos ---------- */
function analise() {
	const an = dados.analise.majoritarias.presidente;
	if (pre) return "";
	const itens = fim
		? [
				["Comparecimento", `${pf.format(P.totais.comparecimento)}%`, `1º turno: ${pf.format(T1.totais.comparecimento)}%`],
				["Brancos e nulos", `${pf.format(P.totais.brancos + P.totais.nulos)}%`, `1º turno: ${pf.format(T1.totais.brancos + T1.totais.nulos)}%`],
				["Viradas na noite", `${viradas.length}`, viradas.length ? `a última às ${ultVirada.hora.slice(0, 5)}` : "ninguém trocou de lugar"],
			]
		: [
				["Vantagem", votos(an.vantagemVotos), `${pf.format(an.vantagemPp)} pontos`],
				["Válidos a apurar (est.)", `≈ ${mi(an.validosAApurar ?? 0)}`, `${pf.format(100 - P.apurado)}% das seções ainda faltam`],
				["Para virar", an.foraDeAlcance ? "fora de alcance" : `+${pf.format(an.margemParaVirarPp)} pontos`, `${K[outro].curto} precisa disso do que falta`],
			];
	return `<dl class="ap-analise">${itens.map(([t, v, s]) => `<div><dt>${t}</dt><dd>${v}</dd><dd class="ap-sub">${s}</dd></div>`).join("")}</dl>`;
}

function momentos() {
	if (!hist.length) return `<p class="ap-vazio">Nenhuma seção apurada ainda. A 1ª leitura do TSE costuma sair poucos minutos depois das 17h.</p>`;
	const p = (h) => h.c.presidente;
	const ld = (x) => (x.c["22"][0] >= x.c["13"][0] ? "22" : "13");
	const mg = (x) => Math.abs(x.c["22"][1] - x.c["13"][1]);
	const p0 = p(hist[0]);
	const ev = [[p0.hora, p0.ap, `${K[ld(p0)].curto} abre na frente por ${pf.format(mg(p0))} pontos`, ""]];
	let maior = p0;
	for (const h of hist) if (ld(p(h)) === ld(p0) && mg(p(h)) > mg(maior)) maior = p(h);
	if (maior !== p0) ev.push([maior.hora, maior.ap, `maior vantagem de ${K[ld(p0)].curto}: ${pf.format(mg(maior))} pontos`, ""]);
	const meio = hist.find((h) => p(h).ap >= 50);
	if (meio) ev.push([p(meio).hora, p(meio).ap, `metade das seções apuradas, ${K[ld(p(meio))].curto} +${pf.format(mg(p(meio)))}`, ""]);
	for (const v of viradas) ev.push([v.hora, v.ap, `<b>${K[v.para].curto} passa à frente</b> de ${K[v.de].curto}`, "virada"]);
	if (fim) ev.push([P.hora, 100, `<b>${K[lid].curto} eleito</b>, ${pf.format(margem)} pontos de vantagem`, "fim"]);
	ev.sort((x, y) => x[1] - y[1]);
	return `<ol class="ap-momentos">${ev.map(([h, ap, t, c]) => `<li class="${c}"><span class="ap-hora">${h.slice(0, 5)}</span><span class="ap-pct">${pf.format(ap)}%</span><span>${c === "virada" ? "↻ " : c === "fim" ? "✓ " : ""}${t}</span></li>`).join("")}</ol>`;
}

const vant = (v) => `${K[v >= 0 ? "22" : "13"].curto} +${p1.format(Math.abs(v))}`;
function pesquisas() {
	if (fim) {
		const ult = [...new Map(m.pub.map((p) => [p.cnpj, p])).values()]
			.map((p) => ({ p, erro: Math.abs(p.v - urnaV), certo: Math.sign(p.v) === Math.sign(urnaV) }))
			.sort((a, b) => a.erro - b.erro);
		return `<section class="ap-sec"><h2>Pesquisas × urnas</h2>
      <p class="ap-lead">Resultado: <b>${vant(urnaV)}</b>. A média dava <b>${vant(md.v)}</b>, erro de ${p1.format(Math.abs(md.v - urnaV))} pontos.</p>
      <div class="ap-rola"><table class="ap-tab"><thead><tr><th>Instituto</th><th>Previu</th><th class="n">Erro</th><th></th></tr></thead><tbody>
      ${ult.map((x) => `<tr><td><b>${esc(x.p.nome)}</b><small>campo até ${x.p.data.slice(8, 10)}/${x.p.data.slice(5, 7)}</small></td><td>${vant(x.p.v)}</td><td class="n">${p1.format(x.erro)}</td><td>${x.certo ? "✓ acertou" : "✗ errou"}</td></tr>`).join("")}
      </tbody></table></div></section>`;
	}
	return `<section class="ap-sec"><h2>O que as pesquisas diziam</h2>
    <p class="ap-lead">Média de ${md.n} institutos: <b class="a-f">${F.curto} ${p1.format(md.vf)}</b> a <b class="a-l">${L.curto} ${p1.format(md.vl)}</b>, ${vant(md.v)}.</p>
    ${pre ? "" : `<p class="ap-sub">Na urna, agora: ${vant(urnaV)}, com ${pf.format(P.apurado)}% apurado. A comparação justa só vem no fim, porque as urnas não chegam em ordem aleatória.</p>`}
    <p class="ap-sub">A marca ▾ no cabo de guerra é esta média.</p></section>`;
}

function exterior() {
	const u = dados.ufs.zz;
	const u1 = e1.ufs.zz;
	const linhas = ["22", "13"]
		.map((n) => {
			const c = u.candidatos.find((x) => x.n === n);
			const v1 = u1.candidatos.find((x) => x.n === n).pct;
			return `<div class="ap-ext-linha"><span class="${cls(n)}"><img class="a-mini-rosto" src="${K[n].foto}" alt="" width="161" height="225">${K[n].curto}</span>
        <b>${u.validos ? `${pf.format(c.pct)}%` : "–"}</b><span class="ap-barra"><i style="width:${u.validos ? c.pct : 0}%;background:${corVar(n)}"></i></span><small>1º turno: ${pf.format(v1)}%</small></div>`;
		})
		.join("");
	return `<section class="ap-sec"><h2>Exterior <small>${pf.format(u.apurado)}% apurado</small></h2>${linhas}
    <p class="ap-sub">${nf.format(col.exterior.eleitorado)} eleitores fora do país. Comparecimento: ${dados.compExterior ? `${pf.format(dados.compExterior)}%` : "–"} (1º turno: ${pf.format(col.exterior.pctComparecimento)}%).${u.validos ? "" : " O exterior costuma ser o último a apurar: as urnas fecham no fuso de cada país."}</p></section>`;
}

const dpp = (v) => `${v >= 0 ? "+" : "−"}${pf.format(Math.abs(v))}`;
function comparecimento() {
	const c2 = pre ? null : P.totais.comparecimento;
	const linha = (rot, t1, c) => `<tr><td><b>${rot}</b></td><td class="n">${pf.format(t1.pctComparecimento)}%</td><td class="n">${c ? `${pf.format(c)}%<small>${dpp(c - t1.pctComparecimento)}</small>` : "–"}</td><td class="n">${c ? `${pf.format(100 - c)}%` : "–"}<small>1º: ${pf.format(t1.pctAbstencao)}%</small></td></tr>`;
	return `<section class="ap-sec"><h2>Comparecimento</h2>
    <table class="ap-tab"><thead><tr><th></th><th class="n">1º turno</th><th class="n">2º turno</th><th class="n">Abstenção</th></tr></thead>
    <tbody>${linha("Brasil", col.brasil, c2)}${linha("Exterior", col.exterior, dados.compExterior)}</tbody></table>
    ${fim || pre ? "" : '<p class="ap-sub">O 2º turno é o das seções já apuradas.</p>'}</section>`;
}

const GRADE = {
	rr: [2, 0], ap: [4, 0],
	am: [1, 1], pa: [3, 1], ma: [4, 1], ce: [5, 1], rn: [6, 1],
	ac: [0, 2], ro: [1, 2], mt: [2, 2], to: [3, 2], pi: [4, 2], pe: [5, 2], pb: [6, 2],
	ms: [2, 3], go: [3, 3], df: [4, 3], ba: [5, 3], al: [6, 3],
	pr: [2, 4], sp: [3, 4], mg: [4, 4], es: [5, 4], se: [6, 4],
	sc: [2, 5], rj: [4, 5],
	rs: [2, 6], zz: [6, 6],
};
const liderDe = (u) => (u.validos ? { n: u.candidatos[0].n, m: u.candidatos[0].pct - u.candidatos[1].pct } : null);

function estados() {
	const lista = Object.values(dados.ufs);
	const placar = { 22: 0, 13: 0 };
	const viraram = [];
	for (const u of lista) {
		const l = u.uf !== "zz" && liderDe(u);
		if (!l) continue;
		placar[l.n]++;
		if (l.n !== u.t1.lider) viraram.push(u);
	}
	const tiles = lista
		.map((u) => {
			const [c, r] = GRADE[u.uf];
			const l = liderDe(u);
			const virou = l && u.uf !== "zz" && l.n !== u.t1.lider;
			const t = l ? `${u.nome}: ${K[l.n].curto} +${pf.format(l.m)} · ${pf.format(u.apurado)}% apurado · 1º turno: ${K[u.t1.lider].curto}` : `${u.nome}: sem seções apuradas · 1º turno: ${K[u.t1.lider].curto}`;
			return `<div class="ap-uf ${virou ? "virou" : ""} ${l ? "" : "vazio"}" style="grid-column:${c + 1};grid-row:${r + 1};--c:${l ? corVar(l.n) : corVar(u.t1.lider)};--a:${l ? Math.round(28 + Math.min(60, l.m * 2.4)) : 10}%" title="${esc(t)}" tabindex="0" aria-label="${esc(t)}">
        <b>${u.uf === "zz" ? "EXT" : u.uf.toUpperCase()}</b><small>${l ? (l.m < 9.95 ? n1.format(l.m) : Math.round(l.m)) : ""}</small>${virou ? "<i>↻</i>" : ""}</div>`;
		})
		.join("");
	const regs = Object.entries(REGIOES).map(([r, us]) => {
		const xs = us.map((x) => dados.ufs[x]);
		const vv = xs.reduce((s, u) => s + u.validos, 0);
		const v = (n) => xs.reduce((s, u) => s + (u.candidatos.find((c) => c.n === n)?.votos ?? 0), 0);
		const v1 = (n) => xs.reduce((s, u) => s + u.t1[n === "22" ? "F" : "L"], 0);
		const ap = (xs.reduce((s, u) => s + u.secoesApuradas, 0) / xs.reduce((s, u) => s + u.secoes, 0)) * 100;
		const l1 = v1("22") >= v1("13") ? "22" : "13";
		const l2 = vv ? (v("22") >= v("13") ? "22" : "13") : null;
		return `<tr><td><b>${r}</b></td><td class="n">${vv ? `${pf.format((v("22") / vv) * 100)}%` : "–"}</td><td class="n">${vv ? `${pf.format((v("13") / vv) * 100)}%` : "–"}</td><td class="n ap-mob-off">${pf.format(ap)}%</td><td><i class="ap-sw" style="background:${corVar(l1)}"></i>${K[l1].curto}${l2 && l2 !== l1 ? ' <span class="ap-virou">↻ virou</span>' : ""}</td></tr>`;
	});
	const ufs = [...lista].sort((a, b) => b.eleitorado - a.eleitorado).map((u) => {
		const l = liderDe(u);
		const virou = l && u.uf !== "zz" && l.n !== u.t1.lider;
		const p = (n) => u.candidatos.find((c) => c.n === n).pct;
		return `<tr><td><b>${u.uf === "zz" ? "Exterior" : u.uf.toUpperCase()}</b> <small class="ap-mob-off">${esc(u.nome)}</small></td><td class="n">${pf.format(u.apurado)}%</td><td class="n">${l ? `${pf.format(p("22"))}%` : "–"}</td><td class="n">${l ? `${pf.format(p("13"))}%` : "–"}</td>
      <td>${l ? `<i class="ap-sw" style="background:${corVar(l.n)}"></i>+${pf.format(l.m)}` : ""}</td><td class="ap-mob-off"><i class="ap-sw" style="background:${corVar(u.t1.lider)}"></i>${pf.format(Math.abs(u.t1.pf - u.t1.pl))}</td><td>${virou ? '<span class="ap-virou">↻</span>' : ""}</td></tr>`;
	});
	return `<section class="ap-sec ap-cheia"><h2>Estados e regiões</h2>
    <p class="ap-lead">${pre ? `No 1º turno, ${F.curto} liderou em ${lista.filter((u) => u.uf !== "zz" && u.t1.lider === "22").length} UFs e ${L.curto} em ${lista.filter((u) => u.uf !== "zz" && u.t1.lider === "13").length}. O quadro mostra esse 1º turno, apagado, até as primeiras seções.` : `<b class="a-f">${F.curto} ${fim ? "venceu" : "lidera"} em ${placar[22]}</b> UFs e <b class="a-l">${L.curto} em ${placar[13]}</b>${viraram.length ? `. ${viraram.length} ${viraram.length > 1 ? "mudaram" : "mudou"} de líder desde o 1º turno: ${viraram.map((u) => u.uf.toUpperCase()).join(", ")}` : ""}.`}</p>
    <div class="ap-estados">
      <div class="ap-mapa" role="group" aria-label="Quem lidera em cada UF, em grade">${tiles}</div>
      <div><h3>Por região <small>% dos válidos</small></h3><table class="ap-tab"><thead><tr><th></th><th class="n">${F.curto}</th><th class="n">${L.curto}</th><th class="n ap-mob-off">Apurado</th><th>1º turno</th></tr></thead><tbody>${regs.join("")}</tbody></table>
      <p class="ap-sub">Cor = quem lidera; quanto mais forte, maior a vantagem. ↻ = líder diferente do 1º turno.</p></div>
    </div>
    <details class="ap-todas"><summary>Todas as UFs, da maior para a menor</summary>
      <div class="ap-rola ap-rola-alta"><table class="ap-tab"><thead><tr><th>UF</th><th class="n">Apurado</th><th class="n">${F.curto}</th><th class="n">${L.curto}</th><th>Vantagem</th><th class="ap-mob-off">1º turno</th><th></th></tr></thead><tbody>${ufs.join("")}</tbody></table></div></details>
  </section>`;
}

function colegios() {
	const linhas = dados.colegios.map((c) => {
		const l = liderDe(c);
		const virou = l && l.n !== c.t1.lider;
		const p = (n) => c.candidatos.find((x) => x.n === n).pct;
		return `<tr><td><b>${esc(c.nome)}</b> <small>${c.uf.toUpperCase()} · ${mi(c.eleitorado)}</small></td><td class="n ap-mob-off">${pf.format(c.apurado)}%</td>
      <td class="n">${l ? `${pf.format(p("22"))}%` : "–"}<small>1º: ${pf.format(c.t1.pf)}%</small></td><td class="n">${l ? `${pf.format(p("13"))}%` : "–"}<small>1º: ${pf.format(c.t1.pl)}%</small></td>
      <td>${l ? `<i class="ap-sw" style="background:${corVar(l.n)}"></i>+${pf.format(l.m)}` : "–"}</td><td>${virou ? '<span class="ap-virou">↻ virou</span>' : ""}</td></tr>`;
	});
	const soma = dados.colegios.reduce((s, c) => s + c.eleitorado, 0);
	return `<section class="ap-sec ap-cheia"><h2>Maiores colégios eleitorais</h2>
    <p class="ap-lead">Os 10 municípios com mais eleitores somam ${mi(soma)}, ${pf.format((soma / col.brasil.eleitorado) * 100)}% do país.</p>
    <div class="ap-rola"><table class="ap-tab"><thead><tr><th>Município</th><th class="n ap-mob-off">Apurado</th><th class="n">${F.curto}</th><th class="n">${L.curto}</th><th>Vantagem</th><th></th></tr></thead><tbody>${linhas.join("")}</tbody></table></div></section>`;
}

function turnos() {
	const T = T1.totais;
	const E = T.eleitorado;
	const v = (n) => T1.candidatos.find((c) => c.n === n).votos / E;
	const comp1 = T.comparecimento / 100;
	const um = { 22: v("22"), 13: v("13"), outros: (T.validos - v("22") * E - v("13") * E) / E, bn: comp1 * ((T.brancos + T.nulos) / 100), abst: 1 - comp1 };
	let dois = null;
	if (!pre) {
		const Ea = P.totais.eleitoradoApurado;
		const comp2 = P.totais.comparecimento / 100;
		dois = { 22: A.votos / Ea, 13: B.votos / Ea, outros: 0, bn: comp2 - (A.votos + B.votos) / Ea, abst: 1 - comp2 };
	}
	const SEG = [["22", "var(--f)", F.curto], ["13", "var(--l)", L.curto], ["outros", "#9AA3B2", "outros candidatos"], ["bn", "#C9CFD8", "brancos e nulos"], ["abst", "#E3E7ED", "não votou"]];
	const barra = (rot, f) => `<div class="ap-comp"><span>${rot}</span><span class="ap-comp-barra">${SEG.filter(([k]) => f[k] > 5e-4).map(([k, c, nm]) => `<i style="width:${(f[k] * 100).toFixed(2)}%;background:${c}" title="${nm}: ${pf.format(f[k] * 100)}% do eleitorado"></i>`).join("")}</span></div>`;
	const linha = (n) => `<tr><td class="${cls(n)}"><b>${K[n].curto}</b></td><td class="n">${pf.format(pct1(n))}%</td><td class="n">${pre ? "–" : `${pf.format(cand(n).pct)}%`}</td><td class="n">${pre ? "" : dpp(cand(n).pct - pct1(n))}</td></tr>`;
	return `<section class="ap-sec ap-cheia"><h2>Do 1º ao 2º turno</h2>
    <p class="ap-lead">Cada barra é o eleitorado inteiro. No 1º turno, ${pf.format(um.outros * 100)}% dos eleitores votaram em outros candidatos: é por eles, e por quem não votou, que o 2º turno se decide.</p>
    ${barra("1º turno <small>final</small>", um)}${dois ? barra(`2º turno <small>${fim ? "final" : `${pf.format(P.apurado)}% apurado`}</small>`, dois) : '<div class="ap-comp"><span>2º turno</span><span class="ap-vazio">aparece com as primeiras seções</span></div>'}
    <p class="ap-leg">${SEG.map(([, c, nm]) => `<span><i class="ap-sw" style="background:${c}"></i>${nm}</span>`).join("")}</p>
    <table class="ap-tab ap-tab-turnos"><thead><tr><th>% dos válidos</th><th class="n">1º turno</th><th class="n">2º turno</th><th class="n">Δ</th></tr></thead><tbody>${linha("22")}${linha("13")}</tbody></table>
  </section>`;
}

/* ---------- gráfico da vantagem: 0–100% apurado, com viradas e a média das pesquisas ---------- */
function grafico(el) {
	const W = Math.max(280, Math.floor(el.clientWidth));
	const H = 250;
	const mg = { t: 18, r: 76, b: 26, l: 34 };
	const pw = W - mg.l - mg.r;
	const ph = H - mg.t - mg.b;
	const pts = hist.map((h) => ({ ap: h.c.presidente.ap, v: h.c.presidente.c["22"][1] - h.c.presidente.c["13"][1] }));
	const firmes = pts.filter((p) => p.ap >= 10);
	const maxAbs = Math.max(4, Math.abs(md.v), ...(firmes.length ? firmes : pts).map((p) => Math.abs(p.v)));
	const passo = [1, 2, 5, 10, 20].find((s) => (maxAbs * 1.15) / s <= 3) ?? 10;
	const lim = Math.ceil((maxAbs * 1.15) / passo) * passo;
	const X = (v) => mg.l + (v / 100) * pw;
	const Y = (v) => mg.t + (1 - (v + lim) / (2 * lim)) * ph;
	let g = "";
	for (let v = -lim; v <= lim + 1e-9; v += passo) g += `<line x1="${mg.l}" x2="${W - mg.r}" y1="${Y(v)}" y2="${Y(v)}" class="g"/><text x="${mg.l - 6}" y="${Y(v) + 4}" text-anchor="end">${v ? Math.abs(v) : ""}</text>`;
	g += [0, 25, 50, 75, 100].map((v) => `<text x="${X(v)}" y="${H - 7}" text-anchor="middle">${v}%</text>`).join("");
	const ult = pts.at(-1);
	const apAgora = ult ? ult.ap : 0;
	const falta = apAgora < 99.99 ? `<rect class="falta" x="${X(apAgora)}" y="${mg.t}" width="${X(100) - X(apAgora)}" height="${ph}"/><text x="${(X(apAgora) + X(100)) / 2}" y="${mg.t + 14}" text-anchor="middle">a apurar</text>` : "";
	const ref = `<line class="pesq" x1="${mg.l}" x2="${W - mg.r}" y1="${Y(md.v)}" y2="${Y(md.v)}"/><text x="${W - mg.r + 6}" y="${Y(md.v) + 4}">pesquisas</text>`;
	const zero = `<line class="zero" x1="${mg.l}" x2="${W - mg.r}" y1="${Y(0)}" y2="${Y(0)}"/><text x="${W - mg.r + 6}" y="${Y(0) + 4}" class="forte">empate</text>`;
	const rot = `<text x="${mg.l + 6}" y="${mg.t + 14}" class="forte" style="fill:var(--f)">▲ ${F.curto} na frente</text><text x="${mg.l + 6}" y="${mg.t + ph - 8}" class="forte" style="fill:var(--l)">▼ ${L.curto} na frente</text>`;
	let serie = "";
	if (pts.length) {
		const d = pts.map((p, i) => `${i ? "L" : "M"}${X(p.ap).toFixed(1)},${Y(Math.max(-lim, Math.min(lim, p.v))).toFixed(1)}`).join("");
		const area = `${d}L${X(apAgora).toFixed(1)},${Y(0)}L${X(pts[0].ap).toFixed(1)},${Y(0)}Z`;
		serie = `<defs><clipPath id="ap-cima"><rect x="0" y="0" width="${W}" height="${Y(0)}"/></clipPath><clipPath id="ap-baixo"><rect x="0" y="${Y(0)}" width="${W}" height="${H}"/></clipPath></defs>
      ${[["cima", "var(--f)"], ["baixo", "var(--l)"]].map(([k, c]) => `<g clip-path="url(#ap-${k})"><path d="${area}" fill="${c}" opacity=".15"/><path class="linha" d="${d}" stroke="${c}"/></g>`).join("")}
      ${viradas.map((v) => `<line class="virada" x1="${X(v.ap)}" x2="${X(v.ap)}" y1="${mg.t}" y2="${mg.t + ph}"/><circle cx="${X(v.ap)}" cy="${Y(0)}" r="5" class="vponto"/><text x="${X(v.ap) + 6}" y="${mg.t + ph - 8}" class="forte">↻ virada ${v.hora.slice(0, 5)}</text>`).join("")}
      <circle class="ponta" cx="${X(ult.ap)}" cy="${Y(ult.v)}" r="5" style="fill:${ult.v >= 0 ? "var(--f)" : "var(--l)"}"/>
      <text x="${Math.min(X(ult.ap) + 8, W - mg.r + 4)}" y="${Y(ult.v) + (ult.v >= 0 ? -10 : 18)}" class="forte">${vant(ult.v)}</text>`;
	}
	el.innerHTML = `<svg width="${W}" height="${H}" role="img" aria-label="Vantagem de ${F.curto} sobre ${L.curto}, em pontos, conforme as seções são apuradas">${falta}${g}${zero}${ref}${rot}${serie}</svg>`;
	if (!pts.length) el.insertAdjacentHTML("beforeend", '<p class="ap-vazio">A linha aparece com as primeiras seções apuradas.</p>');
	return el.querySelector(".linha");
}

/* ---------- página ---------- */
const app = document.querySelector("#app");
app.innerHTML = `${status}<div class="a ap">
  ${heroi === "2" ? heroi2() : heroi1()}
  <div class="ap-grade">
    <div class="ap-esq">
      <section class="ap-sec"><h2>A vantagem, seção a seção</h2>
        <p class="ap-sub">Acima da linha do empate, ${F.curto} na frente; abaixo, ${L.curto}. A faixa cinza é o que falta apurar; o tracejado é a média das pesquisas.</p>
        <div class="ap-graf" data-graf></div>${analise()}</section>
      <section class="ap-sec"><h2>Momentos da noite</h2>${momentos()}</section>
    </div>
    <div class="ap-dir">${pesquisas()}${exterior()}${comparecimento()}</div>
  </div>
  ${estados()}${colegios()}${turnos()}
  <p class="ap-rodape">Estimativas de votos a apurar e de virada supõem que as seções ainda não apuradas se comportam como as já apuradas. Como a ordem de chegada das urnas não é aleatória, use-as como referência, não como previsão. O TSE não publica transferência de votos entre turnos. <b>Protótipo: números da apuração são de exemplo.</b></p>
</div>`;

/* ---------- movimento: entrada, contagem, cabo, gráfico; faixa de status viva ---------- */
const elGraf = app.querySelector("[data-graf]");
const linha = grafico(elGraf);
let redim;
addEventListener("resize", () => {
	clearTimeout(redim);
	redim = setTimeout(() => grafico(elGraf), 150);
});

if (!calmo) {
	for (const el of app.querySelectorAll("[data-num]")) {
		const alvo = +el.dataset.num;
		if (!el.dataset.num) continue;
		let t0;
		const passo = (t) => {
			t0 ??= t;
			const k = Math.min(1, (t - t0) / 1500);
			el.textContent = pf.format(alvo * (1 - (1 - k) ** 3));
			if (k < 1) requestAnimationFrame(passo);
		};
		requestAnimationFrame(passo);
	}
	app.querySelector("[data-cabo]")?.animate([{ width: "50%" }, { width: `${vF}%` }], { duration: 1500, easing: EASE });
	app.querySelector("[data-campo]")?.animate([{ "--vf": "50%" }, { "--vf": `${vF}%` }], { duration: 1500, easing: EASE });
	for (const [i, s] of [...app.querySelectorAll(".ap-sec")].entries()) s.animate([{ opacity: 0, transform: "translateY(14px)" }, { opacity: 1, transform: "none" }], { delay: 200 + i * 60, duration: 500, easing: EASE, fill: "backwards" });
	if (linha) {
		const n = linha.getTotalLength();
		for (const l of elGraf.querySelectorAll(".linha")) l.animate([{ strokeDasharray: n, strokeDashoffset: n }, { strokeDasharray: n, strokeDashoffset: 0 }], { duration: 1400, delay: 300, easing: EASE, fill: "backwards" });
	}
}

if (!pre && !fim) {
	const prox = app.querySelector("[data-prox]");
	const ciclo = app.querySelector("[data-ciclo]");
	const ha = app.querySelector("[data-ha]");
	const t0 = Date.now();
	setInterval(() => {
		const s = Math.floor((Date.now() - t0) / 1000);
		const resto = 40 - (s % 40);
		prox.textContent = `${resto}s`;
		ciclo.style.transform = `scaleX(${1 - resto / 40})`;
		ha.textContent = s < 60 ? "agora há pouco" : `há ${Math.floor(s / 60)} min`;
	}, 250);
}

/* ---------- barra do protótipo (NÃO faz parte do design) ---------- */
const ir = (k, v) => {
	const u = new URL(location.href);
	u.searchParams.set(k, v);
	location.assign(u.href);
};
const ks = Object.keys(ESTADOS);
const bar = document.createElement("div");
bar.id = "ps";
bar.innerHTML = `${ks.map((k) => `<button type="button" data-k="estado" data-v="${k}" aria-pressed="${k === estado}">${ESTADOS[k][1]}</button>`).join("")}<span class="ps-sep"></span>${Object.entries(HEROIS)
	.map(([k, n]) => `<button type="button" data-k="heroi" data-v="${k}" aria-pressed="${k === heroi}">${k} · ${n}</button>`)
	.join("")}<small>← → estado · H herói</small>`;
bar.addEventListener("click", (e) => {
	const b = e.target.closest("[data-k]");
	if (b) ir(b.dataset.k, b.dataset.v);
});
document.body.append(bar);
addEventListener("keydown", (e) => {
	if (e.key === "ArrowRight" || e.key === "ArrowLeft") ir("estado", ks[(ks.indexOf(estado) + (e.key === "ArrowRight" ? 1 : -1) + ks.length) % ks.length]);
	if (e.key.toLowerCase() === "h") ir("heroi", heroi === "1" ? "2" : "1");
});
