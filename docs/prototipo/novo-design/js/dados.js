/**
 * PROTOTYPE — modelo das pesquisas (compartilhado pelas 3 direções). Descartável.
 * Dados reais: dados/pesquisas.json = 33 registros nacionais do CSV do TSE (15/10) + 5 pesquisas da imprensa.
 */
const FOTO = "https://resultados.tse.jus.br/oficial/ele2026/6258/fotos/br/";
export const F = { n: "22", nome: "Flávio Bolsonaro", curto: "Flávio", partido: "PL", foto: `${FOTO}280002551544.jpeg` };
export const L = { n: "13", nome: "Lula", curto: "Lula", partido: "PT", foto: `${FOTO}280002542548.jpeg` };
export const ELEICAO = Date.UTC(2026, 9, 25, 20, 0, 0); // 25/10, 17h de Brasília

export const nf = new Intl.NumberFormat("pt-BR");
export const p1 = new Intl.NumberFormat("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
export const n1 = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 1 });
const MESES = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];
const SEMANA = ["domingo", "segunda", "terça", "quarta", "quinta", "sexta", "sábado"];

export const esc = (t) => String(t ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");
export const dia = (s) => Date.UTC(+s.slice(0, 4), +s.slice(5, 7) - 1, +s.slice(8, 10)) / 864e5;
export const iso = (d) => new Date(d * 864e5).toISOString().slice(0, 10);
export const ddmm = (s) => `${s.slice(8, 10)}/${s.slice(5, 7)}`;
export const porExtenso = (s) => `${+s.slice(8, 10)} de ${MESES[+s.slice(5, 7) - 1]}`;
export const diaSemana = (s) => SEMANA[new Date(dia(s) * 864e5).getUTCDay()];
export const libEfetiva = (r) => (r.liberacao > r.campoFim ? r.liberacao : r.campoFim);
export const lider = (v) => (v >= 0 ? F : L);

export function mediaEm(pub, d) {
	const desde = iso(dia(d) - 14);
	const ult = new Map();
	for (const p of pub) if (p.data <= d && p.data > desde) ult.set(p.cnpj, p);
	const ps = [...ult.values()];
	if (!ps.length) return null;
	const vf = ps.reduce((s, p) => s + p.vf, 0) / ps.length;
	return { data: d, vf, vl: 100 - vf, v: 2 * vf - 100, n: ps.length, ps };
}

export async function carregar() {
	const { hoje, registros, resultados } = await (await fetch("dados/pesquisas.json")).json();
	const pub = registros
		.filter((r) => resultados[r.registro])
		.map((r) => {
			const x = resultados[r.registro];
			const vf = (x.flavio / (x.flavio + x.lula)) * 100;
			return { ...r, ...x, data: r.campoFim, saiu: libEfetiva(r), vf, vl: 100 - vf, v: 2 * vf - 100 };
		})
		.sort((a, b) => a.data.localeCompare(b.data) || a.registro.localeCompare(b.registro));
	const sem = registros.filter((r) => !resultados[r.registro]);
	return {
		hoje,
		pub,
		media: mediaEm(pub, hoje),
		serieMedia: [...new Set(pub.map((p) => p.data))].map((d) => mediaEm(pub, d)).filter(Boolean),
		vemAi: sem.filter((r) => libEfetiva(r) > hoje).sort((a, b) => libEfetiva(a).localeCompare(libEfetiva(b))),
		semNumero: sem.filter((r) => libEfetiva(r) <= hoje),
		registros,
	};
}

export function contagem() {
	const ms = Math.max(0, ELEICAO - Date.now());
	return { d: Math.floor(ms / 864e5), h: Math.floor((ms % 864e5) / 36e5), m: Math.floor((ms % 36e5) / 6e4) };
}

export function totaisTexto(p) {
	const bn =
		p.brancoNuloNaoSabe != null
			? `brancos, nulos e indecisos ${n1.format(p.brancoNuloNaoSabe)}%`
			: `brancos e nulos ${n1.format(p.brancoNulo)}%, não sabem ${n1.format(p.naoSabe)}%`;
	return `Flávio ${n1.format(p.flavio)}%, Lula ${n1.format(p.lula)}%, ${bn}`;
}

/** Ficha do art. 10 da Res. TSE 23.600 em uma frase. */
export function fichaTexto(r, comFonte = true) {
	const contr = r.contratantes.includes("recursos próprios") ? "Feita com recursos próprios" : `Contratada por ${r.contratantes.join(" e ")}`;
	const me = r.margem == null ? "margem de erro não informada" : `margem de erro de ${n1.format(r.margem)} ponto${r.margem === 1 ? "" : "s"}`;
	const ic = r.confianca == null ? "confiança não informada" : `confiança de ${n1.format(r.confianca)}%`;
	return `${esc(r.nome)} ouviu ${nf.format(r.entrevistas)} eleitores de ${ddmm(r.campoInicio)} a ${ddmm(r.campoFim)}; ${me}, ${ic}. ${esc(contr)}. Registro no TSE ${esc(r.registro)}.${
		comFonte && r.fonte ? ` <a href="${esc(r.fonte)}" target="_blank" rel="noopener">Ver fonte</a>` : ""
	}`;
}

/* liga/desliga por instituto, lembrado no navegador */
const CHAVE = "pesq-desligados";
export function desligados() {
	try {
		return new Set(JSON.parse(localStorage.getItem(CHAVE) || "[]"));
	} catch {
		return new Set();
	}
}
export function alternar(cnpj) {
	const s = desligados();
	s.has(cnpj) ? s.delete(cnpj) : s.add(cnpj);
	try {
		localStorage.setItem(CHAVE, JSON.stringify([...s]));
	} catch {
		/* ignore */
	}
	return s;
}
export function institutos(m) {
	return [...new Map(m.pub.map((p) => [p.cnpj, p.nome]))];
}
export function chips(m, cls = "chips") {
	const off = desligados();
	return `<div class="${cls}" role="group" aria-label="Institutos no gráfico">${institutos(m)
		.map(([c, n]) => `<button type="button" data-cnpj="${c}" aria-pressed="${!off.has(c)}">${esc(n)}</button>`)
		.join("")}</div>`;
}
/** Clique em qualquer [data-cnpj]: alterna e chama `repintar`. */
export function ligarChips(repintar) {
	document.addEventListener("click", (e) => {
		const b = e.target.closest("button[data-cnpj]");
		if (!b) return;
		const off = alternar(b.dataset.cnpj);
		for (const x of document.querySelectorAll(`button[data-cnpj="${b.dataset.cnpj}"]`)) x.setAttribute("aria-pressed", String(!off.has(b.dataset.cnpj)));
		repintar();
	});
}

/**
 * Gráfico de vantagem no tempo (SVG). Cores lidas das variáveis CSS do elemento:
 * --f, --l (candidatos), --tinta, --suave, --regua.
 */
export function tendencia(el, m, { alto = 220, ate25 = false } = {}) {
	if (!el) return;
	const cs = getComputedStyle(el);
	const c = (v) => cs.getPropertyValue(v).trim();
	const off = desligados();
	const W = Math.max(280, Math.floor(el.clientWidth));
	const H = alto;
	const mg = { t: 16, r: 80, b: 24, l: 8 };
	const pw = W - mg.l - mg.r;
	const ph = H - mg.t - mg.b;
	const x0 = dia(m.pub[0].data) - 1;
	const x1 = ate25 ? dia("2026-10-25") : dia(m.hoje) + 1;
	const X = (d) => mg.l + ((d - x0) / (x1 - x0)) * pw;
	const lim = Math.ceil(Math.max(6, ...m.pub.map((p) => Math.abs(p.v)) ) / 2) * 2;
	const Y = (v) => mg.t + (1 - (v + lim) / (2 * lim)) * ph;
	const porInst = new Map();
	for (const p of m.pub) porInst.set(p.cnpj, [...(porInst.get(p.cnpj) ?? []), p]);
	const off_ = (cnpj) => (off.has(cnpj) ? "off" : "");
	const linhas = [...porInst.values()]
		.filter((ps) => ps.length > 1)
		.map((ps) => `<path class="t-inst ${off_(ps[0].cnpj)}" data-cnpj="${ps[0].cnpj}" d="${ps.map((p, i) => `${i ? "L" : "M"}${X(dia(p.data))},${Y(p.v)}`).join("")}" fill="none" stroke="${c("--suave")}" stroke-width="1"/>`)
		.join("");
	const pts = m.pub
		.map((p, i) => `<circle class="t-pt ${off_(p.cnpj)}" data-cnpj="${p.cnpj}" data-ordem="${i}" cx="${X(dia(p.data))}" cy="${Y(p.v)}" r="4.5" fill="${p.v >= 0 ? c("--f") : c("--l")}"><title>${esc(p.nome)}, campo até ${ddmm(p.data)}: Flávio ${p1.format(p.vf)}%, Lula ${p1.format(p.vl)}%</title></circle>`)
		.join("");
	const dM = m.serieMedia.map((s, i) => `${i ? "L" : "M"}${X(dia(s.data))},${Y(s.v)}`).join("");
	const u = m.serieMedia.at(-1);
	let datas = "";
	const passo = Math.max(1, Math.ceil((x1 - x0) / (W < 520 ? 4 : 7)));
	for (let d = x0 + 1; d <= x1; d += passo) datas += `<text x="${X(d)}" y="${H - 6}" text-anchor="middle">${ddmm(iso(d))}</text>`;
	el.innerHTML = `<svg width="${W}" height="${H}" role="img" aria-label="Vantagem de Flávio sobre Lula nas pesquisas, em pontos dos votos válidos" style="font-size:12px;fill:${c("--suave")}">
    <line x1="${mg.l}" x2="${W - mg.r}" y1="${Y(0)}" y2="${Y(0)}" stroke="${c("--regua")}" stroke-width="1.5"/>
    <text x="${W - mg.r + 6}" y="${Y(0) + 4}">empate</text>
    <text x="${W - mg.r + 6}" y="${mg.t + 8}">Flávio +${lim}</text><text x="${W - mg.r + 6}" y="${mg.t + ph}">Lula +${lim}</text>
    <line x1="${X(dia(m.hoje))}" x2="${X(dia(m.hoje))}" y1="${mg.t}" y2="${mg.t + ph}" stroke="${c("--regua")}" stroke-dasharray="2 3"/>
    ${datas}${linhas}
    <path class="t-media" d="${dM}" fill="none" stroke="${c("--tinta")}" stroke-width="3" stroke-linejoin="round" stroke-linecap="round"/>
    ${pts}
    <text class="t-rot" x="${X(dia(u.data)) + 8}" y="${Y(u.v) - 8}" style="fill:${c("--tinta")};font-weight:600">média ${u.v >= 0 ? "Flávio" : "Lula"} +${p1.format(Math.abs(u.v))}</text>
  </svg>`;
}
