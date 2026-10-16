import { documentoPesquisas } from "../src/pagina/documento";
import type { PayloadPesquisas, PesquisaPublicada } from "../src/pesquisas/tipos";

function hojeBrasilia(agora: Date): string {
	return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(agora);
}

function publicada(
	parcial: Pick<PesquisaPublicada, "registro" | "instituto" | "cnpj" | "campoFim" | "liberacaoEfetiva"> &
		Partial<PesquisaPublicada>,
): PesquisaPublicada {
	return {
		contratantes: ["Folha de S.Paulo", "TV Globo"],
		campoInicio: "2026-10-06",
		liberacao: parcial.liberacaoEfetiva,
		entrevistas: 2520,
		margem: 2,
		confianca: 95,
		totais: { flavio: 49, lula: 45, brancoNulo: 5, naoSabe: 1, brancoNuloNaoSabe: null },
		validosPublicados: { flavio: 52, lula: 48 },
		vf: 52.13,
		vl: 47.87,
		v: 4.26,
		fonte: "https://www.metropoles.com/brasil/datafolha-08",
		cadastradoEm: "2026-10-16T12:00:00.000Z",
		substituidoEm: null,
		...parcial,
	};
}

export function htmlFixture(agora = new Date()): string {
	const hoje = hojeBrasilia(agora);
	const datafolha = publicada({
		registro: "BR-02949/2026",
		instituto: "Datafolha",
		cnpj: "11111111000111",
		campoFim: "2026-10-08",
		liberacaoEfetiva: "2026-10-08",
	});
	const quaest = publicada({
		registro: "BR-08729/2026",
		instituto: "Quaest",
		cnpj: "22222222000122",
		contratantes: ["Editora Globo", "TV Globo"],
		campoInicio: "2026-10-10",
		campoFim: "2026-10-13",
		liberacaoEfetiva: "2026-10-14",
		entrevistas: 2154,
		totais: { flavio: 46, lula: 44, brancoNulo: 9, naoSabe: 1, brancoNuloNaoSabe: null },
		validosPublicados: null,
		vf: 51.11,
		vl: 48.89,
		v: 2.22,
		fonte: "https://www.poder360.com.br/quaest-13",
	});
	const payload: PayloadPesquisas = {
		hoje,
		fase: "pesquisas",
		atualizadoEm: agora.toISOString(),
		registroTse: { geradoEm: null, etag: null },
		media: {
			data: hoje,
			vf: 51.62,
			vl: 48.38,
			v: 3.24,
			n: 2,
			margem: 2,
			registros: [datafolha.registro, quaest.registro],
		},
		serieMedia: [
			{ data: "2026-10-08", vf: 52.13, v: 4.26, n: 1 },
			{ data: "2026-10-13", vf: 51.62, v: 3.24, n: 2 },
		],
		publicadas: [datafolha, quaest],
		liberadasSemNumero: [],
		vemAi: [
			{
				registro: "BR-05187/2026",
				instituto: "GERP",
				contratantes: ["recursos próprios"],
				campoInicio: "2026-10-20",
				campoFim: "2026-10-22",
				liberacaoEfetiva: "2026-10-22",
				entrevistas: 2000,
			},
		],
	};
	return documentoPesquisas(payload, agora);
}
