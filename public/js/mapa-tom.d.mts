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
	lado: TomUf["lado"];
	classe: string;
	estilo: string;
	rotulo: string;
	claro: boolean;
	aria: string;
	dados: Record<"pctF" | "pctL" | "votosF" | "votosL" | "apurado" | "secoesApuradas" | "secoes", string>;
};

export const p2: Intl.NumberFormat;

export function tomDaUf(uf: UfDoMapa | undefined): TomUf;

export function descreverUf(nome: string, uf: UfDoMapa | undefined): DescricaoUf;

export function contaUfs(
	ufs: Readonly<Record<string, UfDoMapa>> | undefined,
	siglas: readonly string[],
): { l: number; f: number };
