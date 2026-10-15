/** PROTOTYPE — B · Fiel da balança: uma coluna calma, uma frase e um único gráfico de pontos. */
import { chips, contagem, desligados, diaSemana, esc, fichaTexto, libEfetiva, ligarChips, p1, porExtenso, tendencia, totaisTexto } from "./dados.js";

export const nome = "Fiel da balança";

function balanca(m) {
	const off = desligados();
	const lim = 10;
	const X = (v) => 50 + (v / lim) * 50;
	const vis = m.pub.filter((p) => !off.has(p.cnpj));
	// empilha pontos próximos para não sobrepor
	const ocup = [];
	const pontos = [...vis]
		.sort((a, b) => a.v - b.v)
		.map((p) => {
			let nivel = 0;
			while (ocup.some((o) => o.nivel === nivel && Math.abs(o.x - X(p.v)) < 4.5)) nivel++;
			ocup.push({ x: X(p.v), nivel });
			return `<li class="b-ponto" style="left:${X(p.v)}%;--nivel:${nivel};--c:${p.v >= 0 ? "var(--f)" : "var(--l)"}" tabindex="0"><span class="b-rot">${esc(p.nome)} ${porExtenso(p.data).replace(" de outubro", "/10")}<br>Flávio ${p1.format(p.vf)}, Lula ${p1.format(p.vl)}</span></li>`;
		})
		.join("");
	return `<div class="b-eixo">
      <ol class="b-pontos">${pontos}</ol>
      <span class="b-media" style="left:${X(m.media.v)}%"><span>média</span></span>
      <span class="b-zero"></span>
    </div>
    <div class="b-escala"><span>Lula +10</span><span>empate</span><span>Flávio +10</span></div>`;
}

export function render(m, root) {
	const md = m.media;
	const c = contagem();
	const lista = [...m.pub]
		.reverse()
		.map(
			(p) => `<article class="b-pesq">
        <h3>${esc(p.nome)}, ${diaSemana(p.saiu)}, ${porExtenso(p.saiu)}</h3>
        <p>Flávio ${p1.format(p.vf)}% e Lula ${p1.format(p.vl)}% dos votos válidos. Nos votos totais: ${esc(totaisTexto(p))}.</p>
        <p class="b-ficha">${fichaTexto(p)}</p>
      </article>`,
		)
		.join("");
	const proximas = Object.entries(Object.groupBy(m.vemAi, (r) => libEfetiva(r)))
		.map(([d, rs]) => `<li><b>${porExtenso(d)}</b>: ${rs.map((r) => esc(r.nome)).join(", ")}</li>`)
		.join("");

	root.innerHTML = `<main class="b">
    <p class="b-marca">Presidente 2026, 2º turno</p>
    <p class="b-data">${diaSemana(m.hoje).replace(/^./, (x) => x.toUpperCase())}, ${porExtenso(m.hoje)}. Faltam ${c.d} dias e ${c.h} horas para a votação.</p>
    <h1>Na média das pesquisas, Flávio Bolsonaro tem ${p1.format(md.vf)}% dos votos válidos e Lula, ${p1.format(md.vl)}%.</h1>
    <figure class="b-fig">
      <div data-balanca>${balanca(m)}</div>
      <figcaption>Cada ponto é uma pesquisa registrada no TSE, posicionada pela vantagem em pontos. O traço maior é a média das últimas pesquisas de ${md.n} institutos.</figcaption>
      ${chips(m, "b-chips")}
    </figure>
    <h2>Como a vantagem mudou</h2>
    <div class="b-graf" data-graf></div>
    <h2>As pesquisas</h2>
    ${lista}
    <h2>Próximas pesquisas</h2>
    <p>Já registradas no TSE, ainda sem divulgação permitida:</p>
    <ul class="b-prox">${proximas}</ul>
    <p class="b-nota">Já liberadas e ainda sem números aqui: ${m.semNumero.map((r) => esc(r.nome)).join(", ")}.</p>
    <h2>Como calculamos</h2>
    <p>Usamos a última pesquisa de cada instituto com entrevistas nos últimos 14 dias e tiramos a média simples dos votos válidos, calculados a partir dos votos totais. Pesquisa mede o momento em que foi feita; não prevê o resultado.</p>
  </main>`;

	const repintar = () => {
		root.querySelector("[data-balanca]").innerHTML = balanca(m);
		tendencia(root.querySelector("[data-graf]"), m, { alto: 200 });
	};
	repintar();
	ligarChips(repintar);
	addEventListener("resize", () => tendencia(root.querySelector("[data-graf]"), m, { alto: 200 }));
}
