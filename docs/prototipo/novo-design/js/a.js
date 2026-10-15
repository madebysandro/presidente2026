/**
 * PROTOTYPE — A · Três semanas: a reta final é um calendário de 05/10 a 25/10, com movimento.
 * Abertura: o tempo corre de 05/10 até hoje, as pesquisas caem no dia em que saíram e a média do topo
 * se recalcula a cada chegada. Relógio vivo, barrinha que voa até o detalhe, gráfico que se desenha.
 * Tudo com Web Animations API; "reduzir movimento" mostra o estado final direto.
 */
import { ELEICAO, chips, contagem, desligados, dia, ddmm, diaSemana, esc, fichaTexto, iso, libEfetiva, ligarChips, mediaEm, n1, p1, porExtenso, tendencia, totaisTexto } from "./dados.js";

export const nome = "Três semanas";
const calmo = matchMedia("(prefers-reduced-motion: reduce)").matches;
const EASE = "cubic-bezier(.2, .8, .2, 1)";
const PASSO = 110; // ms por dia na abertura

/* ---------- pequenos movimentos ---------- */
const quadros = new WeakMap();
function contar(el, para, ms = 650) {
	const de = el.dataset.v == null ? para : +el.dataset.v;
	el.dataset.v = para;
	cancelAnimationFrame(quadros.get(el));
	if (calmo || de === para) {
		el.textContent = p1.format(para);
		return;
	}
	const t0 = performance.now();
	const passo = (t) => {
		const k = Math.min(1, (t - t0) / ms);
		el.textContent = p1.format(de + (para - de) * (1 - (1 - k) ** 3));
		if (k < 1) quadros.set(el, requestAnimationFrame(passo));
	};
	quadros.set(el, requestAnimationFrame(passo));
}

/** Troca o texto rolando: o antigo sobe e some, o novo sobe de baixo. */
function rolar(el, texto) {
	if (el.textContent === String(texto)) return;
	if (calmo) {
		el.textContent = texto;
		return;
	}
	el.animate([{ transform: "none", opacity: 1 }, { transform: "translateY(-35%)", opacity: 0 }], { duration: 90, easing: "ease-in" }).onfinish = () => {
		el.textContent = texto;
		el.animate([{ transform: "translateY(35%)", opacity: 0 }, { transform: "none", opacity: 1 }], { duration: 160, easing: EASE });
	};
}

/** Relógio de odômetro: cada dígito é uma coluna 0–9 que rola até o valor. */
function odometro(el, texto) {
	if (el.childElementCount !== texto.length)
		el.innerHTML = [...texto].map((ch) => (/\d/.test(ch) ? `<span class="odo"><span>${[..."0123456789"].join("<br>")}</span></span>` : `<span class="odo-sep">${ch}</span>`)).join("");
	[...texto].forEach((ch, i) => {
		const col = el.children[i].firstElementChild;
		if (col) col.style.transform = `translateY(${-+ch}em)`;
	});
}

/** A barrinha do calendário voa até a barra do detalhe. */
function voar(origem, destino) {
	const a = origem.getBoundingClientRect();
	const b = destino.getBoundingClientRect();
	const g = origem.cloneNode(true);
	g.classList.add("a-fantasma");
	Object.assign(g.style, { left: `${a.left}px`, top: `${a.top}px`, width: `${a.width}px`, height: `${a.height}px` });
	document.body.append(g);
	g.animate(
		[{ transform: "none" }, { transform: `translate(${b.left - a.left}px, ${b.top - a.top}px) scale(${b.width / a.width}, ${b.height / a.height})` }],
		{ duration: 520, easing: EASE },
	).onfinish = () => g.remove();
}

const naTela = (el) => {
	const r = el.getBoundingClientRect();
	return r.top >= 0 && r.bottom <= innerHeight;
};

