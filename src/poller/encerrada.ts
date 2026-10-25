/**
 * Decide se a apuração acompanhada já totalizou 100% das seções
 * em todos os cargos e UFs (issue #19).
 */

export type EscopoApurado = { apurado: number };

function secoesTotalizadas(apurado: number): boolean {
	return apurado >= 100;
}

/**
 * Verdadeiro só quando todos os ids/UFs exigidos estão presentes
 * e cada um tem `apurado >= 100` (pst/pstn já normalizados).
 */
function apuracaoTotalizada(
	estado: {
		cargos: Record<string, EscopoApurado | undefined>;
		ufs?: Record<string, EscopoApurado | undefined>;
	},
	idsCargos: readonly string[],
	siglasUf: readonly string[],
): boolean {
	for (const id of idsCargos) {
		const cargo = estado.cargos[id];
		if (!cargo || !secoesTotalizadas(cargo.apurado)) return false;
	}
	const ufs = estado.ufs ?? {};
	for (const uf of siglasUf) {
		const dado = ufs[uf];
		if (!dado || !secoesTotalizadas(dado.apurado)) return false;
	}
	return true;
}

/** `tf` do TSE: totalização final. Ausente ou `"s"` libera; `"n"` bloqueia. */
function tfPermiteEncerrar(tf: unknown): boolean {
	if (tf == null || tf === "") return true;
	return String(tf).toLowerCase() === "s";
}

/**
 * Todos os escopos presentes a ≥100% e com o último `tf` guardado
 * (do último 200; 304 reutiliza) permitindo encerrar.
 */
export function escoposProntosParaEncerrar(
	estado: {
		cargos: Record<string, EscopoApurado | undefined>;
		ufs?: Record<string, EscopoApurado | undefined>;
		tfPorEscopo?: Record<string, string | undefined>;
	},
	idsCargos: readonly string[],
	siglasUf: readonly string[],
): boolean {
	if (!apuracaoTotalizada(estado, idsCargos, siglasUf)) return false;
	const tfs = estado.tfPorEscopo ?? {};
	for (const id of idsCargos) {
		if (!tfPermiteEncerrar(tfs[id])) return false;
	}
	for (const uf of siglasUf) {
		if (!tfPermiteEncerrar(tfs[uf])) return false;
	}
	return true;
}
