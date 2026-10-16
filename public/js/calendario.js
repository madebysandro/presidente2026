function selecionar(registro) {
	if (!registro || !window.CSS || !CSS.escape) return;
	const molde = document.querySelector(`template[data-detalhe="${CSS.escape(registro)}"]`);
	const vivo = document.querySelector("[data-detalhe-vivo]");
	if (!molde || !vivo) return;
	for (const botao of document.querySelectorAll(".a-pesq")) {
		botao.classList.toggle("sel", botao.getAttribute("data-registro") === registro);
	}
	vivo.replaceChildren(molde.content.cloneNode(true));
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
	if (pesquisa) {
		selecionar(pesquisa.getAttribute("data-registro") || "");
		return;
	}
	if (alvo.closest("[data-rever='tres-semanas']")) {
		document.documentElement.dataset.rever = "tres-semanas";
	}
});

progressoDoDia();
setInterval(progressoDoDia, 1000);
