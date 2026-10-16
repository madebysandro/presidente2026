export function arred2(n: number): number {
	return Math.round((n + Number.EPSILON) * 100) / 100;
}

export function arred1(n: number): number {
	return Math.round((n + Number.EPSILON) * 10) / 10;
}

export function validosCalculados(flavio: number, lula: number): {
	vf: number;
	vl: number;
	v: number;
} | null {
	const base = flavio + lula;
	if (!(base > 0)) return null;
	const vf = arred2((flavio / base) * 100);
	const vl = arred2(100 - vf);
	return { vf, vl, v: arred2(vf - vl) };
}

/** Diferença crua, antes do arredondamento de exibição. Mais de 1 ponto recusa. */
export function validosDiferem(
	flavio: number,
	lula: number,
	publicados: { flavio: number; lula: number },
): boolean {
	const base = flavio + lula;
	if (!(base > 0)) return true;
	const vf = (flavio / base) * 100;
	const vl = (lula / base) * 100;
	return Math.abs(publicados.flavio - vf) > 1 || Math.abs(publicados.lula - vl) > 1;
}
