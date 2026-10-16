/** Sem acento, minúsculo, espaços colapsados. `#NULO#` vira espaço. */
export function normalizarTexto(bruto: string): string {
	const semNulo = bruto.replaceAll("#NULO#", " ");
	const semAcento = semNulo.normalize("NFD").replace(/\p{M}/gu, "");
	return semAcento.toLowerCase().replace(/\s+/g, " ").trim();
}
