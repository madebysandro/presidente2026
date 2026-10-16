/** A mais tardia entre a divulgação do TSE e o fim do campo (datas YYYY-MM-DD). */
export function liberacaoEfetiva(liberacao: string, campoFim: string): string {
	return liberacao > campoFim ? liberacao : campoFim;
}

export function dataBrasilia(agora: Date): string {
	const partes = new Intl.DateTimeFormat("en-US", {
		timeZone: "America/Sao_Paulo",
		year: "numeric",
		month: "2-digit",
		day: "2-digit",
	}).formatToParts(agora);
	const pegar = (tipo: Intl.DateTimeFormatPartTypes) =>
		partes.find((p) => p.type === tipo)?.value ?? "";
	return `${pegar("year")}-${pegar("month")}-${pegar("day")}`;
}
