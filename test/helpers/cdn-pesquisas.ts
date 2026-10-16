import { http, HttpResponse } from "msw";
import { network } from "./rede";

export const URL_PESQUISA_TSE =
	"https://cdn.tse.jus.br/estatistica/sead/odsele/pesquisa_eleitoral/pesquisa_eleitoral_2026.zip";
export const URL_CONTRATANTE_TSE =
	"https://cdn.tse.jus.br/estatistica/sead/odsele/pesquisa_eleitoral/pesquisa_contratante_2026.zip";

export type PedidoCdn = {
	url: string;
	ifNoneMatch: string | null;
	ifModifiedSince: string | null;
};

export const pedidosCdn: PedidoCdn[] = [];

export function bytesDeDataUrl(dataUrl: string): Uint8Array {
	const indice = dataUrl.indexOf(",");
	if (!dataUrl.startsWith("data:") || indice < 0) {
		throw new Error(`fixture não é data URL: ${dataUrl.slice(0, 48)}`);
	}
	const bin = atob(dataUrl.slice(indice + 1));
	const out = new Uint8Array(bin.length);
	for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
	return out;
}

function responder(
	request: { url: string; headers: { get(name: string): string | null } },
	corpo: Uint8Array,
	etag: string,
	lastModified: string,
	condicional304: boolean,
): Response {
	const ifNoneMatch = request.headers.get("if-none-match");
	const ifModifiedSince = request.headers.get("if-modified-since");
	pedidosCdn.push({ url: request.url, ifNoneMatch, ifModifiedSince });
	// O CDN do TSE só devolve 304 com If-Modified-Since (ETag sozinho → 200).
	if (
		condicional304 &&
		ifModifiedSince === lastModified &&
		(ifNoneMatch === null || ifNoneMatch === etag)
	) {
		return new HttpResponse(null, {
			status: 304,
			headers: { etag, "last-modified": lastModified },
		});
	}
	return new HttpResponse(corpo.slice(), {
		status: 200,
		headers: {
			etag,
			"last-modified": lastModified,
			"content-type": "application/zip",
		},
	});
}

export function instalarCdnPesquisas(opts: {
	pesquisa: Uint8Array;
	contratante: Uint8Array;
	etagPesquisa: string;
	etagContratante: string;
	lastModifiedPesquisa?: string;
	lastModifiedContratante?: string;
	condicional304: boolean;
}): void {
	pedidosCdn.length = 0;
	const lmPesquisa =
		opts.lastModifiedPesquisa ?? "Thu, 15 Oct 2026 08:46:43 GMT";
	const lmContratante =
		opts.lastModifiedContratante ?? "Thu, 15 Oct 2026 08:46:43 GMT";
	network.use(
		http.get(URL_PESQUISA_TSE, ({ request }) =>
			responder(
				request,
				opts.pesquisa,
				opts.etagPesquisa,
				lmPesquisa,
				opts.condicional304,
			),
		),
		http.get(URL_CONTRATANTE_TSE, ({ request }) =>
			responder(
				request,
				opts.contratante,
				opts.etagContratante,
				lmContratante,
				opts.condicional304,
			),
		),
	);
}
