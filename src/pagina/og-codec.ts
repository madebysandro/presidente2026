/**
 * PNG indexado sem upng/pako: a paleta sai de um corte mediano no
 * histograma de 5 bits e o deflate é o CompressionStream do runtime.
 * O índice 0 fica branco para o texto carimbado continuar sólido.
 */

export type Sprite = {
	x: number;
	y: number;
	w: number;
	h: number;
	ox: number;
	oy: number;
	advance: number;
};

export type Glifos = {
	atlasW: number;
	atlasH: number;
	turno: Sprite;
	flavio: Sprite;
	lula: Sprite;
	marca: Sprite;
	frase: Sprite;
	sufixoDia: Sprite;
	sufixoDias: Sprite;
	g150: Record<string, Sprite>;
	g26: Record<string, Sprite>;
	kern150: Record<string, number>;
	kern26: Record<string, number>;
};

export type BaseSem = {
	w: number;
	h: number;
	paleta: Uint8Array;
	indices: Uint8Array;
};

type Caixa = {
	r0: number;
	r1: number;
	g0: number;
	g1: number;
	b0: number;
	b1: number;
	n: number;
};

const CRC = new Uint32Array(256);
for (let n = 0; n < 256; n++) {
	let c = n;
	for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
	CRC[n] = c >>> 0;
}

function crc32(buf: Uint8Array): number {
	let c = 0xffffffff;
	for (let i = 0; i < buf.length; i++) c = CRC[(c ^ buf[i]!) & 0xff]! ^ (c >>> 8);
	return (c ^ 0xffffffff) >>> 0;
}

function juntar(partes: Uint8Array[]): Uint8Array {
	let n = 0;
	for (const p of partes) n += p.length;
	const out = new Uint8Array(n);
	let o = 0;
	for (const p of partes) {
		out.set(p, o);
		o += p.length;
	}
	return out;
}

export async function deflate(dados: Uint8Array): Promise<Uint8Array> {
	const stream = new ReadableStream<Uint8Array>({
		start(controller) {
			controller.enqueue(dados);
			controller.close();
		},
	});
	const comprimido = stream.pipeThrough(new CompressionStream("deflate"));
	return new Uint8Array(await new Response(comprimido).arrayBuffer());
}

export async function inflate(dados: Uint8Array): Promise<Uint8Array> {
	const stream = new ReadableStream<Uint8Array>({
		start(controller) {
			controller.enqueue(dados);
			controller.close();
		},
	});
	const aberto = stream.pipeThrough(new DecompressionStream("deflate"));
	return new Uint8Array(await new Response(aberto).arrayBuffer());
}

function chunk(tipo: string, dados: Uint8Array): Uint8Array {
	const out = new Uint8Array(12 + dados.length);
	const view = new DataView(out.buffer);
	view.setUint32(0, dados.length);
	out[4] = tipo.charCodeAt(0);
	out[5] = tipo.charCodeAt(1);
	out[6] = tipo.charCodeAt(2);
	out[7] = tipo.charCodeAt(3);
	out.set(dados, 8);
	view.setUint32(8 + dados.length, crc32(out.subarray(4, 8 + dados.length)));
	return out;
}

export async function codificarPng(
	indices: Uint8Array,
	w: number,
	h: number,
	paleta: Uint8Array,
): Promise<Uint8Array> {
	const ihdr = new Uint8Array(13);
	const view = new DataView(ihdr.buffer);
	view.setUint32(0, w);
	view.setUint32(4, h);
	ihdr[8] = 8;
	ihdr[9] = 3;
	const cru = new Uint8Array(h * (w + 1));
	for (let y = 0; y < h; y++) {
		cru.set(indices.subarray(y * w, (y + 1) * w), y * (w + 1) + 1);
	}
	const idat = await deflate(cru);
	const assinatura = Uint8Array.of(137, 80, 78, 71, 13, 10, 26, 10);
	return juntar([assinatura, chunk("IHDR", ihdr), chunk("PLTE", paleta), chunk("IDAT", idat), chunk("IEND", new Uint8Array())]);
}

function volume(c: Caixa): number {
	return (c.r1 - c.r0 + 1) * (c.g1 - c.g0 + 1) * (c.b1 - c.b0 + 1);
}

