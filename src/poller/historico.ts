import type { EstadoApuracao, Leitura } from "../dominio/tipos";

const r3 = (x: number) => Math.round(x * 1000) / 1000;

/** Monta uma Leitura a partir do estado atual (só gravada quando algo mudou). */
export function montarLeitura(estado: EstadoApuracao, t = Date.now()): Leitura {
	const c: Leitura["c"] = {};
	for (const [id, cargo] of Object.entries(estado.cargos)) {
		c[id] = {
			ap: r3(cargo.apurado),
			hora: cargo.hora,
			vv: cargo.totais.validos,
			comp: r3(cargo.totais.comparecimento),
			bra: r3(cargo.totais.brancos),
			nul: r3(cargo.totais.nulos),
			c: Object.fromEntries(
				cargo.candidatos.map((k) => [
					k.n,
					[k.votos, r3(k.pct), k.pos] as [number, number, number],
				]),
			),
		};
	}
	return { t, c };
}
