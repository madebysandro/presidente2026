/**
 * Tom, rótulo e textos de cada UF no mapa do ao vivo (#131).
 * O servidor (src/pagina/mapa.ts) e o cliente (mapa.js) usam o mesmo cálculo.
 */
const FLAVIO = "22";
const LULA = "13";
/** Tom mínimo de quem lidera por pouco; a partir de MARGEM_CHEIA p.p. a cor sai cheia. */
const TOM_MIN = 40;
const MARGEM_CHEIA = 30;
/** Abaixo deste tom o rótulo sai escuro para ler sobre a cor clara. */
const TOM_ROTULO_CLARO = 90;

const p2 = new Intl.NumberFormat("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

function numero(valor) {
	return typeof valor === "number" && Number.isFinite(valor) ? valor : 0;
}

function candidato(uf, n) {
	return uf?.candidatos?.find((c) => c.n === n);
}

export function tomDaUf(uf) {
	const f = candidato(uf, FLAVIO);
	const l = candidato(uf, LULA);
	const vf = numero(f?.votos);
	const vl = numero(l?.votos);
	if (vf + vl <= 0) return { lado: null, pctLider: null, tom: 0 };
	const pf = numero(f?.pct);
	const pl = numero(l?.pct);
	const tom = Math.round(TOM_MIN + (100 - TOM_MIN) * Math.min(Math.abs(pf - pl) / MARGEM_CHEIA, 1));
	if (vf === vl) return { lado: "empate", pctLider: pf, tom };
	return vf > vl ? { lado: "f", pctLider: pf, tom } : { lado: "l", pctLider: pl, tom };
}

export function descreverUf(nome, uf) {
	const tom = tomDaUf(uf);
	const pf = numero(candidato(uf, FLAVIO)?.pct);
	const pl = numero(candidato(uf, LULA)?.pct);
	const ap = numero(uf?.apurado);
	const dados = {
		f: pf.toFixed(2),
		l: pl.toFixed(2),
		vf: String(numero(candidato(uf, FLAVIO)?.votos)),
		vl: String(numero(candidato(uf, LULA)?.votos)),
		ap: ap.toFixed(2),
		sa: String(numero(uf?.secoesApuradas)),
		s: String(numero(uf?.secoes)),
	};
	if (tom.lado == null) {
		return { classe: "a-br-vazio", estilo: "", rotulo: "", claro: false, aria: `${nome}: sem seções apuradas`, dados };
	}
	return {
		classe: tom.lado === "empate" ? "a-br-empate" : `a-br-${tom.lado}`,
		estilo: tom.lado === "empate" ? "" : `--t:${tom.tom}%`,
		rotulo: `${Math.round(tom.pctLider)}%`,
		claro: tom.lado === "empate" || tom.tom < TOM_ROTULO_CLARO,
		aria: `${nome}: Flávio ${p2.format(pf)}%, Lula ${p2.format(pl)}%, ${p2.format(ap)}% apurado`,
		dados,
	};
}

export function textoConta(ufs, siglas) {
	let f = 0;
	let l = 0;
	let vazio = 0;
	for (const sigla of siglas) {
		const lado = tomDaUf(ufs?.[sigla]).lado;
		if (lado === "f") f += 1;
		else if (lado === "l") l += 1;
		else if (lado == null) vazio += 1;
	}
	const resto = vazio > 0 ? ` · ${vazio} sem seções apuradas` : "";
	return `Flávio lidera em <b class="a-f">${f}</b> · Lula em <b class="a-l">${l}</b>${resto}`;
}
