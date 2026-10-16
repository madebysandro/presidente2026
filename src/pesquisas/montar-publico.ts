import { dataBrasilia } from "./liberacao";
import type {
	FichaPublica,
	MetaImport,
	PayloadPesquisas,
	PesquisaPublicada,
	RegistroPesquisas,
	ResultadoGuardado,
} from "./tipos";

export function montarPublico(
	registros: RegistroPesquisas[],
	meta: MetaImport | null,
	agora: Date,
	resultados: readonly ResultadoGuardado[] = [],
): PayloadPesquisas {
	const hoje = dataBrasilia(agora);
	const porRegistro = new Map(resultados.map((r) => [r.registro, r]));
	const nacionais = registros
		.filter((r) => r.classificacao === "nacional" && !r.removidoDoTse)
		.sort(
			(a, b) =>
				a.campoFim.localeCompare(b.campoFim) || a.registro.localeCompare(b.registro),
		);
	const publicadas: PesquisaPublicada[] = [];
	const semNumero: FichaPublica[] = [];
	for (const registro of nacionais) {
		const resultado = porRegistro.get(registro.registro);
		if (resultado) {
			publicadas.push(publicar(registro, resultado));
			continue;
		}
		if (registro.liberacaoEfetiva <= hoje) semNumero.push(fichaDe(registro));
	}
	return {
		hoje,
		atualizadoEm: meta?.ultimoImportEm ?? agora.toISOString(),
		registroTse: {
			geradoEm: meta?.geradoEm ?? null,
			etag: meta?.etagPesquisa ?? null,
		},
		media: null,
		serieMedia: [],
		publicadas,
		liberadasSemNumero: semNumero,
		vemAi: nacionais
			.filter((r) => !porRegistro.has(r.registro) && r.liberacaoEfetiva > hoje)
			.map(fichaDe),
	};
}

function publicar(r: RegistroPesquisas, resultado: ResultadoGuardado): PesquisaPublicada {
	return {
		registro: r.registro,
		cnpj: r.cnpj,
		instituto: r.instituto,
		contratantes: r.contratantes,
		campoInicio: r.campoInicio,
		campoFim: r.campoFim,
		liberacao: r.liberacao,
		liberacaoEfetiva: r.liberacaoEfetiva,
		entrevistas: r.entrevistas,
		margem: resultado.margem,
		confianca: resultado.confianca,
		totais: resultado.totais,
		validosPublicados: resultado.validosPublicados,
		vf: resultado.vf,
		vl: resultado.vl,
		v: resultado.v,
		fonte: resultado.fonte,
		cadastradoEm: resultado.cadastradoEm,
		substituidoEm: resultado.substituidoEm,
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
