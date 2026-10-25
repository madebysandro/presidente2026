/**
 * Mapa do Brasil no ao vivo (#131). Passar o mouse, tocar ou focar uma UF mostra o detalhe.
 * A cada leitura o ao-vivo.js entrega o JSON de /api/apuracao no evento `apuracao`;
 * as UFs que mudaram trocam de cor com transição e um pulso no contorno.
 */
import { descreverUf, textoConta } from "./mapa-tom.mjs";

const p2 = new Intl.NumberFormat("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const nf = new Intl.NumberFormat("pt-BR");
const DICA = "Passe o mouse ou toque num estado para ver os números.";

let tocada = null;

function calmo() {
	return matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function raiz() {
	return document.querySelector("[data-mapa-br]");
}

function esc(texto) {
	return String(texto).replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
}

function htmlDetalhe(uf) {
	const d = uf.dataset;
	const nome = `<b>${esc(d.nome || "")}</b>`;
	const secoes = `${nf.format(Number(d.sa) || 0)} de ${nf.format(Number(d.s) || 0)} seções`;
	if (uf.classList.contains("a-br-vazio")) {
		return `${nome}<span class="a-br-tip-ap">Sem seções apuradas · ${secoes}</span>`;
	}
	const f = Number(d.f) || 0;
	const l = Number(d.l) || 0;
	return `${nome}<span class="a-br-tip-ap">${p2.format(Number(d.ap) || 0)}% apurado · ${secoes}</span><span class="a-br-tip-barra"><i class="a-br-cor-f" style="width:${f}%"></i><i class="a-br-cor-l" style="width:${l}%"></i></span><span class="a-br-tip-linha"><span>Flávio</span><span><b>${p2.format(f)}%</b> · ${nf.format(Number(d.vf) || 0)}</span></span><span class="a-br-tip-linha"><span>Lula</span><span><b>${p2.format(l)}%</b> · ${nf.format(Number(d.vl) || 0)}</span></span>`;
}

function posicionar(mapa, x, y) {
	const tip = mapa.querySelector("[data-mapa-tip]");
	const quadro = mapa.querySelector(".a-br-quadro");
	if (!tip || !quadro) return;
	const caixa = quadro.getBoundingClientRect();
	let esquerda = x - caixa.left + 16;
	if (esquerda + tip.offsetWidth > caixa.width) esquerda = Math.max(0, x - caixa.left - tip.offsetWidth - 16);
	tip.style.left = `${esquerda}px`;
	tip.style.top = `${Math.max(0, y - caixa.top + 16)}px`;
}

function mostrar(uf, x, y) {
	const mapa = raiz();
	if (!mapa) return;
	for (const outra of mapa.querySelectorAll(".a-br-uf.on")) if (outra !== uf) outra.classList.remove("on");
	mapa.classList.toggle("a-br-foco", Boolean(uf));
	const tip = mapa.querySelector("[data-mapa-tip]");
	const det = mapa.querySelector("[data-mapa-det]");
	if (!uf) {
		if (tip) tip.hidden = true;
		if (det) det.textContent = DICA;
		return;
	}
	uf.classList.add("on");
	const html = htmlDetalhe(uf);
	if (det) det.innerHTML = html;
	if (!tip) return;
	tip.innerHTML = html;
	tip.hidden = false;
	if (x == null || y == null) {
		const caixa = uf.getBoundingClientRect();
		x = caixa.left + caixa.width / 2;
		y = caixa.top + caixa.height / 2;
	}
	posicionar(mapa, x, y);
}

function ufDoEvento(evento) {
	const alvo = evento.target;
	return alvo instanceof Element ? alvo.closest("[data-mapa-br] .a-br-uf") : null;
}

document.addEventListener("pointerover", (evento) => {
	const uf = ufDoEvento(evento);
	if (uf && evento.pointerType === "mouse") mostrar(uf, evento.clientX, evento.clientY);
});

document.addEventListener("pointermove", (evento) => {
	const mapa = raiz();
	if (mapa && evento.pointerType === "mouse" && ufDoEvento(evento)) posicionar(mapa, evento.clientX, evento.clientY);
});

document.addEventListener("pointerout", (evento) => {
	const uf = ufDoEvento(evento);
	if (!uf || evento.pointerType !== "mouse") return;
	const destino = evento.relatedTarget instanceof Element ? evento.relatedTarget.closest(".a-br-uf") : null;
	if (destino) return;
	const fixa = raiz()?.querySelector(`.a-br-uf[data-uf="${tocada}"]`);
	mostrar(fixa ?? null);
});

document.addEventListener("click", (evento) => {
	const uf = ufDoEvento(evento);
	if (uf) {
		tocada = uf.dataset.uf;
		mostrar(uf, evento.clientX, evento.clientY);
		return;
	}
	if (tocada && raiz() && !evento.target.closest?.("[data-mapa-br]")) {
		tocada = null;
		mostrar(null);
	}
});

document.addEventListener("focusin", (evento) => {
	const uf = ufDoEvento(evento);
	if (uf) mostrar(uf);
});

document.addEventListener("keydown", (evento) => {
	if (evento.key !== "Escape" || !raiz()) return;
	tocada = null;
	mostrar(null);
});

function pulsar(uf, classe) {
	const guias = uf.ownerSVGElement?.querySelector(".a-br-guias");
	if (!guias) return;
	const pulso = document.createElementNS("http://www.w3.org/2000/svg", "path");
	pulso.setAttribute("d", uf.getAttribute("d") || "");
	pulso.setAttribute("class", `a-br-pulso ${classe}`);
	guias.append(pulso);
	pulso.addEventListener("animationend", () => pulso.remove());
	setTimeout(() => pulso.remove(), 2000);
}

document.addEventListener("apuracao", (evento) => {
	const mapa = raiz();
	const ufs = evento.detail?.ufs;
	if (!mapa || !ufs || typeof ufs !== "object") return;
	const caminhos = [...mapa.querySelectorAll(".a-br-uf")];
	const animar = !calmo();
	for (const uf of caminhos) {
		const sigla = uf.dataset.uf;
		const novo = descreverUf(uf.dataset.nome || sigla, ufs[sigla]);
		const mudouCor = !uf.classList.contains(novo.classe) || (uf.getAttribute("style") || "") !== novo.estilo;
		if (!mudouCor && uf.getAttribute("aria-label") === novo.aria) continue;
		uf.setAttribute("class", `a-br-uf ${novo.classe}${uf.classList.contains("on") ? " on" : ""}`);
		if (novo.estilo) uf.setAttribute("style", novo.estilo);
		else uf.removeAttribute("style");
		uf.setAttribute("aria-label", novo.aria);
		Object.assign(uf.dataset, novo.dados);
		const rotulo = mapa.querySelector(`[data-rotulo="${sigla}"]`);
		if (rotulo) {
			rotulo.classList.toggle("a-br-claro", novo.claro);
			rotulo.classList.toggle("a-br-rot-vazio", novo.classe === "a-br-vazio");
			const pct = rotulo.querySelector(".a-br-p");
			if (pct) pct.textContent = novo.rotulo;
		}
		if (animar && mudouCor) pulsar(uf, novo.classe);
	}
	const conta = mapa.querySelector("[data-mapa-conta]");
	if (conta) conta.innerHTML = textoConta(ufs, caminhos.map((uf) => uf.dataset.uf));
	const ativa = mapa.querySelector(".a-br-uf.on");
	if (ativa) {
		const tip = mapa.querySelector("[data-mapa-tip]");
		const det = mapa.querySelector("[data-mapa-det]");
		const html = htmlDetalhe(ativa);
		if (tip && !tip.hidden) tip.innerHTML = html;
		if (det) det.innerHTML = html;
	}
});
