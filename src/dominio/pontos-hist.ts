import type { Leitura } from "./tipos";

/** Leituras úteis de um cargo (sem repetir hora+apurado idênticos). */
export function pontos(hist: Leitura[], id: string): Leitura[] {
	return hist.filter(
		(p, i) =>
			p.c[id] &&
			!(
				hist[i + 1]?.c[id]?.hora === p.c[id].hora &&
				hist[i + 1]?.c[id]?.ap === p.c[id].ap
			),
	);
}
