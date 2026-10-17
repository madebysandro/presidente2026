/**
 * Vinheta em três atos, varredura do calendário e balanço da divisa.
 * Animações infinitas (CSS ou o balanço) nunca recebem finish(): isso lança.
 */
(() => {
const EASE = "cubic-bezier(.2, .8, .2, 1)";
const PASSO = 110;

function calmo() {
	return matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function telaEstreita() {
	return matchMedia("(max-width: 760px)").matches;
}

function formatar(n) {
	return new Intl.NumberFormat("pt-BR", {
		minimumFractionDigits: 1,
		maximumFractionDigits: 1,
	}).format(n);
}

function textoInstitutos(n) {
	const num = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 1 }).format(n);
	return `${num} instituto${n === 1 ? "" : "s"}`;
}

function lerDados() {
	const bruto = document.querySelector("main")?.getAttribute("data-abertura");
	if (!bruto) return null;
	try {
		const dados = JSON.parse(bruto);
		return dados && typeof dados === "object" ? dados : null;
	} catch {
		return null;
	}
}

function diasRestantes() {
	const topo = document.querySelector("[data-alvo-votacao]");
	const alvo = Date.parse(topo?.getAttribute("data-alvo-votacao") || "");
	if (!Number.isFinite(alvo)) return 0;
	return Math.max(0, Math.floor((alvo - Date.now()) / 86400000));
}

function pausarRelogio(pausa) {
	if (pausa) document.documentElement.dataset.pausaRelogio = "1";
	else delete document.documentElement.dataset.pausaRelogio;
}

function marcarAbertura(ativa) {
	if (ativa) document.documentElement.dataset.abertura = "1";
	else delete document.documentElement.dataset.abertura;
}

let aberturaAtiva = false;
let varreduraComeçou = false;
let epoca = 0;
let timersVinheta = [];
let timersVarredura = [];

function limpar(lista) {
	for (const id of lista) clearTimeout(id);
	lista.length = 0;
}

function infinita(animacao) {
	if (animacao.id === "continuo") return true;
	const iteracoes = animacao.effect?.getTiming?.().iterations;
	return iteracoes === Infinity;
}

/** Cancela o que é finito. Não chama finish() — infinita lança InvalidStateError. */
function encerrarFinitas(raiz) {
	for (const animacao of raiz.getAnimations({ subtree: true })) {
		if (infinita(animacao)) continue;
		animacao.cancel();
	}
}

function estadoFinal() {
	const dados = lerDados();
	if (!dados) return;
	const vf = document.querySelector("[data-vf]");
	const vl = document.querySelector("[data-vl]");
	if (vf && Number.isFinite(dados.vf)) {
		vf.setAttribute("data-v", String(dados.vf));
		vf.textContent = formatar(dados.vf);
	}
	if (vl && Number.isFinite(dados.vl)) {
		vl.setAttribute("data-v", String(dados.vl));
		vl.textContent = formatar(dados.vl);
	}
	const institutos = document.querySelector("[data-institutos]");
	if (institutos && Number.isFinite(dados.n)) institutos.textContent = textoInstitutos(dados.n);
	const conta = document.querySelector("[data-conta]");
	if (conta) conta.textContent = String(diasRestantes());
}

function balanco() {
	if (calmo()) return;
	const faixa = document.querySelector(".a-cabo-f");
	if (!faixa || faixa.getAnimations().some((animacao) => animacao.id === "continuo")) return;
	const base = Number(faixa.getAttribute("data-base"));
	const margem = Number(faixa.getAttribute("data-margem"));
	if (!Number.isFinite(base) || !Number.isFinite(margem)) return;
	faixa.animate([{ width: `${base - margem * 0.8}%` }, { width: `${base + margem * 0.8}%` }], {
		duration: 5200,
		direction: "alternate",
		iterations: Infinity,
		easing: "ease-in-out",
		id: "continuo",
	});
}

function liberarPagina() {
	document.documentElement.style.overflow = "";
	const main = document.querySelector("main");
	if (main) main.inert = false;
}

function tirarOverlay() {
	document.querySelector(".a-intro")?.remove();
	liberarPagina();
}

function pular() {
	if (!aberturaAtiva) return;
	epoca += 1;
	aberturaAtiva = false;
	varreduraComeçou = false;
	limpar(timersVinheta);
	limpar(timersVarredura);
	removeEventListener("keydown", noTeclado);
	tirarOverlay();
	encerrarFinitas(document);
	estadoFinal();
	pausarRelogio(false);
	marcarAbertura(false);
	balanco();
}

function noTeclado(evento) {
	if (!aberturaAtiva) return;
	evento.preventDefault();
	pular();
}

function rolar(el, texto) {
	const proximo = String(texto);
	const epocaDesta = epoca;
	if (el.textContent === proximo) return;
	if (calmo()) {
		el.textContent = proximo;
		return;
	}
	const saida = el.animate(
		[
			{ transform: "none", opacity: 1 },
			{ transform: "translateY(-35%)", opacity: 0 },
		],
		{ duration: 90, easing: "ease-in" },
	);
	saida.onfinish = () => {
		if (epocaDesta !== epoca) return;
		el.textContent = proximo;
		el.animate(
			[
				{ transform: "translateY(35%)", opacity: 0 },
				{ transform: "none", opacity: 1 },
			],
			{ duration: 160, easing: EASE },
		);
	};
}

function contar(el, para, ms = 650) {
	const bruto = el.getAttribute("data-v");
	const de = bruto == null || bruto === "" ? para : Number(bruto);
	const epocaDesta = epoca;
	el.setAttribute("data-v", String(para));
	if (!Number.isFinite(para)) return;
	if (calmo() || !Number.isFinite(de) || de === para) {
		el.textContent = formatar(para);
		return;
	}
	const t0 = performance.now();
	const passo = (t) => {
		if (epocaDesta !== epoca) return;
		const k = Math.min(1, (t - t0) / ms);
		el.textContent = formatar(de + (para - de) * (1 - (1 - k) ** 3));
		if (k < 1) requestAnimationFrame(passo);
	};
	requestAnimationFrame(passo);
}

function animar(el, quadros, opcoes) {
	return el.animate(quadros, { easing: EASE, fill: "both", ...opcoes });
}

function abrir() {
	if (varreduraComeçou) return;
	varreduraComeçou = true;
	limpar(timersVarredura);
	const dados = lerDados();
	const celulas = [...document.querySelectorAll(".a-dia")];
	const iHoje = celulas.findIndex((celula) => celula.getAttribute("data-d") === dados?.hoje);
	if (!dados || iHoje < 0) {
		estadoFinal();
		aberturaAtiva = false;
		marcarAbertura(false);
		pausarRelogio(false);
		removeEventListener("keydown", noTeclado);
		return;
	}
	const vf = document.querySelector("[data-vf]");
	const vl = document.querySelector("[data-vl]");
	const conta = document.querySelector("[data-conta]");
	const titulo = document.querySelector(".a-veredito h1");
	const tHoje = iHoje * PASSO;
	if (titulo) animar(titulo, [{ opacity: 0 }, { opacity: 1 }], { duration: 400, delay: 3 * PASSO });

	celulas.forEach((celula, i) => {
		const futuro = i > iHoje;
		const t = futuro ? tHoje + 380 + (i - iHoje) * 45 : i * PASSO;
		// Na coluna invertida o futuro é o topo. fill "both" seguraria esses cards em opacity 0 durante o atraso.
		if (!(futuro && telaEstreita())) {
			animar(
				celula,
				futuro
					? [
							{ opacity: 0, transform: "translateY(6px)" },
							{ opacity: 1, transform: "none" },
						]
					: [{ opacity: 0.25 }, { opacity: 1 }],
				{ delay: t, duration: futuro ? 300 : 260 },
			);
			[...celula.querySelectorAll(".a-item")].forEach((item, j) => {
				animar(
					item,
					[
						{ opacity: 0, transform: "translateY(-10px)" },
						{ opacity: 1, transform: "none" },
					],
					{ delay: t + 70 + j * 70, duration: 380 },
				);
				[...item.querySelectorAll(".a-mini i")].forEach((fatia, k) => {
					fatia.style.transformOrigin = k ? "left" : "right";
					animar(fatia, [{ transform: "scaleX(0)" }, { transform: "scaleX(1)" }], {
						delay: t + 140 + j * 70,
						duration: 520,
					});
				});
			});
		}
		if (futuro) return;
		const id = setTimeout(() => {
			if (conta) rolar(conta, diasRestantes() + (iHoje - i));
			const dia = celula.getAttribute("data-d");
			const passo = dados.passos.find((item) => item.data === dia);
			if (!passo || !vf || !vl) return;
			contar(vf, passo.vf);
			contar(vl, passo.vl);
			const institutos = document.querySelector("[data-institutos]");
			if (institutos) institutos.textContent = textoInstitutos(passo.n);
		}, t);
		timersVarredura.push(id);
	});

	const hoje = celulas[iHoje];
	animar(hoje, [{ boxShadow: "inset 0 0 0 0 #17202B" }, { boxShadow: "inset 0 0 0 2px #17202B" }], {
		delay: tHoje,
		duration: 500,
	});
	const selo = hoje.querySelector(".a-hoje");
	if (selo) {
		animar(selo, [{ opacity: 0, transform: "scale(.6)" }, { opacity: 1, transform: "none" }], {
			delay: tHoje + 120,
			duration: 400,
		});
	}
	const eleicao = celulas.at(-1);
	if (eleicao) {
		eleicao.animate(
			[{ transform: "scale(.94)" }, { transform: "scale(1.03)" }, { transform: "none" }],
			{ delay: tHoje + 380 + (celulas.length - 1 - iHoje) * 45, duration: 600, easing: EASE },
		);
	}
	const fim = setTimeout(() => {
		if (!aberturaAtiva) return;
		epoca += 1;
		estadoFinal();
		aberturaAtiva = false;
		marcarAbertura(false);
		pausarRelogio(false);
		removeEventListener("keydown", noTeclado);
		balanco();
	}, tHoje + 900);
	timersVarredura.push(fim);
}

function videoDoLado(poster, webm, mp4) {
	const el = document.createElement("video");
	el.className = "a-i-multidao";
	el.poster = poster;
	el.muted = true;
	el.defaultMuted = true;
	el.playsInline = true;
	el.preload = "auto";
	el.setAttribute("muted", "");
	el.setAttribute("playsinline", "");
	el.setAttribute("webkit-playsinline", "");
	const fonteWebm = document.createElement("source");
	fonteWebm.src = webm;
	fonteWebm.type = "video/webm";
	const fonteMp4 = document.createElement("source");
	fonteMp4.src = mp4;
	fonteMp4.type = "video/mp4";
	el.append(fonteWebm, fonteMp4);
	return el;
}

function lado(classe, poster, webm, mp4, foto, nome, numero, largura) {
	const faixa = document.createElement("i");
	faixa.className = classe;
	if (largura != null) faixa.style.width = `${largura}%`;
	faixa.append(videoDoLado(poster, webm, mp4));
	const rosto = document.createElement("img");
	rosto.className = "a-i-rosto";
	rosto.src = foto;
	rosto.alt = "";
	rosto.width = 161;
	rosto.height = 225;
	const texto = document.createElement("span");
	texto.append(document.createTextNode(nome));
	const valor = document.createElement("b");
	valor.textContent = numero;
	texto.append(valor);
	faixa.append(rosto, texto);
	return faixa;
}

function vinheta() {
	if (calmo()) return;
	const dados = lerDados();
	const fotos = [...document.querySelectorAll(".a-ponta")].map((img) => img.getAttribute("src") || "");
	const vf = document.querySelector("[data-vf]");
	const vl = document.querySelector("[data-vl]");
	if (!dados || dados.vf == null || fotos.length < 2 || !vf || !vl || !document.querySelector(".a-cabo")) return;

	varreduraComeçou = false;
	limpar(timersVinheta);
	document.querySelector(".a-intro")?.remove();
	aberturaAtiva = true;
	marcarAbertura(true);
	pausarRelogio(true);
	document.documentElement.style.overflow = "hidden";
	const main = document.querySelector("main");
	if (main) main.inert = true;

	const ov = document.createElement("div");
	ov.className = "a-intro";
	ov.setAttribute("aria-hidden", "true");
	const faixa = document.createElement("div");
	faixa.className = "a-i-faixa";
	faixa.append(
		lado(
			"a-i-f",
			"/midia/multidao-flavio.jpg",
			"/midia/multidao-flavio.webm",
			"/midia/multidao-flavio.mp4",
			fotos[0],
			"Flávio",
			vf.textContent || "",
			dados.vf,
		),
		lado(
			"a-i-l",
			"/midia/multidao-lula.jpg",
			"/midia/multidao-lula.webm",
			"/midia/multidao-lula.mp4",
			fotos[1],
			"Lula",
			vl.textContent || "",
		),
	);
	const meio = document.createElement("em");
	const ia = document.createElement("small");
	ia.className = "a-i-ia";
	ia.textContent = "Imagens geradas por IA";
	faixa.append(meio, ia);

	const bloco = document.createElement("div");
	bloco.className = "a-i-txt";
	const data = document.createElement("p");
	data.className = "a-i-data";
	const dataSpan = document.createElement("span");
	dataSpan.textContent = "25 de outubro";
	data.append(dataSpan);
	const sub = document.createElement("p");
	sub.className = "a-i-sub";
	sub.textContent = "2º turno para presidente";
	const faltam = document.createElement("p");
	faltam.className = "a-i-faltam";
	faltam.append(document.createTextNode("faltam "));
	const nDias = document.createElement("b");
	nDias.textContent = "20";
	faltam.append(nDias, document.createTextNode(" dias"));
	bloco.append(data, sub, faltam);
	ov.append(faixa, bloco);
	document.body.append(ov);

	const passos = Math.max(0, 20 - diasRestantes());
	animar(dataSpan, [{ transform: "translateY(110%)" }, { transform: "none" }], { duration: 700 });
	animar(sub, [{ opacity: 0 }, { opacity: 1 }], { delay: 300, duration: 500 });
	animar(faltam, [{ opacity: 0, transform: "translateY(8px)" }, { opacity: 1, transform: "none" }], {
		delay: 500,
		duration: 400,
	});
	for (let k = 1; k <= passos; k++) {
		const id = setTimeout(() => rolar(nDias, 20 - k), 700 + k * 55);
		timersVinheta.push(id);
	}
	const t1 = 700 + passos * 55 + 300;
	animar(bloco, [{ opacity: 1 }, { opacity: 0 }], { delay: t1, duration: 300 });
	animar(faixa.querySelector(".a-i-f"), [{ clipPath: "inset(0 100% 0 0)" }, { clipPath: "inset(0 0 0 0)" }], {
		delay: t1,
		duration: 700,
	});
	animar(faixa.querySelector(".a-i-l"), [{ clipPath: "inset(0 0 0 100%)" }, { clipPath: "inset(0 0 0 0)" }], {
		delay: t1,
		duration: 700,
	});
	const toca = setTimeout(() => {
		for (const video of ov.querySelectorAll("video")) video.play().catch(() => {});
	}, t1);
	timersVinheta.push(toca);
	animar(
		faixa.querySelector(".a-i-f .a-i-multidao"),
		[{ transform: "translateX(-5%) scale(1.1)" }, { transform: "translateX(3%) scale(1.1)" }],
		{ delay: t1, duration: 3200, easing: "linear" },
	);
	animar(
		faixa.querySelector(".a-i-l .a-i-multidao"),
		[{ transform: "translateX(5%) scale(1.1)" }, { transform: "translateX(-3%) scale(1.1)" }],
		{ delay: t1, duration: 3200, easing: "linear" },
	);
	animar(ia, [{ opacity: 0 }, { opacity: 0.85 }], { delay: t1 + 600, duration: 400 });
	animar(meio, [{ transform: "scaleY(0)" }, { transform: "none" }], { delay: t1 + 500, duration: 500 });
	for (const rosto of ov.querySelectorAll(".a-i-rosto")) {
		animar(rosto, [{ opacity: 0, transform: "translateY(40px) scale(.9)" }, { opacity: 1, transform: "none" }], {
			delay: t1 + 250,
			duration: 650,
		});
		animar(rosto, [{ opacity: 1 }, { opacity: 0 }], { delay: t1 + 1900, duration: 200, fill: "forwards" });
	}
	for (const [seletor, x] of [
		[".a-i-f span", -40],
		[".a-i-l span", 40],
	]) {
		const el = faixa.querySelector(seletor);
		animar(el, [{ opacity: 0, transform: `translateX(${x}px)` }, { opacity: 1, transform: "none" }], {
			delay: t1 + 350,
			duration: 500,
		});
		animar(el, [{ opacity: 1 }, { opacity: 0 }], { delay: t1 + 1900, duration: 200, fill: "forwards" });
	}

	const t2 = t1 + 2050;
	const voo = setTimeout(() => {
		if (!aberturaAtiva || !ov.isConnected) return;
		liberarPagina();
		abrir();
		const alvo = document.querySelector(".a-cabo")?.getBoundingClientRect();
		const r = faixa.getBoundingClientRect();
		if (!alvo || !(r.width > 0) || !(r.height > 0)) {
			tirarOverlay();
			return;
		}
		const queda = animar(
			faixa,
			[
				{ transform: "none" },
				{
					transform: `translate(${alvo.left - r.left}px, ${alvo.top - r.top}px) scale(${alvo.width / r.width}, ${alvo.height / r.height})`,
				},
			],
			{ duration: 750 },
		);
		animar(ov, [{ backgroundColor: "rgb(242 244 247)" }, { backgroundColor: "rgb(242 244 247 / 0)" }], {
			duration: 750,
		});
		queda.finished
			.then(() => {
				const espera = setTimeout(() => {
					if (ov.isConnected) tirarOverlay();
				}, 50);
				timersVinheta.push(espera);
			})
			.catch(() => {});
	}, t2);
	timersVinheta.push(voo);
	removeEventListener("keydown", noTeclado);
	addEventListener("keydown", noTeclado);
}

document.addEventListener(
	"pointerdown",
	(evento) => {
		if (!aberturaAtiva) return;
		const alvo = evento.target instanceof Element ? evento.target : null;
		if (alvo?.closest("[data-rever]")) return;
		pular();
	},
	true,
);

document.addEventListener("click", (evento) => {
	const alvo = evento.target instanceof Element ? evento.target : null;
	if (!alvo?.closest("[data-rever]")) return;
	evento.preventDefault();
	evento.stopPropagation();
	const suave = !calmo();
	scrollTo({ top: 0, behavior: suave ? "smooth" : "auto" });
	setTimeout(() => {
		pular();
		if (!calmo()) vinheta();
	}, suave ? 350 : 0);
});

if (calmo() || !document.querySelector(".a-cabo")) balanco();
else {
	balanco();
	vinheta();
}
})();