function contarFaixa(hist: Uint32Array, c: Caixa, eixo: "r" | "g" | "b"): Uint32Array {
	const along = new Uint32Array(32);
	for (let r = c.r0; r <= c.r1; r++) {
		for (let g = c.g0; g <= c.g1; g++) {
			const base = (r << 10) | (g << 5);
			for (let b = c.b0; b <= c.b1; b++) {
				const n = hist[base | b] ?? 0;
				if (!n) continue;
				along[eixo === "r" ? r : eixo === "g" ? g : b]! += n;
			}
		}
	}
	return along;
}

function dividir(c: Caixa, hist: Uint32Array): [Caixa, Caixa] | null {
	if (volume(c) <= 1 || c.n <= 1) return null;
	const dr = c.r1 - c.r0;
	const dg = c.g1 - c.g0;
	const db = c.b1 - c.b0;
	const eixo: "r" | "g" | "b" = dr >= dg && dr >= db ? "r" : dg >= db ? "g" : "b";
	const along = contarFaixa(hist, c, eixo);
	const ini = eixo === "r" ? c.r0 : eixo === "g" ? c.g0 : c.b0;
	const limite = eixo === "r" ? c.r1 : eixo === "g" ? c.g1 : c.b1;
	let acc = 0;
	let corte = ini;
	const metade = c.n / 2;
	for (let i = ini; i < limite; i++) {
		acc += along[i] ?? 0;
		corte = i;
		if (acc >= metade) break;
	}
	let esquerdaN = 0;
	for (let i = ini; i <= corte; i++) esquerdaN += along[i] ?? 0;
	if (esquerdaN === 0 || esquerdaN === c.n) {
		let primeiro = -1;
		for (let i = ini; i < limite; i++) {
			if (along[i]) {
				primeiro = i;
				break;
			}
		}
		if (primeiro < 0) return null;
		corte = primeiro;
		esquerdaN = 0;
		for (let i = ini; i <= corte; i++) esquerdaN += along[i] ?? 0;
		if (esquerdaN === 0 || esquerdaN === c.n) return null;
	}
	const a: Caixa = { ...c, n: esquerdaN };
	const b: Caixa = { ...c, n: c.n - esquerdaN };
	if (eixo === "r") {
		a.r1 = corte;
		b.r0 = corte + 1;
	} else if (eixo === "g") {
		a.g1 = corte;
		b.g0 = corte + 1;
	} else {
		a.b1 = corte;
		b.b0 = corte + 1;
	}
	if (a.r0 > a.r1 || a.g0 > a.g1 || a.b0 > a.b1) return null;
	if (b.r0 > b.r1 || b.g0 > b.g1 || b.b0 > b.b1) return null;
	return [a, b];
}

function mediaCaixa(
	c: Caixa,
	hist: Uint32Array,
	sumR: Uint32Array,
	sumG: Uint32Array,
	sumB: Uint32Array,
): [number, number, number] {
	let n = 0;
	let r = 0;
	let g = 0;
	let b = 0;
	for (let rr = c.r0; rr <= c.r1; rr++) {
		for (let gg = c.g0; gg <= c.g1; gg++) {
			const base = (rr << 10) | (gg << 5);
			for (let bb = c.b0; bb <= c.b1; bb++) {
				const k = base | bb;
				const hn = hist[k] ?? 0;
				if (!hn) continue;
				n += hn;
				r += sumR[k] ?? 0;
				g += sumG[k] ?? 0;
				b += sumB[k] ?? 0;
			}
		}
	}
	if (!n) return [0, 0, 0];
	return [Math.round(r / n), Math.round(g / n), Math.round(b / n)];
}

