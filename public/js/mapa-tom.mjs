/**
 * Tom, rótulo e textos de cada UF no mapa do ao vivo.
 * O servidor (src/pagina/mapa.ts) e o cliente (mapa.js) usam o mesmo cálculo.
 */
const FLAVIO = "22";
const LULA = "13";
/** Tom de quem lidera por pouco; a partir de MARGEM_CHEIA p.p. a cor sai cheia. */
const TOM_MIN = 40;
const MARGEM_CHEIA = 30;
/** Abaixo deste tom o rótulo sai escuro, para ler sobre a cor clara. */
const TOM_ROTULO_CLARO = 90;

export const p2 = new Intl.NumberFormat("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

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
	const pctF = numero(candidato(uf, FLAVIO)?.pct);
	const pctL = numero(candidato(uf, LULA)?.pct);
	const apurado = numero(uf?.apurado);
	const dados = {
		pctF: pctF.toFixed(2),
		pctL: pctL.toFixed(2),
		votosF: String(numero(candidato(uf, FLAVIO)?.votos)),
		votosL: String(numero(candidato(uf, LULA)?.votos)),
		apurado: apurado.toFixed(2),
		secoesApuradas: String(numero(uf?.secoesApuradas)),
		secoes: String(numero(uf?.secoes)),
	};
	if (tom.lado == null) {
		return { lado: null, classe: "a-br-vazio", estilo: "", rotulo: "", claro: false, aria: `${nome}: sem seções apuradas`, dados };
	}
	const empate = tom.lado === "empate";
	return {
		lado: tom.lado,
		classe: empate ? "a-br-empate" : `a-br-${tom.lado}`,
		estilo: empate ? "" : `--t:${tom.tom}%`,
		rotulo: `${Math.round(tom.pctLider)}%`,
		claro: empate || tom.tom < TOM_ROTULO_CLARO,
		aria: `${nome}: Lula ${p2.format(pctL)}%, Flávio ${p2.format(pctF)}%, ${p2.format(apurado)}% apurado`,
		dados,
	};
}

export function contaUfs(ufs, siglas) {
	let l = 0;
	let f = 0;
	for (const sigla of siglas) {
		const lado = tomDaUf(ufs?.[sigla]).lado;
		if (lado === "l") l += 1;
		else if (lado === "f") f += 1;
	}
	return { l, f };
}
