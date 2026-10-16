/**
 * Cinco pesquisas iniciais do protótipo (commit b1fe8ea,
 * docs/prototipo/novo-design/dados/pesquisas.json).
 * A Quaest não publica válidos.
 */
export type SementeInicial = {
	registro: string;
	instituto: string;
	fonte: string;
	html: string;
	totais: Record<string, number | null>;
	validosPublicados: { flavio: number; lula: number } | null;
};

export const SEMENTE_INICIAL: SementeInicial[] = [
	{
		registro: "BR-08134/2026",
		instituto: "PoderData",
		fonte: "https://sbtnews.sbt.com.br/noticia/politica/poder-data-aya-flavio-53-x-47-lula-em-votos-validos",
		html: "<p>PoderData: Flávio 49% e Lula 44%.</p>",
		totais: { flavio: 49, lula: 44, brancoNulo: 5, naoSabe: 2 },
		validosPublicados: { flavio: 53, lula: 47 },
	},
	{
		registro: "BR-02949/2026",
		instituto: "Datafolha",
		fonte: "https://www.metropoles.com/brasil/datafolha-2o-turno-flavio-tem-52-e-lula-48",
		html: "<p>Datafolha: Flávio 49% e Lula 45%.</p>",
		totais: { flavio: 49, lula: 45, brancoNulo: 5, naoSabe: 1 },
		validosPublicados: { flavio: 52, lula: 48 },
	},
	{
		registro: "BR-03663/2026",
		instituto: "AtlasIntel",
		fonte:
			"https://www.brasildefato.com.br/2026/10/09/pesquisa-atlasintelbloomberg-mostra-flavio-bolsonaro-com-528-dos-votos-validos-no-2o-turno-e-lula-com-472/",
		html: "<p>AtlasIntel: Flávio 51,1% e Lula 45,7%.</p>",
		totais: { flavio: 51.1, lula: 45.7, brancoNuloNaoSabe: 3.2 },
		validosPublicados: { flavio: 52.8, lula: 47.2 },
	},
	{
		registro: "BR-01209/2026",
		instituto: "PoderData",
		fonte: "https://sbtnews.sbt.com.br/noticia/eleicoes/poder-data-aya-flavio-tem-51-e-lula-49-no-segundo-turno",
		html: "<p>PoderData: Flávio 48% e Lula 46%.</p>",
		totais: { flavio: 48, lula: 46, brancoNulo: 5, naoSabe: 2 },
		validosPublicados: { flavio: 51, lula: 49 },
	},
	{
		registro: "BR-08729/2026",
		instituto: "Quaest",
		fonte: "https://www.poder360.com.br/poder-eleicoes-2026/flavio-tem-46-e-lula-tem-44-no-2o-turno-diz-quaest/",
		html: "<p>Quaest: Flávio 46% e Lula 44%.</p>",
		totais: { flavio: 46, lula: 44, brancoNulo: 9, naoSabe: 1 },
		validosPublicados: null,
	},
];