export function quantizar(
	rgba: Uint8Array,
	w: number,
	h: number,
	cores: number,
): { indices: Uint8Array; paleta: Uint8Array } {
	const hist = new Uint32Array(32768);
	const sumR = new Uint32Array(32768);
	const sumG = new Uint32Array(32768);
	const sumB = new Uint32Array(32768);
	const n = w * h;
	let total = 0;
	for (let p = 0, i = 0; p < n; p++, i += 4) {
		const r = rgba[i] ?? 0;
		const g = rgba[i + 1] ?? 0;
		const b = rgba[i + 2] ?? 0;
		if (r === 255 && g === 255 && b === 255) continue;
		const key = ((r >> 3) << 10) | ((g >> 3) << 5) | (b >> 3);
		hist[key]!++;
		sumR[key]! += r;
		sumG[key]! += g;
		sumB[key]! += b;
		total++;
	}
	const caixas: Caixa[] = [{ r0: 0, r1: 31, g0: 0, g1: 31, b0: 0, b1: 31, n: total }];
	const teto = Math.max(1, cores);
	while (caixas.length < teto) {
		let melhor = -1;
		let maior = 1;
		for (let i = 0; i < caixas.length; i++) {
			const c = caixas[i]!;
			if (c.n > maior && volume(c) > 1) {
				maior = c.n;
				melhor = i;
			}
		}
		if (melhor < 0) break;
		const partes = dividir(caixas[melhor]!, hist);
		if (!partes) {
			caixas[melhor]!.n = 0;
			continue;
		}
		caixas[melhor] = partes[0];
		caixas.push(partes[1]);
	}
	const lut = new Uint8Array(32768);
	const paleta = new Uint8Array((1 + caixas.length) * 3);
	paleta[0] = 255;
	paleta[1] = 255;
	paleta[2] = 255;
	caixas.forEach((c, i) => {
		const [r, g, b] = mediaCaixa(c, hist, sumR, sumG, sumB);
		const o = (i + 1) * 3;
		paleta[o] = r;
		paleta[o + 1] = g;
		paleta[o + 2] = b;
		for (let rr = c.r0; rr <= c.r1; rr++) {
			for (let gg = c.g0; gg <= c.g1; gg++) {
				const base = (rr << 10) | (gg << 5);
				for (let bb = c.b0; bb <= c.b1; bb++) lut[base | bb] = i + 1;
			}
		}
	});
	const indices = new Uint8Array(n);
	for (let p = 0, i = 0; p < n; p++, i += 4) {
		const r = rgba[i] ?? 0;
		const g = rgba[i + 1] ?? 0;
		const b = rgba[i + 2] ?? 0;
		indices[p] = r === 255 && g === 255 && b === 255 ? 0 : lut[((r >> 3) << 10) | ((g >> 3) << 5) | (b >> 3)]!;
	}
	return { indices, paleta };
}

export function empacotarBase(indices: Uint8Array, w: number, h: number, paleta: Uint8Array): Uint8Array {
	const nPal = paleta.length / 3;
	const out = new Uint8Array(10 + paleta.length + indices.length);
	out[0] = 79;
	out[1] = 71;
	out[2] = 83;
	out[3] = 77;
	const view = new DataView(out.buffer);
	view.setUint16(4, w, true);
	view.setUint16(6, h, true);
	view.setUint16(8, nPal, true);
	out.set(paleta, 10);
	out.set(indices, 10 + paleta.length);
	return out;
}

export function lerBase(buf: Uint8Array): BaseSem {
	if (buf[0] !== 79 || buf[1] !== 71 || buf[2] !== 83 || buf[3] !== 77) {
		throw new Error("base da prévia ilegível");
	}
	const view = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
	const w = view.getUint16(4, true);
	const h = view.getUint16(6, true);
	const nPal = view.getUint16(8, true);
	const paleta = buf.slice(10, 10 + nPal * 3);
	const indices = buf.slice(10 + nPal * 3);
	if (indices.length !== w * h) throw new Error("base da prévia incompleta");
	return { w, h, paleta, indices };
}

export function lerGlifos(buf: Uint8Array): { meta: Glifos; atlas: Uint8Array } {
	if (buf[0] !== 79 || buf[1] !== 71 || buf[2] !== 71 || buf[3] !== 76) {
		throw new Error("glifos da prévia ilegíveis");
	}
	const view = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
	const jsonLen = view.getUint32(4, true);
	const meta = JSON.parse(new TextDecoder().decode(buf.subarray(8, 8 + jsonLen))) as Glifos;
	const atlas = buf.subarray(8 + jsonLen);
	if (atlas.length !== meta.atlasW * meta.atlasH) throw new Error("atlas da prévia incompleto");
	return { meta, atlas };
}

