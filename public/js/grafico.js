const CHAVE = "pesq-desligados";
const EASE = "cubic-bezier(.2, .8, .2, 1)";

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

function aplicarDesligados(conjunto) {
	for (const el of document.querySelectorAll(".t-pt, .t-inst")) {
		el.classList.toggle("off", conjunto.has(el.getAttribute("data-cnpj")));
	}
	for (const botao of document.querySelectorAll(".a-chips button[data-cnpj]")) {
		const cnpj = botao.getAttribute("data-cnpj");
		botao.setAttribute("aria-pressed", String(!conjunto.has(cnpj)));
	}
}

function animarEntrada() {
	if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
	const linha = document.querySelector(".t-media");
	if (linha && typeof linha.getTotalLength === "function") {
		const n = linha.getTotalLength();
		linha.animate([{ strokeDasharray: n, strokeDashoffset: n }, { strokeDasharray: n, strokeDashoffset: 0 }], {
			duration: 1200,
			easing: EASE,
		});
	}
	for (const ponto of document.querySelectorAll(".t-pt:not(.off)")) {
		const ordem = Number(ponto.getAttribute("data-ordem") || "0");
		ponto.animate([{ scale: 0 }, { scale: 1 }], {
			delay: 200 + ordem * 120,
			duration: 420,
			easing: EASE,
			fill: "backwards",
		});
	}
}

aplicarDesligados(lerDesligados());

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

document.addEventListener("click", (evento) => {
	const alvo = evento.target instanceof Element ? evento.target : null;
	const botao = alvo?.closest(".a-chips button[data-cnpj]");
	if (!botao) return;
	const cnpj = botao.getAttribute("data-cnpj");
	if (!cnpj) return;
	const conjunto = lerDesligados();
	if (conjunto.has(cnpj)) conjunto.delete(cnpj);
	else conjunto.add(cnpj);
	gravarDesligados(conjunto);
	aplicarDesligados(conjunto);
});
