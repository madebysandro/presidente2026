/**
 * PROTOTYPE — barra flutuante (NÃO faz parte do design). Dois eixos:
 *   ?variant=A|B|C            desenho do módulo de pesquisas (← → e as setas da barra)
 *   ?momento=pre|aovivo|encerrado  momento da noite (botões da barra, tecla m)
 */
export const DESENHOS = { A: "Placar", B: "Linha do tempo", C: "Por instituto" };
export const MOMENTOS = {
	pre: { nome: "antes das 17h", mock: "pre" },
	aovivo: { nome: "ao vivo · ~35%", mock: "parcial" },
	encerrado: { nome: "encerrada", mock: "encerrado" },
};
const KD = Object.keys(DESENHOS);
const KM = Object.keys(MOMENTOS);

export function estadoProto() {
	const q = new URLSearchParams(location.search);
	return {
		desenho: DESENHOS[q.get("variant")] ? q.get("variant") : "A",
		momento: MOMENTOS[q.get("momento")] ? q.get("momento") : "pre",
	};
}

function ir(chave, valor) {
	const url = new URL(location.href);
	url.searchParams.set(chave, valor);
	location.assign(url.href);
}

export function montarSwitcher() {
	const { desenho, momento } = estadoProto();
	document.body.dataset.variant = MOMENTOS[momento].mock;
	const banner = document.createElement("div");
	banner.id = "proto-banner";
	banner.innerHTML =
		"<b>PROTÓTIPO</b> · pesquisas: dados reais (registro do TSE de 15/10 + 5 pesquisas da imprensa; média calculada em 15/10) · apuração: números fictícios";
	document.body.prepend(banner);
	const ajustar = () => (document.body.style.paddingTop = `calc(var(--faixa-altura) + ${banner.offsetHeight}px)`);
	ajustar();
	addEventListener("resize", ajustar);

	const bar = document.createElement("div");
	bar.id = "proto-switcher";
	bar.innerHTML = `<button type="button" data-d="-1" aria-label="Desenho anterior">←</button>
    <div class="ps-label"><b>${desenho} — ${DESENHOS[desenho]}</b><small>desenho ${KD.indexOf(desenho) + 1}/${KD.length}</small></div>
    <button type="button" data-d="1" aria-label="Próximo desenho">→</button>
    <span class="ps-sep"></span>
    ${KM.map((k) => `<button type="button" class="ps-mom" data-m="${k}" aria-pressed="${k === momento}">${MOMENTOS[k].nome}</button>`).join("")}`;
	document.body.append(bar);
	const cicloD = (d) => ir("variant", KD[(KD.indexOf(desenho) + d + KD.length) % KD.length]);
	const cicloM = (d) => ir("momento", KM[(KM.indexOf(momento) + d + KM.length) % KM.length]);
	bar.addEventListener("click", (ev) => {
		const b = ev.target.closest("button");
		if (b?.dataset.d) cicloD(Number(b.dataset.d));
		if (b?.dataset.m) ir("momento", b.dataset.m);
	});
	document.addEventListener("keydown", (ev) => {
		const t = ev.target;
		if (t instanceof HTMLInputElement || t instanceof HTMLTextAreaElement || t?.isContentEditable) return;
		if (ev.key === "ArrowLeft") cicloD(-1);
		if (ev.key === "ArrowRight") cicloD(1);
		if (ev.key === "m") cicloM(1);
	});
}