export function carimbar(
	dst: Uint8Array,
	dstW: number,
	dstH: number,
	atlas: Uint8Array,
	atlasW: number,
	sprite: Sprite,
	dx: number,
	dy: number,
): void {
	const x0 = Math.round(dx);
	const y0 = Math.round(dy);
	for (let y = 0; y < sprite.h; y++) {
		const yy = y0 + y;
		if (yy < 0 || yy >= dstH) continue;
		const src = (sprite.y + y) * atlasW + sprite.x;
		for (let x = 0; x < sprite.w; x++) {
			if (!atlas[src + x]) continue;
			const xx = x0 + x;
			if (xx < 0 || xx >= dstW) continue;
			const o = (yy * dstW + xx) * 4;
			dst[o] = 255;
			dst[o + 1] = 255;
			dst[o + 2] = 255;
			dst[o + 3] = 255;
		}
	}
}

export function carimbarIndice(
	indices: Uint8Array,
	dstW: number,
	dstH: number,
	atlas: Uint8Array,
	atlasW: number,
	sprite: Sprite,
	dx: number,
	dy: number,
): void {
	const x0 = Math.round(dx);
	const y0 = Math.round(dy);
	for (let y = 0; y < sprite.h; y++) {
		const yy = y0 + y;
		if (yy < 0 || yy >= dstH) continue;
		const src = (sprite.y + y) * atlasW + sprite.x;
		const row = yy * dstW;
		for (let x = 0; x < sprite.w; x++) {
			if (!atlas[src + x]) continue;
			const xx = x0 + x;
			if (xx < 0 || xx >= dstW) continue;
			indices[row + xx] = 0;
		}
	}
}

type Ancora = "centro" | "esquerda" | "direita";

export function escreverSprite(
	dst: Uint8Array,
	dstW: number,
	dstH: number,
	atlas: Uint8Array,
	atlasW: number,
	sprite: Sprite,
	x: number,
	y: number,
	ancora: Ancora,
): void {
	const dx = ancora === "centro" ? x - sprite.w / 2 : ancora === "direita" ? x - sprite.w : x;
	carimbar(dst, dstW, dstH, atlas, atlasW, sprite, dx, y);
}

function layout(
	mapa: Record<string, Sprite>,
	kern: Record<string, number>,
	texto: string,
	extra: Sprite | null,
): { pecas: { sprite: Sprite; pen: number }[]; left: number; right: number; top: number } {
	const pecas: { sprite: Sprite; pen: number }[] = [];
	let pen = 0;
	let left = Infinity;
	let right = -Infinity;
	let top = Infinity;
	const colocar = (sprite: Sprite, ajuste: number) => {
		const x = pen + ajuste + sprite.ox;
		left = Math.min(left, x);
		right = Math.max(right, x + sprite.w);
		top = Math.min(top, sprite.oy);
		pecas.push({ sprite, pen: pen + ajuste });
		pen += ajuste + sprite.advance;
	};
	for (let i = 0; i < texto.length; i++) {
		const ch = texto[i]!;
		const sprite = mapa[ch];
		if (!sprite) throw new Error(`glifo ausente: ${ch}`);
		const prev = i > 0 ? texto[i - 1]! : "";
		const ajuste = i > 0 ? (kern[prev + ch] ?? 0) : 0;
		colocar(sprite, ajuste);
	}
	if (extra) {
		const prev = texto.at(-1) ?? "";
		const ajuste = prev ? (kern[prev + " "] ?? 0) : 0;
		colocar(extra, ajuste);
	}
	if (!Number.isFinite(left)) return { pecas, left: 0, right: 0, top: 0 };
	return { pecas, left, right, top };
}

export function escreverTexto(
	pintar: (sprite: Sprite, x: number, y: number) => void,
	mapa: Record<string, Sprite>,
	kern: Record<string, number>,
	texto: string,
	extra: Sprite | null,
	x: number,
	yTop: number,
	ancora: Ancora,
): void {
	const caixa = layout(mapa, kern, texto, extra);
	const origem =
		ancora === "centro" ? x - (caixa.left + caixa.right) / 2 : ancora === "direita" ? x - caixa.right : x - caixa.left;
	const baseline = yTop - caixa.top;
	for (const peca of caixa.pecas) {
		pintar(peca.sprite, origem + peca.pen + peca.sprite.ox, baseline + peca.sprite.oy);
	}
}
