import { paginaConfirma } from "./fonte-pagina";
import { urlFonteValida } from "./validar-resultado";

const UA = "presidente2026.win verificador";
const TETO_BYTES = 2 * 1024 * 1024;
const TIMEOUT_MS = 8000;

export type LeituraFonte =
	| { ok: true; html: string }
	| { ok: false; detalhe: string };

export async function lerFonte(urlInicial: string): Promise<LeituraFonte> {
	let atual = urlInicial;
	for (let salto = 0; salto <= 3; salto++) {
		let resposta: Response;
		try {
			resposta = await fetch(atual, {
				method: "GET",
				redirect: "manual",
				headers: { "user-agent": UA, accept: "text/html" },
				signal: AbortSignal.timeout(TIMEOUT_MS),
				cache: "no-store",
			});
		} catch {
			return { ok: false, detalhe: "não foi possível ler a fonte" };
		}
		if (resposta.status >= 300 && resposta.status < 400) {
			const destino = resposta.headers.get("location");
			if (!destino || salto === 3) {
				return { ok: false, detalhe: "redirecionamento inválido" };
			}
			let proxima: URL;
			try {
				proxima = new URL(destino, atual);
			} catch {
				return { ok: false, detalhe: "redirecionamento inválido" };
			}
			if (!urlFonteValida(proxima.toString())) {
				return { ok: false, detalhe: "redirecionamento para fora da lista" };
			}
			atual = proxima.toString();
			continue;
		}
		if (resposta.status !== 200) {
			return { ok: false, detalhe: `fonte respondeu ${resposta.status}` };
		}
		const declarado = Number(resposta.headers.get("content-length"));
		if (Number.isFinite(declarado) && declarado > TETO_BYTES) {
			return { ok: false, detalhe: "fonte maior que 2 MB" };
		}
		let buf: ArrayBuffer;
		try {
			buf = await resposta.arrayBuffer();
		} catch {
			return { ok: false, detalhe: "não foi possível ler a fonte" };
		}
		if (buf.byteLength > TETO_BYTES) {
			return { ok: false, detalhe: "fonte maior que 2 MB" };
		}
		return { ok: true, html: new TextDecoder().decode(buf) };
	}
	return { ok: false, detalhe: "redirecionamento inválido" };
}

export function confirmarHtml(
	html: string,
	instituto: string,
	totais: { flavio: number; lula: number },
	validos: { flavio: number; lula: number } | null,
): boolean {
	const pares: Array<[number, number]> = [[totais.flavio, totais.lula]];
	if (validos) pares.push([validos.flavio, validos.lula]);
	return paginaConfirma(html, instituto, pares);
}
