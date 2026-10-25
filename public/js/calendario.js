(() => {
const EASE = "cubic-bezier(.2, .8, .2, 1)";

function calmo() {
	return matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function formatar(n) {
	return new Intl.NumberFormat("pt-BR", {
		minimumFractionDigits: 1,
		maximumFractionDigits: 1,
	}).format(n);
}

function naTela(el) {
	const r = el.getBoundingClientRect();
	return r.top >= 0 && r.bottom <= innerHeight;
}

function contar(el, para, ms = 650) {
	const bruto = el.getAttribute("data-v");
	const de = bruto == null || bruto === "" ? para : Number(bruto);
	el.setAttribute("data-v", String(para));
	if (calmo() || !Number.isFinite(de) || de === para) {
		el.textContent = formatar(para);
		return;
	}
	const t0 = performance.now();
	const passo = (t) => {
		const k = Math.min(1, (t - t0) / ms);
		el.textContent = formatar(de + (para - de) * (1 - (1 - k) ** 3));
		if (k < 1) requestAnimationFrame(passo);
	};
	requestAnimationFrame(passo);
}

function voar(origem, destino) {
	const a = origem.getBoundingClientRect();
	const b = destino.getBoundingClientRect();
	if (!(a.width > 0) || !(a.height > 0) || !(b.width > 0) || !(b.height > 0)) return;
	const fantasma = origem.cloneNode(true);
	fantasma.classList.add("a-fantasma");
	fantasma.setAttribute("aria-hidden", "true");
	Object.assign(fantasma.style, {
		left: `${a.left}px`,
		top: `${a.top}px`,
		width: `${a.width}px`,
		height: `${a.height}px`,
	});
	document.body.append(fantasma);
	const animacao = fantasma.animate(
		[
			{ transform: "none" },
			{
				transform: `translate(${b.left - a.left}px, ${b.top - a.top}px) scale(${b.width / a.width}, ${b.height / a.height})`,
			},
		],
		{ duration: 520, easing: EASE },
	);
	const tirar = () => fantasma.remove();
	animacao.onfinish = tirar;
	animacao.oncancel = tirar;
}

function selecionar(registro, origem) {
	if (!registro || !window.CSS || !CSS.escape) return;
	const molde = document.querySelector(`template[data-detalhe="${CSS.escape(registro)}"]`);
	const vivo = document.querySelector("[data-detalhe-vivo]");
	if (!molde || !vivo) return;
	for (const botao of document.querySelectorAll(".a-pesq")) {
		botao.classList.toggle("sel", botao.getAttribute("data-registro") === registro);
	}
	const deVf = Number(vivo.querySelector("[data-dvf]")?.getAttribute("data-v"));
	const deVl = Number(vivo.querySelector("[data-dvl]")?.getAttribute("data-v"));
	const barra = vivo.querySelector(".a-barra");
	if (origem && barra && naTela(vivo) && !calmo()) voar(origem, barra);
	else if (!naTela(vivo)) vivo.scrollIntoView({ behavior: calmo() ? "auto" : "smooth", block: "center" });

	const aplicar = () => {
		vivo.replaceChildren(molde.content.cloneNode(true));
		const nvf = vivo.querySelector("[data-dvf]");
		const nvl = vivo.querySelector("[data-dvl]");
		const paraVf = Number(nvf?.getAttribute("data-v"));
		const paraVl = Number(nvl?.getAttribute("data-v"));
		if (nvf && Number.isFinite(paraVf)) {
			if (Number.isFinite(deVf)) nvf.setAttribute("data-v", String(deVf));
			contar(nvf, paraVf);
		}
		if (nvl && Number.isFinite(paraVl)) {
			if (Number.isFinite(deVl)) nvl.setAttribute("data-v", String(deVl));
			contar(nvl, paraVl);
		}
		const fatias = vivo.querySelectorAll(".a-barra i");
		if (!calmo() && fatias.length === 2 && Number.isFinite(deVf) && Number.isFinite(deVl)) {
			const alvo1 = fatias[0].style.width;
			const alvo2 = fatias[1].style.width;
			fatias[0].style.width = `${deVl}%`;
			fatias[1].style.width = `${deVf}%`;
			requestAnimationFrame(() => {
				fatias[0].style.width = alvo1;
				fatias[1].style.width = alvo2;
			});
		}
		const txt = vivo.querySelector("[data-dtxt]");
		if (txt && !calmo()) {
			txt.animate(
				[
					{ opacity: 0, transform: "translateY(4px)" },
					{ opacity: 1, transform: "none" },
				],
				{ duration: 260, easing: EASE },
			);
		}
	};

	const antigo = vivo.querySelector("[data-dtxt]");
	if (antigo && !calmo()) {
		const saida = antigo.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 120 });
		saida.onfinish = aplicar;
		saida.oncancel = aplicar;
	} else {
		aplicar();
	}
}

function progressoDoDia() {
	const barra = document.querySelector(".a-prog");
	if (!barra) return;
	const bruto = (Date.now() - 3 * 3600000) % 86400000;
	const ms = bruto < 0 ? bruto + 86400000 : bruto;
	barra.style.width = `${(ms / 86400000) * 100}%`;
}

document.addEventListener("click", (evento) => {
	const alvo = evento.target instanceof Element ? evento.target : null;
	if (!alvo) return;
	const pesquisa = alvo.closest(".a-pesq");
	if (!pesquisa) return;
	selecionar(pesquisa.getAttribute("data-registro") || "", pesquisa.querySelector(".a-mini"));
});

progressoDoDia();
setInterval(progressoDoDia, 1000);
})();