/* ---------- peças ---------- */
function textoDetalhe(p) {
	return `<p class="a-det-tit"><b>${esc(p.nome)}</b>, divulgada em ${porExtenso(p.saiu)}. Votos válidos calculados dos totais (${esc(totaisTexto(p))}${p.validosFlavio != null ? `; o instituto publicou ${n1.format(p.validosFlavio)} a ${n1.format(p.validosLula)}` : ""}).</p>
    <p class="a-ficha">${fichaTexto(p)}</p>`;
}

export function render(m, root) {
	const dias = [];
	for (let d = dia("2026-10-05"); d <= dia("2026-10-25"); d++) dias.push(iso(d));
	const iHoje = dias.indexOf(m.hoje);
	const semana = ["seg", "ter", "qua", "qui", "sex", "sáb", "dom"];

	const celula = (d) => {
		const pub = m.pub.filter((p) => p.saiu === d);
		const sem = m.semNumero.filter((r) => libEfetiva(r) === d);
		const vem = m.vemAi.filter((r) => libEfetiva(r) === d);
		const tipo = d === "2026-10-25" ? "eleicao" : d === m.hoje ? "hoje" : d < m.hoje ? "passado" : "futuro";
		const vazio = !pub.length && !sem.length && !vem.length && tipo !== "eleicao" && tipo !== "hoje";
		const corpo =
			tipo === "eleicao"
				? `<p class="a-votacao a-item"><b>Votação</b><br>apuração a partir das 17h</p>`
				: pub
						.map(
							(p) => `<button type="button" class="a-pesq a-item" data-reg="${p.registro}" aria-label="${esc(p.nome)}: Flávio ${p1.format(p.vf)}%, Lula ${p1.format(p.vl)}%">
                <span>${esc(p.nome)}</span><span class="a-mini"><i style="width:${p.vf}%"></i><i style="width:${p.vl}%"></i></span><small>${p1.format(p.vf)} a ${p1.format(p.vl)}</small></button>`,
						)
						.join("") +
					sem.map((r) => `<span class="a-sem a-item">${esc(r.nome)} <small>sem números ainda</small></span>`).join("") +
					vem.map((r) => `<span class="a-vem a-item" title="${esc(r.nome)}: campo de ${ddmm(r.campoInicio)} a ${ddmm(r.campoFim)}, registro ${esc(r.registro)}">${esc(r.nome)}</span>`).join("");
		return `<div class="a-dia ${tipo} ${vazio ? "vazio" : ""}" data-d="${d}"><span class="a-n">${+d.slice(8, 10)}<small>${diaSemana(d)}</small></span>${
			tipo === "hoje" ? '<em class="a-hoje"><i class="a-ponto" aria-hidden="true"></i>agora</em><i class="a-prog" aria-hidden="true"></i>' : ""
		}${corpo}</div>`;
	};

	const ultima = m.pub.at(-1);
	const comMargem = m.media.ps.filter((p) => p.margem != null);
	const margem = Math.round((comMargem.reduce((t, p) => t + p.margem, 0) / comMargem.length) * 10) / 10;
	const dProx = m.vemAi[0] && libEfetiva(m.vemAi[0]);
	const nomesProx = [...new Set(m.vemAi.filter((r) => libEfetiva(r) === dProx).map((r) => r.nome))];
	const proxima = dProx && { d: dProx, nomes: nomesProx.length > 1 ? `${nomesProx.slice(0, -1).join(", ")} e ${nomesProx.at(-1)}` : nomesProx[0] };
	root.innerHTML = `<div class="a">
    <header class="a-topo">
      <p class="a-marca">Presidente 2026, 2º turno</p>
      <div class="a-veredito">
        <h1><span class="a-f">Flávio <b data-vf>${p1.format(m.media.vf)}</b></span> <span class="a-x">a</span> <span class="a-l">Lula <b data-vl>${p1.format(m.media.vl)}</b></span></h1>
        <p>É a média das últimas pesquisas de <span data-n>${m.media.n}</span> institutos, em votos válidos. Cada quadrado abaixo é um dia da reta final.</p>
      </div>
      <div class="a-conta"><b data-conta>${contagem().d}</b><span>dias e<br><span class="a-relogio" data-relogio></span><br>até a votação</span></div>
      <div class="a-cabo" role="img" aria-label="Flávio ${p1.format(m.media.vf)}%, Lula ${p1.format(m.media.vl)}%, margem de erro média de ${n1.format(margem)} ponto${margem === 1 ? "" : "s"}">
        <i class="a-cabo-f" style="width:${m.media.vf}%"></i><span class="a-cabo-margem" style="left:${m.media.vf - margem}%;width:${2 * margem}%"></span><em class="a-cabo-50"></em>
      </div>
      <p class="a-cabo-leg">A faixa clara é a margem de erro média dessas pesquisas, ${n1.format(margem)} ponto${margem === 1 ? "" : "s"} para cada lado: a divisa real pode estar em qualquer lugar dela.</p>
      ${proxima ? `<p class="a-proxima"><span class="a-ponto" aria-hidden="true"></span><span>${esc(proxima.nomes)} podem divulgar a partir de ${porExtenso(proxima.d)}, <b data-proxima></b>.</span></p>` : ""}
    </header>
    <section class="a-cal" aria-label="Calendário das pesquisas, de 5 a 25 de outubro">
      ${semana.map((s) => `<span class="a-sem-tit">${s}</span>`).join("")}
      ${dias.map(celula).join("")}
    </section>
    <div class="a-leg"><span class="a-leg-pub">pesquisa divulgada</span><span class="a-leg-vem">registrada no TSE, ainda não divulgada</span><span class="a-leg-sem">liberada, números ainda não cadastrados</span>
      <button type="button" class="a-rever">Rever as três semanas</button></div>
    <section class="a-det" aria-live="polite">
      <div class="a-det-num"><span class="a-f">Flávio <b data-dvf>${p1.format(ultima.vf)}</b></span><span class="a-l">Lula <b data-dvl>${p1.format(ultima.vl)}</b></span></div>
      <div class="a-barra" data-dbarra><i style="width:${ultima.vf}%"></i><i style="width:${ultima.vl}%"></i></div>
      <div data-dtxt>${textoDetalhe(ultima)}</div>
    </section>
    <section class="a-tend">
      <h2>A vantagem, dia a dia</h2>
      <p>Pontos são pesquisas; a linha é a média. Toque num instituto para tirá-lo do gráfico.</p>
      ${chips(m, "a-chips")}
      <div class="a-graf" data-graf></div>
    </section>
  </div>`;

	const $ = (s) => root.querySelector(s);
	const vf = $("[data-vf]");
	const vl = $("[data-vl]");
	const conta = $("[data-conta]");
	const relogio = $("[data-relogio]");
	vf.dataset.v = m.media.vf;
	vl.dataset.v = m.media.vl;

	/* ---------- relógio vivo e o dia de hoje enchendo ---------- */
	let vivo = 0;
	const elProx = $("[data-proxima]");
	const tique = () => {
		const ms = Math.max(0, ELEICAO - Date.now());
		const c = contagem();
		const s = Math.floor((ms % 6e4) / 1e3);
		rolar(conta, c.d);
		odometro(relogio, `${String(c.h).padStart(2, "0")}:${String(c.m).padStart(2, "0")}:${String(s).padStart(2, "0")}`);
		const prog = $(".a-prog");
		if (prog) prog.style.width = `${(((Date.now() - 3 * 36e5) % 864e5) / 864e5) * 100}%`;
		if (elProx) {
			// liberação vale a partir da 0h de Brasília (3h UTC)
			const falta = Math.max(0, dia(proxima.d) * 864e5 + 3 * 36e5 - Date.now());
			elProx.textContent = falta ? `em ${Math.floor(falta / 36e5)} h ${String(Math.floor((falta % 36e5) / 6e4)).padStart(2, "0")} min` : "já liberadas";
		}
	};
	if (!calmo)
		$(".a-cabo-f").animate([{ width: `${m.media.vf - margem * 0.8}%` }, { width: `${m.media.vf + margem * 0.8}%` }], {
			duration: 5200,
			direction: "alternate",
			iterations: Infinity,
			easing: "ease-in-out",
			id: "continuo",
		});
	odometro(relogio, "00:00:00");
	const ligarRelogio = () => {
		clearInterval(vivo);
		tique();
		vivo = setInterval(tique, 1000);
	};

	/* ---------- abertura: as três semanas passam ---------- */
	let timers = [];
	const depois = (ms, f) => timers.push(setTimeout(f, ms));
	function abrir() {
		for (const t of timers) clearTimeout(t);
		timers = [];
		for (const a of root.getAnimations({ subtree: true })) if (a.id !== "continuo") a.cancel();
		clearInterval(vivo);
		if (calmo) {
			ligarRelogio();
			return;
		}
		const celulas = [...root.querySelectorAll(".a-dia")];
		const tHoje = iHoje * PASSO;
		const cabeca = root.querySelector(".a-veredito h1");
		cabeca.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 400, delay: 3 * PASSO, fill: "backwards" });
		relogio.textContent = "dias até a votação";

		celulas.forEach((cel, i) => {
			const d = cel.dataset.d;
			const futuro = i > iHoje;
			const t = futuro ? tHoje + 380 + (i - iHoje) * 45 : i * PASSO;
			cel.animate(
				futuro ? [{ opacity: 0, transform: "translateY(6px)" }, { opacity: 1, transform: "none" }] : [{ opacity: 0.25 }, { opacity: 1 }],
				{ delay: t, duration: futuro ? 300 : 260, easing: EASE, fill: "backwards" },
			);
			[...cel.querySelectorAll(".a-item")].forEach((it, j) => {
				it.animate([{ opacity: 0, transform: "translateY(-10px)" }, { opacity: 1, transform: "none" }], { delay: t + 70 + j * 70, duration: 380, easing: EASE, fill: "backwards" });
				// as duas fatias crescem a partir da divisa entre elas
				for (const [k, seg] of [...it.querySelectorAll(".a-mini i")].entries()) {
					seg.style.transformOrigin = k ? "left" : "right";
					seg.animate([{ transform: "scaleX(0)" }, { transform: "scaleX(1)" }], { delay: t + 140 + j * 70, duration: 520, easing: EASE, fill: "backwards" });
				}
			});
			if (futuro) return;
			depois(t, () => {
				rolar(conta, contagem().d + (iHoje - i));
				if (m.pub.some((p) => p.saiu === d)) {
					const md = mediaEm(m.pub, d);
					contar(vf, md.vf);
					contar(vl, md.vl);
					root.querySelector("[data-n]").textContent = md.n;
				}
			});
		});
		const hoje = celulas[iHoje];
		hoje.animate([{ boxShadow: "inset 0 0 0 0 #17202B" }, { boxShadow: "inset 0 0 0 2px #17202B" }], { delay: tHoje, duration: 500, easing: EASE, fill: "backwards" });
		hoje.querySelector(".a-hoje").animate([{ opacity: 0, transform: "scale(.6)" }, { opacity: 1, transform: "none" }], { delay: tHoje + 120, duration: 400, easing: EASE, fill: "backwards" });
		const eleicao = celulas.at(-1);
		eleicao.animate([{ transform: "scale(.94)" }, { transform: "scale(1.03)" }, { transform: "none" }], { delay: tHoje + 380 + (celulas.length - 1 - iHoje) * 45, duration: 600, easing: EASE });
		depois(tHoje + 900, ligarRelogio);
	}

	/** Pular a abertura: um toque em qualquer lugar termina tudo. */
	root.addEventListener(
		"pointerdown",
		() => {
			if (!timers.length) return;
			for (const a of root.getAnimations({ subtree: true })) if (a.id !== "continuo") a.finish();
			for (const t of timers) clearTimeout(t);
			timers = [];
			contar(vf, m.media.vf, 1);
			contar(vl, m.media.vl, 1);
			root.querySelector("[data-n]").textContent = m.media.n;
			ligarRelogio();
		},
		{ capture: true },
	);
	root.querySelector(".a-rever").addEventListener("click", (e) => {
		e.stopPropagation();
		scrollTo({ top: 0, behavior: calmo ? "auto" : "smooth" });
		setTimeout(() => vinheta(abrir), calmo ? 0 : 350);
	});

	/* ---------- detalhe de uma pesquisa ---------- */
	const dvf = $("[data-dvf]");
	const dvl = $("[data-dvl]");
	const dbarra = $("[data-dbarra]");
	const dtxt = $("[data-dtxt]");
	dvf.dataset.v = ultima.vf;
	dvl.dataset.v = ultima.vl;
	function mostrar(p, origem) {
		const painel = $(".a-det");
		if (origem && !calmo && naTela(painel)) voar(origem, dbarra);
		else painel.scrollIntoView({ behavior: calmo ? "auto" : "smooth", block: "center" });
		contar(dvf, p.vf);
		contar(dvl, p.vl);
		const [i1, i2] = dbarra.querySelectorAll("i");
		i1.style.width = `${p.vf}%`;
		i2.style.width = `${p.vl}%`;
		if (calmo) dtxt.innerHTML = textoDetalhe(p);
		else
			dtxt.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 120 }).onfinish = () => {
				dtxt.innerHTML = textoDetalhe(p);
				dtxt.animate([{ opacity: 0, transform: "translateY(4px)" }, { opacity: 1, transform: "none" }], { duration: 260, easing: EASE });
			};
	}
	root.addEventListener("click", (e) => {
		const b = e.target.closest(".a-pesq");
		if (!b) return;
		for (const x of root.querySelectorAll(".a-pesq.sel")) x.classList.remove("sel");
		b.classList.add("sel");
		mostrar(
			m.pub.find((p) => p.registro === b.dataset.reg),
			b.querySelector(".a-mini"),
		);
	});
	root.querySelector(`.a-pesq[data-reg="${ultima.registro}"]`)?.classList.add("sel");

	/* ---------- gráfico: desenha ao entrar na tela; liga/desliga sem redesenhar ---------- */
	const elGraf = $("[data-graf]");
	let desenhado = false;
	const graf = () => tendencia(elGraf, m, { alto: 220 });
	const animarGraf = () => {
		if (calmo) return;
		const linha = elGraf.querySelector(".t-media");
		const n = linha.getTotalLength();
		linha.animate([{ strokeDasharray: n, strokeDashoffset: n }, { strokeDasharray: n, strokeDashoffset: 0 }], { duration: 1200, easing: EASE });
		for (const c of elGraf.querySelectorAll(".t-pt:not(.off)"))
			c.animate([{ opacity: 0, transform: "scale(0)" }, { opacity: 1, transform: "none" }], { delay: 200 + +c.dataset.ordem * 120, duration: 420, easing: EASE, fill: "backwards" });
		elGraf.querySelector(".t-rot").animate([{ opacity: 0 }, { opacity: 1 }], { delay: 1100, duration: 400, fill: "backwards" });
	};
	graf();
	new IntersectionObserver(
		(es, obs) => {
			if (!es[0].isIntersecting || desenhado) return;
			desenhado = true;
			animarGraf();
			obs.disconnect();
		},
		{ threshold: 0.4 },
	).observe(elGraf);
	ligarChips(() => {
		const off = desligados();
		for (const el of elGraf.querySelectorAll(".t-pt, .t-inst")) el.classList.toggle("off", off.has(el.dataset.cnpj));
	});
	let redim;
	addEventListener("resize", () => {
		clearTimeout(redim);
		redim = setTimeout(graf, 150);
	});

	/* ---------- vinheta: abertura tipográfica em tela cheia que vira a barra do topo ---------- */
	function vinheta(fim) {
		if (calmo) return fim();
		const c = contagem();
		const ov = document.createElement("div");
		ov.className = "a-intro";
		ov.setAttribute("aria-hidden", "true");
		ov.innerHTML = `<div class="a-i-faixa"><i class="a-i-f" style="width:${m.media.vf}%"><span>Flávio<b>${p1.format(m.media.vf)}</b></span></i><i class="a-i-l"><span>Lula<b>${p1.format(m.media.vl)}</b></span></i><em></em></div>
      <div class="a-i-txt"><p class="a-i-data"><span>25 de outubro</span></p><p class="a-i-sub">2º turno para presidente</p><p class="a-i-faltam">faltam <b>20</b> dias</p></div>`;
		document.body.append(ov);
		document.documentElement.style.overflow = "hidden";
		const q = (sel) => ov.querySelector(sel);
		const anim = (el, kf, o) => el.animate(kf, { easing: EASE, fill: "both", ...o });
		anim(q(".a-i-data span"), [{ transform: "translateY(110%)" }, { transform: "none" }], { duration: 700 });
		anim(q(".a-i-sub"), [{ opacity: 0 }, { opacity: 1 }], { delay: 300, duration: 500 });
		anim(q(".a-i-faltam"), [{ opacity: 0, transform: "translateY(8px)" }, { opacity: 1, transform: "none" }], { delay: 500, duration: 400 });
		const n = q(".a-i-faltam b");
		const passos = Math.max(0, 20 - c.d);
		const tm = [];
		for (let k = 1; k <= passos; k++) tm.push(setTimeout(() => rolar(n, 20 - k), 700 + k * 55));
		const t1 = 700 + passos * 55 + 300;
		anim(q(".a-i-txt"), [{ opacity: 1 }, { opacity: 0 }], { delay: t1, duration: 300 });
		anim(q(".a-i-f"), [{ transform: "scaleX(0)" }, { transform: "none" }], { delay: t1, duration: 700 });
		anim(q(".a-i-l"), [{ transform: "scaleX(0)" }, { transform: "none" }], { delay: t1, duration: 700 });
		anim(q(".a-i-faixa em"), [{ transform: "scaleY(0)" }, { transform: "none" }], { delay: t1 + 500, duration: 500 });
		for (const [sel, x] of [[".a-i-f span", -40], [".a-i-l span", 40]]) {
			anim(q(sel), [{ opacity: 0, transform: `translateX(${x}px)` }, { opacity: 1, transform: "none" }], { delay: t1 + 350, duration: 500 });
			anim(q(sel), [{ opacity: 1 }, { opacity: 0 }], { delay: t1 + 1900, duration: 200, fill: "forwards" });
		}
		// a faixa encolhe até virar a barra do cabo de guerra no topo da página
		const t2 = t1 + 2050;
		tm.push(
			setTimeout(() => {
				const alvo = root.querySelector(".a-cabo").getBoundingClientRect();
				const faixa = q(".a-i-faixa");
				const r = faixa.getBoundingClientRect();
				anim(faixa, [{ transform: "none" }, { transform: `translate(${alvo.left - r.left}px, ${alvo.top - r.top}px) scale(${alvo.width / r.width}, ${alvo.height / r.height})` }], { duration: 750 });
				anim(ov, [{ backgroundColor: "rgb(242 244 247)" }, { backgroundColor: "rgb(242 244 247 / 0)" }], { duration: 750 });
				comecar(); // o calendário começa a correr enquanto a faixa voa para o topo
			}, t2),
		);
		let comecou = false;
		const comecar = () => {
			if (comecou) return;
			comecou = true;
			document.documentElement.style.overflow = "";
			fim();
		};
		const acabar = () => {
			for (const t of tm) clearTimeout(t);
			ov.remove();
			removeEventListener("keydown", acabar);
			comecar();
		};
		tm.push(setTimeout(acabar, t2 + 800));
		ov.addEventListener("pointerdown", acabar);
		addEventListener("keydown", acabar);
	}

	vinheta(abrir);
}
