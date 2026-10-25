type UfDoMapa = {
	apurado?: number;
	secoes?: number;
	secoesApuradas?: number;
	candidatos?: readonly { n: string; votos: number; pct: number }[];
};

export type TomUf = {
	lado: "f" | "l" | "empate" | null;
	pctLider: number | null;
	tom: number;
};

export type DescricaoUf = {
	classe: string;
	estilo: string;
	rotulo: string;
	claro: boolean;
	aria: string;
	dados: Record<"f" | "l" | "vf" | "vl" | "ap" | "sa" | "s", string>;
};

export function tomDaUf(uf: UfDoMapa | undefined): TomUf;

export function descreverUf(nome: string, uf: UfDoMapa | undefined): DescricaoUf;

export function textoConta(
	ufs: Readonly<Record<string, UfDoMapa>> | undefined,
	siglas: readonly string[],
): string;
