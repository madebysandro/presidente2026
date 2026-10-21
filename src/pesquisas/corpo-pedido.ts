export const TETO_CORPO_AGENTE = 32 * 1024;
export const TETO_CORPO_IMPORT = 1_000_000;

const BLOCO = 16 * 1024;

export function classificarContentLength(
	header: string | null | undefined,
	teto: number,
): 411 | 413 | "ok" {
	if (header == null) return 411;
	const texto = header.trim();
	if (!/^\d+$/.test(texto)) return 411;
	const declarado = Number(texto);
	if (!Number.isSafeInteger(declarado) || declarado > teto) return 413;
	return "ok";
}

export function corpoRecusado(status: 411 | 413): {
	status: 411 | 413;
	corpo: { erro: "content_length" | "tamanho" };
} {
	return {
		status,
		corpo: { erro: status === 411 ? "content_length" : "tamanho" },
	};
}

export async function lerCorpoSeAutorizado(
	request: Request,
	teto: number,
	autorizado: boolean,
): Promise<{ ok: true; texto: string } | { ok: false; status: 411 | 413 }> {
	const classe = classificarContentLength(request.headers.get("content-length"), teto);
	if (classe !== "ok") return { ok: false, status: classe };
	if (!autorizado) return { ok: true, texto: "" };
	return lerFluxo(request, teto);
}

async function lerFluxo(
	request: Request,
	teto: number,
): Promise<{ ok: true; texto: string } | { ok: false; status: 413 }> {
	const declarado = Number(request.headers.get("content-length"));
	const limite = Math.min(teto, declarado);
	const stream = request.body;
	if (!stream) return { ok: true, texto: "" };
	const reader = stream.getReader({ mode: "byob" });
	const partes: Uint8Array[] = [];
	let total = 0;
	for (;;) {
		const espaco = Math.min(BLOCO, limite - total + 1);
		const { done, value } = await reader.read(new Uint8Array(espaco));
		if (done) break;
		if (value.byteLength === 0) continue;
		total += value.byteLength;
		if (total > limite) return { ok: false, status: 413 };
		partes.push(value.slice());
	}
	return { ok: true, texto: new TextDecoder().decode(juntar(partes, total)) };
}

function juntar(partes: Uint8Array[], total: number): Uint8Array {
	const saida = new Uint8Array(total);
	let offset = 0;
	for (const parte of partes) {
		saida.set(parte, offset);
		offset += parte.byteLength;
	}
	return saida;
}
