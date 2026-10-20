import { serieIntencao } from "./intencao.mjs";

const CHAVE = "pesq-desligados";
const EASE = "cubic-bezier(.2, .8, .2, 1)";
const Y_LO = 44;
const Y_HI = 56;
const FOLGA_ROTULO = 7.2;
const NS = "http://www.w3.org/2000/svg";

const p1 = new Intl.NumberFormat("pt-BR", {
	minimumFractionDigits: 1,
	maximumFractionDigits: 1,
});

function lerDesligados() {
	try {
		const bruto = JSON.parse(localStorage.getItem(CHAVE) || "[]");
		return new Set(Array.isArray(bruto) ? bruto.filter((item) => typeof item === "string") : []);
	} catch {
		return new Set();
	}
}

function gravarDesligados(conjunto) {
	try {
		localStorage.setItem(CHAVE, JSON.stringify([...conjunto]));
	} catch {
		/* a preferência fica só nesta visita */
	}
}

function lerDados() {
	const bloco = document.getElementById("a-intencao-dados");
	if (!bloco) return null;
	try {
		const dados = JSON.parse(bloco.textContent || "");
		if (!dados || !Array.isArray(dados.pesquisas) || typeof dados.hoje !== "string") return null;
		return dados;
	} catch {
		return null;
	}
}

function diaNumero(iso) {
	const [ano, mes, dia] = iso.split("-").map(Number);
	return Date.UTC(ano, mes - 1, dia) / 86400000;
}

function isoDe(dia) {
	return new Date(dia * 86400000).toISOString().slice(0, 10);
}

function n2(n) {
	return (Math.round(n * 100) / 100).toFixed(2);
}

function janelaY(valores) {
	let lo = Y_LO;
	let hi = Y_HI;
	for (const valor of valores) {
		if (!Number.isFinite(valor)) continue;
		while (valor < lo - 1) lo -= 2;
		while (valor > hi + 1) hi += 2;
	}
	const ticks = [];
	for (let marca = lo; marca <= hi; marca += 2) ticks.push(marca);
	return { y0: lo - 1, y1: hi + 1, ticks };
}

function limpar(el) {
	while (el.firstChild) el.removeChild(el.firstChild);
}

function svgEl(nome, attrs) {
	const el = document.createElementNS(NS, nome);
	for (const [chave, valor] of Object.entries(attrs)) el.setAttribute(chave, valor);
	return el;
}

