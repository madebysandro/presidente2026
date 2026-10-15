/**
 * PROTOTYPE — entrada do protótipo do 2º turno (substitui js/app.js de produção).
 * Estado fixo por ?variant=. Só Presidente · Brasil (uma tela). Sem /api: tudo local.
 */
import { atualizarFaixaDados, iniciarFaixaStatus, novidadeStatus } from "./movimento/faixa-status.js";
import { capturarFlip, flip } from "./movimento/flip.js";
import { barraViva, ligarBarras } from "./movimento/fluxo-barras.js";
import { gerar } from "./mock-2t.js";
import { estadoProto, MOMENTOS, montarSwitcher } from "./proto-switcher.js";
import { DESENHOS, depois as depoisPQ, modelo } from "./pesquisas.js";
import { alternarTema, aplicarTema, ativar, conta, definirArquivoCongelado, deltaPp, pf, spark, temaSalvo } from "./tela1-util.js";
import { cartaoColegios, cartaoComparacao, cartaoComparecimento, cartaoDuelo, cartaoEstados, cartaoExterior, destaques2t, pintarMargem } from "./tela-2t.js";

const app = document.querySelector("#app");
aplicarTema(temaSalvo());
const { desenho, momento } = estadoProto();
const variante = MOMENTOS[momento].mock;
const D = DESENHOS[desenho];
montarSwitcher();

const [e1, col, pesqDados] = await Promise.all(["dados/estado-1t.json", "dados/colegios-1t.json", "dados/pesquisas.json"].map(async (u) => (await fetch(u)).json()));
const pq = modelo(pesqDados);
const { dados, hist, viradas } = gerar(e1, col, variante);
const P = dados.cargos.presidente;
const pre = variante === "pre";
const encerrada = variante === "encerrado";

iniciarFaixaStatus({ obterHoraTse: () => (pre ? "17:00" : P.hora), onTema: () => alternarTema() });
atualizarFaixaDados(dados);
// Mantém o anel girando nas variantes ao vivo (o poller real renova proximaConsulta).
if (!encerrada) setInterval(() => {
	if (dados.proximaConsulta < Date.now()) {
		dados.consultadoEm = Date.now();
		dados.proximaConsulta = Date.now() + 50_000;
	}
}, 1000);

function kpi(rot, k, valor, serie, sub, barra = false) {
	const ant = serie.length > 1 ? serie.at(-2) : null;
	return `<div class="db-kpi"><span class="db-kpi-rot">${rot}</span><b class="db-kpi-val">${conta(k, valor, "p")}</b>
    ${barra ? barraViva(k, valor, ant, ant == null ? 0 : Math.min(1, (valor - ant) / 4), "var(--acento)") : ""}
    <span class="db-kpi-sub">${sub}</span>${spark(serie, 72, 22, !encerrada)}</div>`;
}

function kpis() {
	const T1 = e1.cargos.presidente.totais;
	const zz = dados.ufs.zz;
	const vs1 = (v, v1) => (pre ? `1º turno: ${pf.format(v1)}%` : `${deltaPp(v - v1, true)} p.p. vs 1º turno (${pf.format(v1)}%)`);
	const ultima = hist.at(-1);
	return `<section class="db-kpis">
    ${kpi("Seções apuradas · Brasil", "k-br", P.apurado, hist.map((h) => h.c.presidente.ap), pre ? "469.329 seções no 2º turno" : `${hist.length > 1 ? deltaPp(P.apurado - hist.at(-2).c.presidente.ap, true) + " p.p. na última leitura" : ""}`, true)}
    ${kpi("Comparecimento · Brasil", "k-cbr", P.totais.comparecimento, [], vs1(P.totais.comparecimento, T1.comparecimento))}
    ${kpi("Abstenção · Brasil", "k-abr", P.totais.abstencao, [], vs1(P.totais.abstencao, T1.abstencao))}
    ${kpi("Seções apuradas · Exterior", "k-zz", zz.apurado, hist.map((h) => h.c.zz.ap), pre ? `${zz.secoes.toLocaleString("pt-BR")} seções fora do país` : "o exterior apura por último", true)}
    <div class="db-kpi"><span class="db-kpi-rot">${encerrada ? "Última atualização" : "Acompanhamento"}</span>
      <b class="db-kpi-val">${pre ? "—" : encerrada ? P.hora : `${hist.length} leituras`}</b>
      <span class="db-kpi-sub">${pre ? "1ª leitura logo após as 17h" : encerrada ? "resultado final do 2º turno" : `desde ${hist[0].c.presidente.hora.slice(0, 5)} · última ${ultima.c.presidente.hora.slice(0, 5)}`}</span></div>
  </section>`;
}

