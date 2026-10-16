export const NOME_INSTANCIA = "singleton";

const CDN_OFICIAL = "https://cdn.tse.jus.br";
const CAMINHO_PESQUISA =
	"/estatistica/sead/odsele/pesquisa_eleitoral/pesquisa_eleitoral_2026.zip";
const CAMINHO_CONTRATANTE =
	"/estatistica/sead/odsele/pesquisa_eleitoral/pesquisa_contratante_2026.zip";

/**
 * Host do ZIP do registro. Produção omite `CDN_PESQUISAS` e fica no CDN do TSE.
 * O ensaio da noite (#21) aponta para o TSE falso local.
 */
export function urlsRegistroTse(env: object = {}): {
	pesquisa: string;
	contratante: string;
} {
	const bruto =
		"CDN_PESQUISAS" in env
			? (env as { CDN_PESQUISAS?: unknown }).CDN_PESQUISAS
			: undefined;
	const base = (
		typeof bruto === "string" && bruto.trim().length > 0 ? bruto : CDN_OFICIAL
	).replace(/\/$/, "");
	return {
		pesquisa: `${base}${CAMINHO_PESQUISA}`,
		contratante: `${base}${CAMINHO_CONTRATANTE}`,
	};
}

export const URL_ZIP_PESQUISA = urlsRegistroTse().pesquisa;
export const URL_ZIP_CONTRATANTE = urlsRegistroTse().contratante;

export const FIM_CAMPO_MINIMO = "2026-10-05";
