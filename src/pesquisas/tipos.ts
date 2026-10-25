export type Classificacao = "nacional" | "estadual" | "ambigua";

type RegistroId = string;

export type RegistroPesquisas = {
	registro: RegistroId;
	cnpj: string;
	instituto: string;
	contratantes: string[];
	campoInicio: string;
	campoFim: string;
	liberacao: string;
	liberacaoEfetiva: string;
	entrevistas: number;
	margem: number | null;
	confianca: number | null;
	classificacao: Classificacao;
	removidoDoTse: boolean;
};

export type ContagensImport = {
	nacional: number;
	estadual: number;
	ambigua: number;
};

export type MetaImport = {
	geradoEm: string | null;
	etagPesquisa: string | null;
	etagContratante: string | null;
	lastModifiedPesquisa: string | null;
	lastModifiedContratante: string | null;
	ultimoImportEm: string | null;
	contagens: ContagensImport;
};

export type MotivoImport = "cron" | "primeiro_acesso" | "teste" | "plano_b";

export type AuditoriaEntrada = {
	em: string;
	tipo: "import" | "removido" | "ambigua" | "rejeitado";
	registro: string | null;
	detalhe: string;
};

export type OrigemZip = {
	geradoEm: string | null;
	etagPesquisa: string | null;
	etagContratante: string | null;
	lastModifiedPesquisa: string | null;
	lastModifiedContratante: string | null;
};

/**
 * 304 não reprocessa. `aplicar` é o upsert do recorte lido agora.
 * Registros que sumiram do CSV vão em `remover`.
 */
export type Changeset =
	| { kind: "nao_modificado"; meta: MetaImport }
	| {
			kind: "aplicar";
			meta: MetaImport;
			upserts: RegistroPesquisas[];
			remover: RegistroId[];
			auditoria: AuditoriaEntrada[];
	  };

/** O poller encerrou a apuração: o import não baixa nem aplica (#86). */
export type ImportCongelado = { kind: "congelado" };

export type FichaPublica = {
	registro: RegistroId;
	instituto: string;
	contratantes: string[];
	campoInicio: string;
	campoFim: string;
	liberacaoEfetiva: string;
	entrevistas: number;
};

export type TotaisPublicos = {
	flavio: number;
	lula: number;
	brancoNulo: number | null;
	naoSabe: number | null;
	brancoNuloNaoSabe: number | null;
};

export type PesquisaPublicada = {
	registro: RegistroId;
	cnpj: string;
	instituto: string;
	contratantes: string[];
	campoInicio: string;
	campoFim: string;
	liberacao: string;
	liberacaoEfetiva: string;
	entrevistas: number;
	margem: number;
	confianca: number;
	totais: TotaisPublicos;
	validosPublicados: { flavio: number; lula: number } | null;
	vf: number;
	vl: number;
	v: number;
	fonte: string;
	cadastradoEm: string;
	substituidoEm: string | null;
};

export type ResultadoGuardado = {
	registro: RegistroId;
	totais: TotaisPublicos;
	validosPublicados: { flavio: number; lula: number } | null;
	vf: number;
	vl: number;
	v: number;
	fonte: string;
	margem: number;
	confianca: number;
	cadastradoEm: string;
	substituidoEm: string | null;
};

export type AuditoriaAgente = {
	id: number;
	em: string;
	rota: string;
	metodo: string;
	ip: string;
	chaveValida: boolean;
	registro: string | null;
	corpo: string;
	status: number;
	motivos: string[];
};

type FasePesquisas = "pesquisas" | "ao_vivo" | "encerrada";

export type MediaPublica = {
	data: string;
	vf: number;
	vl: number;
	v: number;
	n: number;
	margem: number;
	registros: string[];
};

export type PontoSerieMedia = {
	data: string;
	vf: number;
	v: number;
	n: number;
};

export type PayloadPesquisas = {
	hoje: string;
	fase: FasePesquisas;
	atualizadoEm: string;
	registroTse: { geradoEm: string | null; etag: string | null };
	media: MediaPublica | null;
	serieMedia: PontoSerieMedia[];
	publicadas: PesquisaPublicada[];
	liberadasSemNumero: FichaPublica[];
	vemAi: FichaPublica[];
};