function desenhar(dados, desligados) {
	const area = document.querySelector(".a-area");
	const grades = area?.querySelector(".t-grades");
	const svg = area?.querySelector("svg");
	const eixoY = document.querySelector(".a-eixo-y");
	if (!area || !grades || !svg || !eixoY) return;

	const visiveis = dados.pesquisas.filter((pesquisa) => !desligados.has(pesquisa.cnpj));
	const serie = serieIntencao(visiveis, dados.hoje);
	const ordenadas = [...dados.pesquisas].sort(
		(a, b) => a.campoFim.localeCompare(b.campoFim) || a.registro.localeCompare(b.registro),
	);
	const x0 = diaNumero(ordenadas[0].campoFim) - 2;
	const x1 = diaNumero(dados.hoje) + 2;
	const span = x1 - x0;
	const px = (iso) => ((diaNumero(iso) - x0) / span) * 100;
	const valores = [];
	for (const pesquisa of visiveis) valores.push(pesquisa.vf, pesquisa.vl);
	for (const ponto of serie) {
		valores.push(
			ponto.vf + ponto.margem,
			ponto.vf - ponto.margem,
			ponto.vl + ponto.margem,
			ponto.vl - ponto.margem,
		);
	}
	const janela = janelaY(valores);
	const py = (valor) => ((janela.y1 - valor) / (janela.y1 - janela.y0)) * 100;

	limpar(eixoY);
	for (const marca of janela.ticks) {
		const spanY = document.createElement("span");
		spanY.style.top = `${n2(py(marca))}%`;
		spanY.textContent = `${marca}%`;
		eixoY.append(spanY);
	}

	limpar(grades);
	for (const marca of janela.ticks) {
		const linha = document.createElement("span");
		linha.className = marca === 50 ? "t-cinq" : "t-grade";
		linha.style.top = `${n2(py(marca))}%`;
		grades.append(linha);
	}

	limpar(svg);
	const faixa = (chave, lado) => {
		if (!serie.length) return;
		const cima = serie.map((ponto) => `${n2(px(ponto.data))},${n2(py(ponto[chave] + ponto.margem))}`);
		const baixo = [...serie]
			.reverse()
			.map((ponto) => `${n2(px(ponto.data))},${n2(py(ponto[chave] - ponto.margem))}`);
		svg.append(
			svgEl("polygon", {
				class: `t-faixa t-faixa-${lado}`,
				points: cima.concat(baixo).join(" "),
			}),
		);
	};
	faixa("vf", "f");
	faixa("vl", "l");
	const xHoje = n2(px(dados.hoje));
	svg.append(
		svgEl("line", {
			class: "t-hoje-linha",
			x1: xHoje,
			x2: xHoje,
			y1: "0",
			y2: "100",
			"vector-effect": "non-scaling-stroke",
		}),
	);
	const linhaMedia = (chave, lado) => {
		if (!serie.length) return;
		const pontos = serie.map((ponto) => `${n2(px(ponto.data))},${n2(py(ponto[chave]))}`).join(" ");
		svg.append(
			svgEl("polyline", {
				class: `t-media t-media-${lado}`,
				"data-datas": serie.map((ponto) => ponto.data).join(" "),
				[`data-${chave}`]: serie.map((ponto) => ponto[chave]).join(" "),
				points: pontos,
				fill: "none",
				"stroke-width": "3.5",
				"stroke-linejoin": "round",
				"stroke-linecap": "round",
				"vector-effect": "non-scaling-stroke",
			}),
		);
	};
	linhaMedia("vf", "f");
	linhaMedia("vl", "l");

	for (const el of area.querySelectorAll(".t-hoje, .t-pt, .t-rot")) el.remove();
	const hoje = document.createElement("span");
	hoje.className = "t-hoje";
	hoje.style.left = `${xHoje}%`;
	hoje.textContent = "hoje";
	area.append(hoje);

	visiveis.forEach((pesquisa, ordem) => {
		const quando = `${pesquisa.campoFim.slice(8, 10)}/${pesquisa.campoFim.slice(5, 7)}`;
		const x = n2(px(pesquisa.campoFim));
		for (const lado of ["f", "l"]) {
			const valor = lado === "f" ? pesquisa.vf : pesquisa.vl;
			const y = n2(py(valor));
			const ponto = document.createElement("span");
			ponto.className = `t-pt lado-${lado}`;
			ponto.style.left = `${x}%`;
			ponto.style.top = `${y}%`;
			ponto.setAttribute("data-registro", pesquisa.registro);
			ponto.setAttribute("data-cnpj", pesquisa.cnpj);
			ponto.setAttribute("data-instituto", pesquisa.instituto);
			ponto.setAttribute("data-quando", quando);
			ponto.setAttribute("data-vf", String(pesquisa.vf));
			ponto.setAttribute("data-vl", String(pesquisa.vl));
			ponto.setAttribute("data-margem", String(pesquisa.margem));
			ponto.setAttribute("data-ordem", String(ordem));
			ponto.setAttribute("data-x", x);
			ponto.setAttribute("data-y", y);
			ponto.setAttribute("role", "button");
			ponto.tabIndex = 0;
			ponto.setAttribute(
				"aria-label",
				`${pesquisa.instituto}, ${quando}. Flávio ${p1.format(pesquisa.vf)}%. Lula ${p1.format(pesquisa.vl)}%. Margem ±${p1.format(pesquisa.margem)}.`,
			);
			area.append(ponto);
		}
	});

	const ultimo = serie.at(-1);
	if (ultimo) {
		let topoF = py(ultimo.vf);
		let topoL = py(ultimo.vl);
		if (Math.abs(topoL - topoF) < FOLGA_ROTULO) {
			const meio = (topoF + topoL) / 2;
			const sinal = topoL >= topoF ? 1 : -1;
			topoF = meio - sinal * (FOLGA_ROTULO / 2);
			topoL = meio + sinal * (FOLGA_ROTULO / 2);
		}
		for (const [classe, topo, texto] of [
			["t-rot t-rot-f", topoF, `Flávio ${p1.format(ultimo.vf)}%`],
			["t-rot t-rot-l", topoL, `Lula ${p1.format(ultimo.vl)}%`],
		]) {
			const rotulo = document.createElement("span");
			rotulo.className = classe;
			rotulo.style.left = `${n2(px(ultimo.data))}%`;
			rotulo.style.top = `${n2(topo)}%`;
			rotulo.textContent = texto;
			area.append(rotulo);
		}
		area.setAttribute(
			"aria-label",
			`Intenção de voto em votos válidos. Flávio ${p1.format(ultimo.vf)}%, Lula ${p1.format(ultimo.vl)}%.`,
		);
	} else {
		area.setAttribute("aria-label", "Intenção de voto em votos válidos.");
	}
}

