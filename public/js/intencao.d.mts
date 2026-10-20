export type PontoIntencaoCliente = {
	data: string;
	vf: number;
	vl: number;
	margem: number;
	n: number;
};

export function serieIntencao(
	pesquisas: readonly {
		registro: string;
		cnpj: string;
		campoFim: string;
		margem: number;
		flavio: number;
		lula: number;
	}[],
	dataRef: string,
): PontoIntencaoCliente[];
