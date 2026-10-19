/** Modelo de domínio (formato do protótipo, reduzido ao que a API devolve). */

export type TotaisCargo = {
	eleitorado: number;
	eleitoradoApurado: number;
	comparecimento: number;
	abstencao: number;
	validos: number;
	legenda: number;
	brancos: number;
	nulos: number;
};

export type Candidato = {
	n: string;
	nome: string;
	partido: string;
	agr: string;
	votos: number;
	pct: number;
	pos: number;
	eleito: boolean;
	situacao: string;
	valido: boolean;
	foto: string;
};

export type Agremiacao = {
	sigla: string;
	nome: string;
	federacao: boolean;
	nominais: number;
	legenda: number;
	votos: number;
	vagas: number;
};

export type Cargo = {
	id: string;
	titulo: string;
	local: string;
	vagas: number;
	apurado: number;
	hora: string;
	qe: number | null;
	totais: TotaisCargo;
	candidatos: Candidato[];
	agremiacoes?: Agremiacao[];
};

export type DisputaInterna = {
	sigla: string;
	ultimo: { n: string; nome: string; votos: number };
	proximo: { n: string; nome: string; votos: number };
	diferenca: number;
};

export type AnaliseProporcional = {
	disputaInterna: DisputaInterna[];
};

export type CandidatoUf = {
	n: string;
	nome: string;
	votos: number;
	pct: number;
};

/** Presidente numa UF (ou exterior) — modelo da spec. */
export type UfPresidente = {
	uf: string;
	nome: string;
	hora: string;
	apurado: number;
	secoes: number;
	secoesApuradas: number;
	eleitorado: number;
	validos: number;
	/** `e.pcn` do arquivo da UF ou do exterior. */
	comparecimento: number;
	candidatos: CandidatoUf[];
};

/** Maior colégio eleitoral (município) no 2º turno. */
export type ColegioPresidente = {
	uf: string;
	cd: string;
	nome: string;
	hora: string;
	apurado: number;
	eleitorado: number;
	validos: number;
	comparecimento: number;
	candidatos: CandidatoUf[];
	/** 1º turno oficial do mesmo município, quando há snapshot. */
	t1?: {
		eleitorado: number;
		votos: Record<string, number>;
		lider: string | null;
		comparecimento: number;
	} | null;
};

export type FaseApuracao = "pesquisas" | "ao_vivo" | "encerrada";

export type ViradaNoite = {
	de: string;
	para: string;
	hora: string;
	ap: number;
	t: number;
};

export type MomentoNoite = {
	tipo: "abre" | "maior_vantagem" | "metade" | "virada" | "eleito";
	hora: string;
	ap: number;
	n?: string;
	de?: string;
	para?: string;
	margemPp?: number;
};

export type RegiaoApuracao = {
	nome: string;
	apurado: number;
	validos: number;
	candidatos: CandidatoUf[];
	lider: string | null;
	lider1t: string | null;
	virou: boolean;
};

/** Fatias em % do eleitorado (Flávio, Lula, outros, brancos/nulos, abstenção). */
export type FatiaEleitorado = {
	flavio: number;
	lula: number;
	outros: number;
	brancosNulos: number;
	abstencao: number;
};

export type EstimativaFluxo = {
	selo: "ESTIMATIVA";
	flavioVotos: number;
	lulaVotos: number;
	fonteVotos: number;
};

export type ComparacaoTurnos = {
	primeiro: FatiaEleitorado;
	segundo: FatiaEleitorado | null;
	estimativa: EstimativaFluxo | null;
};

export type FechamentoEncerrada = {
	comparecimento: number;
	comparecimento1t: number;
	abstencao: number;
	abstencao1t: number;
	brancos: number;
	brancos1t: number;
	nulos: number;
	nulos1t: number;
	viradas: number;
};

export type UfVirou = {
	uf: string;
	nome: string;
	lider: string;
	lider1t: string;
};

export type {
	AnaliseMajoritaria,
	TendenciaCandidato,
	PrimeiroTurnoAnalise,
	RefCandidatoAnalise,
} from "./majoritarias/analise";

import type { AnaliseMajoritaria } from "./majoritarias/analise";

export type AnaliseApuracao = {
	majoritarias?: Record<string, AnaliseMajoritaria>;
	proporcionais?: Record<string, AnaliseProporcional>;
	/** Fora do 2º turno nacional. Permanece vazio. */
	destaques?: string[];
	viradas?: ViradaNoite[];
	momentos?: MomentoNoite[];
	regioes?: RegiaoApuracao[];
	ufsQueViraram?: UfVirou[];
	comparacao?: ComparacaoTurnos;
	fechamento?: FechamentoEncerrada | null;
};

export type EstadoApuracao = {
	versao: number;
	consultadoEm: number | null;
	proximaConsulta: number | null;
	erro: string | null;
	/** `pesquisas` antes de 25/10 17h, `ao_vivo` depois, `encerrada` com o dado. */
	fase?: FaseApuracao;
	/** true quando Presidente + 27 UFs + exterior chegaram a 100% com `tf`. */
	encerrada?: boolean;
	/**
	 * Último `tf` do TSE por escopo (id do cargo ou sigla UF), do último corpo 200.
	 * Um 304 reutiliza este valor — o dado guardado é o atual (#19).
	 */
	tfPorEscopo?: Record<string, string | undefined>;
	cargos: Record<string, Cargo>;
	ufs?: Record<string, UfPresidente>;
	colegios?: Record<string, ColegioPresidente>;
	analise?: AnaliseApuracao;
};

/** Instantâneo compacto para tendência (formato do protótipo). */
export type Leitura = {
	t: number;
	c: Record<
		string,
		{
			ap: number;
			hora: string;
			vv: number;
			comp: number;
			bra: number;
			nul: number;
			c: Record<string, [number, number, number]>;
			a?: Record<string, [number, number]>;
		}
	>;
};

export type MetaCargo = {
	id: string;
	titulo: string;
	local: string;
	ele: string;
	uf: string;
	cd: string;
};