function marcarChips(desligados) {
	for (const botao of document.querySelectorAll(".a-chips button[data-cnpj]")) {
		const cnpj = botao.getAttribute("data-cnpj");
		botao.setAttribute("aria-pressed", String(!desligados.has(cnpj)));
	}
}

function animarEntrada() {
	if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
	for (const linha of document.querySelectorAll(".t-media")) {
		if (typeof linha.getTotalLength !== "function") continue;
		const n = linha.getTotalLength();
		linha.animate(
			[
				{ strokeDasharray: n, strokeDashoffset: n },
				{ strokeDasharray: n, strokeDashoffset: 0 },
			],
			{ duration: 1200, easing: EASE },
		);
	}
	for (const ponto of document.querySelectorAll(".t-pt")) {
		const ordem = Number(ponto.getAttribute("data-ordem") || "0");
		ponto.animate([{ scale: 0 }, { scale: 1 }], {
			delay: 200 + ordem * 40,
			duration: 420,
			easing: EASE,
			fill: "backwards",
		});
	}
}

function esconderDica() {
	const dica = document.querySelector(".t-tip");
	if (dica) dica.hidden = true;
}

function mostrarDica(ponto) {
	const dica = document.querySelector(".t-tip");
	const caixa = document.querySelector(".a-caixa");
	if (!dica || !caixa) return;
	const nome = document.createElement("b");
	nome.textContent = ponto.getAttribute("data-instituto") || "";
	const quando = document.createElement("span");
	quando.textContent = ` · ${ponto.getAttribute("data-quando") || ""}`;
	const numeros = document.createElement("span");
	const vf = Number(ponto.getAttribute("data-vf"));
	const vl = Number(ponto.getAttribute("data-vl"));
	const margem = Number(ponto.getAttribute("data-margem"));
	numeros.textContent = `Flávio ${p1.format(vf)}% · Lula ${p1.format(vl)}%`;
	const erro = document.createElement("span");
	erro.textContent = `margem ±${p1.format(margem)}`;
	dica.replaceChildren(nome, quando, document.createElement("br"), numeros, document.createElement("br"), erro);
	dica.hidden = false;
	const caixaR = caixa.getBoundingClientRect();
	const r = ponto.getBoundingClientRect();
	const largura = dica.offsetWidth;
	const left = Math.max(4, Math.min(r.left - caixaR.left + r.width / 2 - largura / 2, caixaR.width - largura - 4));
	dica.style.left = `${left}px`;
	dica.style.top = `${r.top - caixaR.top - dica.offsetHeight - 8}px`;
}

const dados = lerDados();
const desligados = lerDesligados();
if (dados && desligados.size) {
	desenhar(dados, desligados);
	marcarChips(desligados);
}

const area = document.querySelector(".a-area");
if (area) {
	area.addEventListener("pointerover", (evento) => {
		const ponto = evento.target instanceof Element ? evento.target.closest(".t-pt") : null;
		if (!ponto || evento.pointerType === "touch") return;
		mostrarDica(ponto);
	});
	area.addEventListener("pointerout", (evento) => {
		const ponto = evento.target instanceof Element ? evento.target.closest(".t-pt") : null;
		if (!ponto || evento.pointerType === "touch") return;
		esconderDica();
	});
	area.addEventListener("click", (evento) => {
		const ponto = evento.target instanceof Element ? evento.target.closest(".t-pt") : null;
		if (!ponto) return;
		evento.stopPropagation();
		mostrarDica(ponto);
	});
	area.addEventListener("focusin", (evento) => {
		const ponto = evento.target instanceof Element ? evento.target.closest(".t-pt") : null;
		if (ponto) mostrarDica(ponto);
	});
	area.addEventListener("focusout", () => esconderDica());
}

document.addEventListener("click", (evento) => {
	const alvo = evento.target instanceof Element ? evento.target : null;
	const botao = alvo?.closest(".a-chips button[data-cnpj]");
	if (botao) {
		const cnpj = botao.getAttribute("data-cnpj");
		if (!cnpj || !dados) return;
		if (desligados.has(cnpj)) desligados.delete(cnpj);
		else desligados.add(cnpj);
		gravarDesligados(desligados);
		marcarChips(desligados);
		desenhar(dados, desligados);
		esconderDica();
		return;
	}
	if (!alvo?.closest(".t-pt")) esconderDica();
});

const grafico = document.querySelector(".a-graf");
if (grafico && "IntersectionObserver" in window) {
	const obs = new IntersectionObserver(
		(entradas) => {
			if (!entradas.some((entrada) => entrada.isIntersecting)) return;
			animarEntrada();
			obs.disconnect();
		},
		{ threshold: 0.4 },
	);
	obs.observe(grafico);
} else {
	animarEntrada();
}
