/** PROTOTYPE — C · Cabo de guerra: a tela é o cabo; rolando, a divisa anda de pesquisa em pesquisa. */
import { F, L, chips, contagem, ddmm, esc, fichaTexto, libEfetiva, ligarChips, p1, porExtenso, tendencia, totaisTexto } from "./dados.js";

export const nome = "Cabo de guerra";

export function render(m, root) {
	const md = m.media;
	const c = contagem();
	// passos: a média, cada pesquisa em ordem de divulgação, e a média de novo
	const passos = [
		{ vf: md.vf, titulo: "Média das pesquisas", texto: `Última pesquisa de cada um de ${md.n} institutos, em votos válidos. Role para ver uma por uma.` },
		...[...m.pub]
			.sort((a, b) => a.saiu.localeCompare(b.saiu))
			.map((p) => ({ vf: p.vf, titulo: `${p.nome}, ${porExtenso(p.saiu)}`, texto: `${esc(totaisTexto(p))}.`, ficha: fichaTexto(p) })),
		{ vf: md.vf, titulo: "De volta à média", texto: `Flávio à frente por ${p1.format(Math.abs(md.v))} pontos. Faltam ${c.d} dias.` },
	];

	root.innerHTML = `<div class="c">
    <div class="c-trilho">
      <section class="c-palco" aria-label="Flávio ${p1.format(md.vf)}%, Lula ${p1.format(md.vl)}% na média">
        <div class="c-campo c-f" style="flex-basis:${md.vf}%">
          <img src="${F.foto}" alt="" class="c-foto"><p class="c-nome">Flávio Bolsonaro<small>PL, 22</small></p><b class="c-pct" data-f>${p1.format(md.vf)}</b>
        </div>
        <div class="c-campo c-l" style="flex-basis:${md.vl}%">
          <img src="${L.foto}" alt="" class="c-foto"><p class="c-nome">Lula<small>PT, 13</small></p><b class="c-pct" data-l>${p1.format(md.vl)}</b>
        </div>
        <i class="c-meio" aria-hidden="true"><span>50%</span></i>
        <p class="c-topo">Presidente 2026, 2º turno <span>${c.d} dias e ${c.h} h para a votação</span></p>
      </section>
      <ol class="c-passos">${passos
				.map(
					(s, i) => `<li class="c-passo" data-i="${i}"><div class="c-cartao"><b>${esc(s.titulo)}</b><p>${s.texto}</p>${s.ficha ? `<p class="c-ficha">${s.ficha}</p>` : ""}</div></li>`,
				)
				.join("")}</ol>
    </div>
    <section class="c-resto">
      <h2>Todas as pesquisas</h2>
      <p>Vantagem em pontos dos votos válidos. Toque num instituto para tirá-lo do gráfico.</p>
      ${chips(m, "c-chips")}
      <div class="c-graf" data-graf></div>
      <h2>Próximas</h2>
      <ul class="c-prox">${m.vemAi.map((r) => `<li><span>${ddmm(libEfetiva(r))}</span>${esc(r.nome)} <small>${esc(r.contratantes.join(", "))}</small></li>`).join("")}</ul>
    </section>
  </div>`;

	const campoF = root.querySelector(".c-f");
	const campoL = root.querySelector(".c-l");
	const nF = root.querySelector("[data-f]");
	const nL = root.querySelector("[data-l]");
	const ir = (vf) => {
		campoF.style.flexBasis = `${vf}%`;
		campoL.style.flexBasis = `${100 - vf}%`;
		nF.textContent = p1.format(vf);
		nL.textContent = p1.format(100 - vf);
	};
	// O passo cujo cartão está mais perto de 70% da altura da tela manda na divisa.
	const cartoes = [...root.querySelectorAll(".c-passo")];
	let atual = -1;
	const escolher = () => {
		const alvo = innerHeight * 0.7;
		let melhor = 0;
		let dist = Infinity;
		cartoes.forEach((el, i) => {
			const r = el.querySelector(".c-cartao").getBoundingClientRect();
			const d = Math.abs((r.top + r.bottom) / 2 - alvo);
			if (d < dist) [melhor, dist] = [i, d];
		});
		if (melhor === atual) return;
		atual = melhor;
		cartoes.forEach((el, i) => el.classList.toggle("ativo", i === melhor));
		ir(passos[melhor].vf);
	};
	let quadro = 0;
	addEventListener("scroll", () => {
		cancelAnimationFrame(quadro);
		quadro = requestAnimationFrame(escolher);
	}, { passive: true });
	escolher();

	const graf = () => tendencia(root.querySelector("[data-graf]"), m, { alto: 240, ate25: true });
	graf();
	ligarChips(graf);
	addEventListener("resize", graf);
}
