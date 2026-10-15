/** PROTOTYPE — A · Três semanas: a reta final é um calendário de 05/10 a 25/10. */
import { F, L, chips, contagem, dia, ddmm, diaSemana, esc, fichaTexto, iso, libEfetiva, ligarChips, n1, p1, porExtenso, tendencia, totaisTexto } from "./dados.js";

export const nome = "Três semanas";

function detalhe(p) {
	return `<div class="a-det-num"><span class="a-f">Flávio <b>${p1.format(p.vf)}</b></span><span class="a-l">Lula <b>${p1.format(p.vl)}</b></span></div>
    <div class="a-barra"><i style="width:${p.vf}%"></i><i style="width:${p.vl}%"></i></div>
    <p class="a-det-tit"><b>${esc(p.nome)}</b>, divulgada em ${porExtenso(p.saiu)}. Votos válidos calculados dos totais (${esc(totaisTexto(p))}${p.validosFlavio != null ? `; o instituto publicou ${n1.format(p.validosFlavio)} a ${n1.format(p.validosLula)}` : ""}).</p>
    <p class="a-ficha">${fichaTexto(p)}</p>`;
}

export function render(m, root) {
	const md = m.media;
	const c = contagem();
	const dias = [];
	for (let d = dia("2026-10-05"); d <= dia("2026-10-25"); d++) dias.push(iso(d));
	const semana = ["seg", "ter", "qua", "qui", "sex", "sáb", "dom"];

	const celula = (d) => {
		const pub = m.pub.filter((p) => p.saiu === d);
		const sem = m.semNumero.filter((r) => libEfetiva(r) === d);
		const vem = m.vemAi.filter((r) => libEfetiva(r) === d);
		const tipo = d === "2026-10-25" ? "eleicao" : d === m.hoje ? "hoje" : d < m.hoje ? "passado" : "futuro";
		const vazio = !pub.length && !sem.length && !vem.length && tipo !== "eleicao" && tipo !== "hoje";
		const corpo =
			tipo === "eleicao"
				? `<p class="a-votacao"><b>Votação</b><br>apuração a partir das 17h</p>`
				: pub
						.map(
							(p) => `<button type="button" class="a-pesq" data-reg="${p.registro}" aria-label="${esc(p.nome)}: Flávio ${p1.format(p.vf)}%, Lula ${p1.format(p.vl)}%">
                <span>${esc(p.nome)}</span><span class="a-mini"><i style="width:${p.vf}%"></i><i style="width:${p.vl}%"></i></span><small>${p1.format(p.vf)} a ${p1.format(p.vl)}</small></button>`,
						)
						.join("") +
					sem.map((r) => `<span class="a-sem">${esc(r.nome)} <small>sem números ainda</small></span>`).join("") +
					vem.map((r) => `<span class="a-vem" title="${esc(r.nome)}: campo de ${ddmm(r.campoInicio)} a ${ddmm(r.campoFim)}, registro ${esc(r.registro)}">${esc(r.nome)}</span>`).join("");
		return `<div class="a-dia ${tipo} ${vazio ? "vazio" : ""}"><span class="a-n">${+d.slice(8, 10)}<small>${diaSemana(d)}</small></span>${tipo === "hoje" ? '<em class="a-hoje">hoje</em>' : ""}${corpo}</div>`;
	};

	const ultima = m.pub.at(-1);
	root.innerHTML = `<div class="a">
    <header class="a-topo">
      <p class="a-marca">Presidente 2026, 2º turno</p>
      <div class="a-veredito">
        <h1><span class="a-f">Flávio ${p1.format(md.vf)}</span> <span class="a-x">a</span> <span class="a-l">Lula ${p1.format(md.vl)}</span></h1>
        <p>É a média das últimas pesquisas de ${md.n} institutos, em votos válidos. Cada quadrado abaixo é um dia da reta final.</p>
      </div>
      <p class="a-conta"><b data-conta>${c.d}</b><span>dias e ${c.h} horas<br>até a votação</span></p>
    </header>
    <section class="a-cal" aria-label="Calendário das pesquisas, de 5 a 25 de outubro">
      ${semana.map((s) => `<span class="a-sem-tit">${s}</span>`).join("")}
      ${dias.map(celula).join("")}
    </section>
    <p class="a-leg"><span class="a-leg-pub">pesquisa divulgada</span><span class="a-leg-vem">registrada no TSE, ainda não divulgada</span><span class="a-leg-sem">liberada, números ainda não cadastrados</span></p>
    <section class="a-det" aria-live="polite">${detalhe(ultima)}</section>
    <section class="a-tend">
      <h2>A vantagem, dia a dia</h2>
      <p>Pontos são pesquisas; a linha é a média. Toque num instituto para tirá-lo do gráfico.</p>
      ${chips(m, "a-chips")}
      <div class="a-graf" data-graf></div>
    </section>
  </div>`;

	const graf = () => tendencia(root.querySelector("[data-graf]"), m, { alto: 220 });
	graf();
	ligarChips(graf);
	addEventListener("resize", graf);
	root.addEventListener("click", (e) => {
		const b = e.target.closest(".a-pesq");
		if (!b) return;
		for (const x of root.querySelectorAll(".a-pesq.sel")) x.classList.remove("sel");
		b.classList.add("sel");
		root.querySelector(".a-det").innerHTML = detalhe(m.pub.find((p) => p.registro === b.dataset.reg));
	});
	root.querySelector(`.a-pesq[data-reg="${ultima.registro}"]`)?.classList.add("sel");
}
