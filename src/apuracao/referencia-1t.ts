import colegiosJson from "../../fixtures/primeiro-turno/colegios-6257.json" with { type: "json" };
import estadoJson from "../../fixtures/primeiro-turno/estado-6257.json" with { type: "json" };

type CandRef = { n: string; nome?: string; votos: number; pct?: number };
type UfRef = {
	uf: string;
	nome: string;
	candidatos: CandRef[];
	validos: number;
	eleitorado: number;
	secoes: number;
};
type EstadoRef = {
	cargos: {
		presidente: {
			totais: {
				eleitorado: number;
				comparecimento: number;
				abstencao: number;
				validos: number;
				brancos: number;
				nulos: number;
			};
			candidatos: CandRef[];
		};
	};
	ufs: Record<string, UfRef>;
};
type ColegioRef = {
	uf: string;
	cd: string;
	nome: string;
	eleitorado: number;
	pctComparecimento: number;
	validos: number;
	votos: Record<string, number>;
};
type ColegiosRef = {
	brasil: { eleitorado: number; pctComparecimento: number; votos: Record<string, number> };
	exterior: {
		eleitorado: number;
		pctComparecimento: number;
		votos: Record<string, number>;
		validos: number;
	};
	municipios: ColegioRef[];
};

export const ESTADO_1T = estadoJson as EstadoRef;
export const COLEGIOS_1T = colegiosJson as ColegiosRef;

export function liderDeVotos(votos: Record<string, number>): string | null {
	let lider: string | null = null;
	let maior = -1;
	for (const [n, v] of Object.entries(votos)) {
		if (v > maior) {
			maior = v;
			lider = n;
		}
	}
	return maior > 0 ? lider : null;
}

export function votosUf1t(uf: string): Record<string, number> {
	const u = ESTADO_1T.ufs[uf];
	if (!u) return {};
	return Object.fromEntries(u.candidatos.map((c) => [c.n, c.votos]));
}

export function colegio1t(cd: string): ColegioRef | undefined {
	return COLEGIOS_1T.municipios.find((m) => m.cd === cd);
}