function corpo() {
	const ctx = { P, an: dados.analise.majoritarias.presidente, hist, viradas, ufs: dados.ufs, colegios: dados.colegios, compExterior: dados.compExterior, e1, col, pre, encerrada };
	// PROTO-PESQ: cartão das pesquisas ao vivo/encerrada (A e C na coluna da direita; B em faixa inteira).
	const extra = pre ? "" : encerrada ? D.encerrado(pq, P) : D.aoVivo(pq, P);
	const direita = desenho !== "B";
	return `<div class="t2-grade ${extra && direita ? "pq-com-cartao" : ""}">
      ${cartaoDuelo(ctx)}
      ${direita ? extra : ""}
      ${cartaoExterior(ctx)}
      ${cartaoComparecimento(ctx)}
      ${cartaoComparacao(ctx)}
      ${direita ? "" : extra}
      ${cartaoEstados(ctx)}
      ${cartaoColegios(ctx)}
    </div>`;
}

const refMargem = !pre && desenho === "B" ? D.refMargem(pq) : null;

function pintar(entrada) {
	const antes = capturarFlip();
	definirArquivoCongelado(encerrada);
	const mdTxt = `<b>Pesquisas</b>média de ${pq.media.n} institutos: Flávio ${pf.format(pq.media.vf)}% × Lula ${pf.format(pq.media.vl)}% dos válidos`;
	const itens = [...(pre ? [mdTxt] : []), ...destaques2t({ P, ufs: dados.ufs, colegios: dados.colegios, viradas, pre, encerrada })].map((d) => `<span>${d}</span>`).join("");
	app.classList.toggle("db-entrada", entrada);
	app.innerHTML = `<div class="db">
    <header class="db-topo">
      <div class="db-marca"><b>Presidente 2026 · 2º turno</b><span>Pesquisas registradas no TSE e apuração ao vivo · 25/10</span></div>
    </header>
    <div class="db-ticker" aria-label="Destaques do 2º turno"><b><i></i>DESTAQUES</b>
      <div class="db-janela"><div class="db-rolo">${itens}${itens}</div></div></div>
    ${pre ? `${D.pre(pq)}<h2 class="pq-secao">Apuração <small>começa às 17h de 25/10 · o arquivo oficial do 2º turno já está publicado, zerado</small></h2>` : kpis()}
    <main class="db-tela">${corpo()}</main>
    <p class="db-rodape">Estimativas de votos a apurar, virada e "para onde foram os votos" supõem que as seções ainda não apuradas se comportam como as já apuradas; o TSE não publica transferência de votos entre turnos. Use-as como referência, não como previsão.
      <span class="db-arquivo">Fonte oficial: <a href="https://resultados.tse.jus.br/" target="_blank" rel="noopener">resultados.tse.jus.br</a>.</span></p>
  </div>`;
	ativar();
	pintarMargem(hist, viradas, refMargem);
	if (!pre && desenho === "B") D.marcar(pq);
	depoisPQ(pq);
	ligarBarras();
	flip(antes);
	app.classList.remove("db-entrada");
}

let redim;
addEventListener("resize", () => {
	clearTimeout(redim);
	redim = setTimeout(() => pintarMargem(hist, viradas, refMargem), 150);
});

pintar(true);
if (variante === "virada" && viradas.length) {
	const a = hist.at(-2).c.presidente.ap;
	setTimeout(() => novidadeStatus(`Atualizado às ${P.hora} · Brasil ${pf.format(a)}% → ${pf.format(P.apurado)}% · mudou a liderança em Presidente`), 900);
}
