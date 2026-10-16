import { dataBrasilia } from "./liberacao";
import type { FichaPublica, MetaImport, PayloadPesquisas, RegistroPesquisas } from "./tipos";

export function montarPublico(
	registros: RegistroPesquisas[],
	meta: MetaImport | null,
	agora: Date,
): PayloadPesquisas {
	const hoje = dataBrasilia(agora);
	const fichas = registros
		.filter((r) => r.classificacao === "nacional" && !r.removidoDoTse)
		.map(fichaDe)
		.sort(
			(a, b) =>
				a.campoFim.localeCompare(b.campoFim) || a.registro.localeCompare(b.registro),
		);
	return {
		hoje,
		atualizadoEm: meta?.ultimoImportEm ?? agora.toISOString(),
		registroTse: {
			geradoEm: meta?.geradoEm ?? null,
			etag: meta?.etagPesquisa ?? null,
		},
		media: null,
		serieMedia: [],
		publicadas: [],
		liberadasSemNumero: fichas.filter((f) => f.liberacaoEfetiva <= hoje),
		vemAi: fichas.filter((f) => f.liberacaoEfetiva > hoje),
	};
}

function fichaDe(r: RegistroPesquisas): FichaPublica {
	return {
		registro: r.registro,
		instituto: r.instituto,
		contratantes: r.contratantes,
		campoInicio: r.campoInicio,
		campoFim: r.campoFim,
		liberacaoEfetiva: r.liberacaoEfetiva,
		entrevistas: r.entrevistas,
	};
}
