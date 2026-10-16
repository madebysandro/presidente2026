const ASSINATURA_EOCD = 0x06054b50;
const ASSINATURA_CENTRAL = 0x02014b50;
const ASSINATURA_LOCAL = 0x04034b50;

/** Teto do CSV nacional descomprimido (live ~16,5 MiB). Acima disso é bomba ou lixo. */
const TAMANHO_MAX_CSV_BRASIL = 32 * 1024 * 1024;

/**
 * A ordem das entradas muda entre versões do ZIP. O CSV nacional é o
 * `*_BRASIL.csv` do diretório central, não o primeiro arquivo.
 */
export async function extrairCsvBrasil(zip: Uint8Array): Promise<string> {
	const eocd = localizarEocd(zip);
	const entrada = entradaBrasil(zip, eocd);
	const comprimido = bytesDaEntrada(zip, entrada);
	const cru = await bytesDescomprimidos(entrada, comprimido);
	return new TextDecoder("windows-1252").decode(cru);
}

type Eocd = { entradas: number; cdOffset: number; cdSize: number };

type Entrada = {
	nome: string;
	metodo: number;
	tamanho: number;
	comprimido: number;
	localOffset: number;
};

function u16(b: Uint8Array, o: number): number {
	return b[o]! | (b[o + 1]! << 8);
}

function u32(b: Uint8Array, o: number): number {
	return (
		(b[o]! | (b[o + 1]! << 8) | (b[o + 2]! << 16) | (b[o + 3]! << 24)) >>> 0
	);
}

function localizarEocd(zip: Uint8Array): Eocd {
	const minimo = Math.max(0, zip.length - 22 - 65535);
	for (let i = zip.length - 22; i >= minimo; i--) {
		if (u32(zip, i) !== ASSINATURA_EOCD) continue;
		const comentario = u16(zip, i + 20);
		if (i + 22 + comentario !== zip.length) continue;
		return {
			entradas: u16(zip, i + 10),
			cdSize: u32(zip, i + 12),
			cdOffset: u32(zip, i + 16),
		};
	}
	throw new Error("ZIP sem diretório central");
}

function entradaBrasil(zip: Uint8Array, eocd: Eocd): Entrada {
	let p = eocd.cdOffset;
	const fim = eocd.cdOffset + eocd.cdSize;
	for (let n = 0; n < eocd.entradas && p + 46 <= fim; n++) {
		if (u32(zip, p) !== ASSINATURA_CENTRAL) {
			throw new Error("diretório central ilegível");
		}
		const metodo = u16(zip, p + 10);
		const comprimido = u32(zip, p + 20);
		const tamanho = u32(zip, p + 24);
		const nomeLen = u16(zip, p + 28);
		const extraLen = u16(zip, p + 30);
		const comentarioLen = u16(zip, p + 32);
		const localOffset = u32(zip, p + 42);
		const nome = new TextDecoder().decode(zip.subarray(p + 46, p + 46 + nomeLen));
		if (nome.toUpperCase().endsWith("_BRASIL.CSV")) {
			return { nome, metodo, tamanho, comprimido, localOffset };
		}
		p += 46 + nomeLen + extraLen + comentarioLen;
	}
	throw new Error("ZIP sem *_BRASIL.csv");
}

function bytesDaEntrada(zip: Uint8Array, entrada: Entrada): Uint8Array {
	const o = entrada.localOffset;
	if (u32(zip, o) !== ASSINATURA_LOCAL) {
		throw new Error(`cabeçalho local ausente em ${entrada.nome}`);
	}
	const nomeLen = u16(zip, o + 26);
	const extraLen = u16(zip, o + 28);
	const inicio = o + 30 + nomeLen + extraLen;
	const fim = inicio + entrada.comprimido;
	if (fim > zip.length) throw new Error(`entrada truncada: ${entrada.nome}`);
	return zip.subarray(inicio, fim);
}

async function bytesDescomprimidos(entrada: Entrada, comprimido: Uint8Array): Promise<Uint8Array> {
	if (entrada.tamanho > TAMANHO_MAX_CSV_BRASIL) {
		throw new Error(
			`CSV ${entrada.nome} declara ${entrada.tamanho} bytes (limite ${TAMANHO_MAX_CSV_BRASIL})`,
		);
	}
	if (entrada.metodo === 0) {
		if (comprimido.byteLength !== entrada.tamanho) {
			throw new Error(`tamanho stored ${comprimido.byteLength} != ${entrada.tamanho}`);
		}
		return comprimido;
	}
	if (entrada.metodo !== 8) {
		throw new Error(`ZIP método ${entrada.metodo} não suportado em ${entrada.nome}`);
	}
	const fluxo = new ReadableStream<Uint8Array>({
		start(controller) {
			controller.enqueue(comprimido);
			controller.close();
		},
	});
	const descomprimido = fluxo.pipeThrough(new DecompressionStream("deflate-raw"));
	const cru = await lerComTeto(descomprimido, entrada.tamanho, entrada.nome);
	if (cru.byteLength !== entrada.tamanho) {
		throw new Error(`tamanho descomprimido ${cru.byteLength} != ${entrada.tamanho}`);
	}
	return cru;
}

async function lerComTeto(
	stream: ReadableStream<Uint8Array>,
	esperado: number,
	nome: string,
): Promise<Uint8Array> {
	const reader = stream.getReader();
	const partes: Uint8Array[] = [];
	let total = 0;
	try {
		for (;;) {
			const { done, value } = await reader.read();
			if (done) break;
			total += value.byteLength;
			if (total > TAMANHO_MAX_CSV_BRASIL || total > esperado) {
				throw new Error(
					`CSV ${nome} ultrapassou o teto na descompressão (${total} > ${Math.min(TAMANHO_MAX_CSV_BRASIL, esperado)})`,
				);
			}
			partes.push(value);
		}
	} finally {
		reader.releaseLock();
	}
	const cru = new Uint8Array(total);
	let offset = 0;
	for (const parte of partes) {
		cru.set(parte, offset);
		offset += parte.byteLength;
	}
	return cru;
}
