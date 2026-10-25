/**
 * Mapa do Brasil no ao vivo. Passar o mouse, tocar ou focar uma UF mostra o detalhe no painel ao lado.
 * O ao-vivo.js entrega cada leitura de /api/apuracao no evento `apuracao:leitura`.
 */
import { contaUfs, descreverUf, p2 } from "./mapa-tom.mjs";

const nf = new Intl.NumberFormat("pt-BR");

let tocada = null;

function semMovimento() {
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
	const nome = `<b>${esc(d.nome || "")} <small>${esc((d.uf || "").toUpperCase())}</small></b>`;
	const secoes = `${nf.format(Number(d.secoesApuradas) || 0)} de ${nf.format(Number(d.secoes) || 0)} seções`;
	if (uf.classList.contains("a-br-vazio")) {
		return `${nome}<span>Sem seções apuradas · ${secoes}</span>`;
	}
	const l = Number(d.pctL) || 0;
	const f = Number(d.pctF) || 0;
	return `${nome}<span>${p2.format(Number(d.apurado) || 0)}% apurado · ${secoes}</span><span class="a-br-barra"><i class="a-br-cor-l" style="width:${l}%"></i><i class="a-br-cor-f" style="width:${f}%"></i></span><span class="a-br-linha"><span>Lula</span><span><b>${p2.format(l)}%</b> · ${nf.format(Number(d.votosL) || 0)}</span></span><span class="a-br-linha"><span>Flávio</span><span><b>${p2.format(f)}%</b> · ${nf.format(Number(d.votosF) || 0)}</span></span>`;
}

function mostrar(uf) {
	const mapa = raiz();
	if (!mapa) return;
	for (const marcado of mapa.querySelectorAll(".on")) marcado.classList.remove("on");
	mapa.classList.toggle("a-br-foco", Boolean(uf));
	const det = mapa.querySelector("[data-mapa-det]");
	if (!det) return;
	if (det.dataset.dica == null) det.dataset.dica = det.innerHTML;
	if (!uf) {
		det.innerHTML = det.dataset.dica;
		return;
	}
	uf.classList.add("on");
	mapa.querySelector(`[data-rotulo="${uf.dataset.uf}"]`)?.classList.add("on");
	det.innerHTML = htmlDetalhe(uf);
}

function ufTocada() {
	return tocada ? raiz()?.querySelector(`.a-br-uf[data-uf="${tocada}"]`) ?? null : null;
}

function ufDoAlvo(alvo) {
	return alvo instanceof Element ? alvo.closest("[data-mapa-br] .a-br-uf") : null;
}

document.addEventListener("pointerover", (evento) => {
	const uf = ufDoAlvo(evento.target);
	if (uf && evento.pointerType === "mouse") mostrar(uf);
});

document.addEventListener("pointerout", (evento) => {
	if (evento.pointerType !== "mouse" || !ufDoAlvo(evento.target) || ufDoAlvo(evento.relatedTarget)) return;
	mostrar(ufTocada());
});

document.addEventListener("click", (evento) => {
	const uf = ufDoAlvo(evento.target);
	if (uf) {
		tocada = uf.dataset.uf;
		mostrar(uf);
		return;
	}
	if (tocada && raiz() && !evento.target.closest?.("[data-mapa-br]")) {
		tocada = null;
		mostrar(null);
	}
});

document.addEventListener("focusin", (evento) => {
	const uf = ufDoAlvo(evento.target);
	if (uf) mostrar(uf);
});

document.addEventListener("focusout", (evento) => {
	if (ufDoAlvo(evento.target) && !ufDoAlvo(evento.relatedTarget)) mostrar(ufTocada());
});

document.addEventListener("keydown", (evento) => {
	if (evento.key !== "Escape" || !raiz()?.querySelector(".a-br-uf.on")) return;
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

document.addEventListener("apuracao:leitura", (evento) => {
	const mapa = raiz();
	const ufs = evento.detail?.ufs;
	if (!mapa || !ufs || typeof ufs !== "object") return;
	const caminhos = [...mapa.querySelectorAll(".a-br-uf")];
	const animar = !semMovimento();
	for (const uf of caminhos) {
		const sigla = uf.dataset.uf;
		const novo = descreverUf(uf.dataset.nome || sigla, ufs[sigla]);
		Object.assign(uf.dataset, novo.dados);
		const mudouCor = !uf.classList.contains(novo.classe) || (uf.getAttribute("style") || "") !== novo.estilo;
		if (!mudouCor && uf.getAttribute("aria-label") === novo.aria) continue;
		uf.classList.remove("a-br-f", "a-br-l", "a-br-vazio", "a-br-empate");
		uf.classList.add(novo.classe);
		if (novo.estilo) uf.setAttribute("style", novo.estilo);
		else uf.removeAttribute("style");
		uf.setAttribute("aria-label", novo.aria);
		const rotulo = mapa.querySelector(`[data-rotulo="${sigla}"]`);
		const pct = rotulo?.querySelector(".a-br-p");
		if (rotulo && pct) {
			rotulo.classList.toggle("a-br-claro", novo.claro);
			rotulo.classList.toggle("a-br-rot-vazio", novo.lado == null);
			if (pct.textContent !== novo.rotulo) {
				pct.textContent = novo.rotulo;
				if (animar) pct.animate([{ opacity: 0.2 }, { opacity: 1 }], { duration: 600, easing: "ease-out" });
			}
		}
		if (animar && mudouCor) pulsar(uf, novo.classe);
	}
	const conta = contaUfs(ufs, caminhos.map((uf) => uf.dataset.uf));
	for (const lado of ["l", "f"]) {
		const numero = mapa.querySelector(`[data-mapa-n="${lado}"]`);
		if (!numero || numero.textContent === String(conta[lado])) continue;
		numero.textContent = String(conta[lado]);
		if (animar) numero.animate([{ opacity: 0.2 }, { opacity: 1 }], { duration: 600, easing: "ease-out" });
	}
	const ativa = mapa.querySelector(".a-br-uf.on");
	const det = mapa.querySelector("[data-mapa-det]");
	if (ativa && det) det.innerHTML = htmlDetalhe(ativa);
});
