export type Classificacao = "nacional" | "estadual" | "ambigua";

export type RegistroId = string;

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

export type MotivoImport = "cron" | "primeiro_acesso" | "teste";

export type AuditoriaEntrada = {
	em: string;
	tipo: "import" | "removido" | "ambigua";
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

export type FichaPublica = {
	registro: RegistroId;
	instituto: string;
	contratantes: string[];
	campoInicio: string;
	campoFim: string;
	liberacaoEfetiva: string;
	entrevistas: number;
};

export type PayloadPesquisas = {
	hoje: string;
	atualizadoEm: string;
	registroTse: { geradoEm: string | null; etag: string | null };
	media: null;
	serieMedia: [];
	publicadas: [];
	liberadasSemNumero: FichaPublica[];
	vemAi: FichaPublica[];
};
