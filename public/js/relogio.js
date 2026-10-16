function dois(n) {
	return String(n).padStart(2, "0");
}

function partes(ms) {
	const falta = Math.max(0, ms);
	const dias = Math.floor(falta / 86400000);
	const h = Math.floor((falta % 86400000) / 3600000);
	const m = Math.floor((falta % 3600000) / 60000);
	const s = Math.floor((falta % 60000) / 1000);
	return { dias, relogio: `${dois(h)}:${dois(m)}:${dois(s)}` };
}

function odometro(el, texto) {
	if (el.childElementCount !== texto.length) {
		el.innerHTML = [...texto]
			.map((ch) =>
				/\d/.test(ch)
					? `<span class="odo"><span>${[..."0123456789"].join("<br>")}</span></span>`
					: `<span class="odo-sep">${ch}</span>`,
			)
			.join("");
	}
	[...texto].forEach((ch, i) => {
		const col = el.children[i] && el.children[i].firstElementChild;
		if (col) col.style.transform = `translateY(${-Number(ch)}em)`;
	});
}

function textoFalta(ms) {
	if (!(ms > 0)) return "já liberadas";
	const horas = Math.floor(ms / 3600000);
	const min = Math.floor((ms % 3600000) / 60000);
	return `em ${horas} h ${dois(min)} min`;
}

function tique() {
	const topo = document.querySelector("[data-alvo-votacao]");
	if (topo) {
		const alvo = Date.parse(topo.getAttribute("data-alvo-votacao") || "");
		if (Number.isFinite(alvo)) {
			const conta = partes(alvo - Date.now());
			const dias = topo.querySelector("[data-conta]");
			const relogio = topo.querySelector("[data-relogio]");
			if (dias) dias.textContent = String(conta.dias);
			if (relogio) odometro(relogio, conta.relogio);
		}
	}
	const proxima = document.querySelector("[data-proxima]");
	if (proxima) {
		const alvo = Date.parse(proxima.getAttribute("data-alvo-liberacao") || "");
		if (Number.isFinite(alvo)) proxima.textContent = textoFalta(alvo - Date.now());
	}
}

tique();
setInterval(tique, 1000);
