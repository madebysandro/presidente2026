import { decode as decodificarJpeg } from "jpeg-js";
import type { PayloadPesquisas } from "../pesquisas/tipos";
import {
	carimbar,
	escreverSprite,
	escreverTexto,
	type Glifos,
	type Sprite,
} from "./og-codec";
import { ALTURA_PREVIA, LARGURA_PREVIA, textoUm } from "./previa";

type Cor = [number, number, number, number];

type Bitmap = {
	w: number;
	h: number;
	data: Uint8Array;
};

type BuscaAssets = {
	fetch(input: URL): Promise<Response>;
};

type Fotos = {
	fundoFlavio: Bitmap;
	fundoLula: Bitmap;
	flavio: Bitmap;
	lula: Bitmap;
};

let fotos: Promise<Fotos> | null = null;

async function ler(assets: BuscaAssets, requestUrl: string, caminho: string): Promise<ArrayBuffer> {
	const resposta = await assets.fetch(new URL(caminho, requestUrl));
	if (!resposta.ok) throw new Error(`asset ${caminho} respondeu ${resposta.status}`);
	return resposta.arrayBuffer();
}

function jpeg(buf: ArrayBuffer): Bitmap {
	const dec = decodificarJpeg(new Uint8Array(buf), { useTArray: true, formatAsRGBA: true });
	return { w: dec.width, h: dec.height, data: dec.data };
}

function carregarFotos(assets: BuscaAssets, requestUrl: string): Promise<Fotos> {
	fotos ??= Promise.all([
		ler(assets, requestUrl, "/midia/og-fundo-flavio.jpg"),
		ler(assets, requestUrl, "/midia/og-fundo-lula.jpg"),
		ler(assets, requestUrl, "/midia/flavio.jpg"),
		ler(assets, requestUrl, "/midia/lula.jpg"),
	])
		.then(([fundoFlavio, fundoLula, flavio, lula]) => ({
			fundoFlavio: jpeg(fundoFlavio),
			fundoLula: jpeg(fundoLula),
			flavio: jpeg(flavio),
			lula: jpeg(lula),
		}))
		.catch((erro: unknown) => {
			fotos = null;
			throw erro;
		});
	return fotos;
}

function cor32(r: number, g: number, b: number): number {
	return (255 << 24) | (b << 16) | (g << 8) | r;
}

function preencher(px: Uint32Array, w: number, x: number, largura: number, cor: number): void {
	for (let y = 0; y < ALTURA_PREVIA; y++) {
		const row = y * w + x;
		px.fill(cor, row, row + largura);
	}
}

function cobrir(
	dst: Uint8Array,
	src: Bitmap,
	dx: number,
	dy: number,
	dw: number,
	dh: number,
	py: number,
): void {
	const escala = Math.max(dw / src.w, dh / src.h);
	const ox = (dw - src.w * escala) * 0.5;
	const oy = (dh - src.h * escala) * py;
	const s = src.data;
	const sW = src.w;
	const sH = src.h;
	for (let y = 0; y < dh; y++) {
		const sy = (y - oy) / escala;
		if (sy < 0 || sy >= sH) continue;
		const y0 = sy | 0;
		const y1 = y0 + 1 < sH ? y0 + 1 : sH - 1;
		const fy = sy - y0;
		const row0 = y0 * sW;
		const row1 = y1 * sW;
		const base = (dy + y) * LARGURA_PREVIA + dx;
		for (let x = 0; x < dw; x++) {
			const sx = (x - ox) / escala;
			if (sx < 0 || sx >= sW) continue;
			const x0 = sx | 0;
			const x1 = x0 + 1 < sW ? x0 + 1 : sW - 1;
			const fx = sx - x0;
			const i00 = (row0 + x0) << 2;
			const i10 = (row0 + x1) << 2;
			const i01 = (row1 + x0) << 2;
			const i11 = (row1 + x1) << 2;
			const w00 = (1 - fx) * (1 - fy);
			const w10 = fx * (1 - fy);
			const w01 = (1 - fx) * fy;
			const w11 = fx * fy;
			const o = (base + x) << 2;
			dst[o] = s[i00]! * w00 + s[i10]! * w10 + s[i01]! * w01 + s[i11]! * w11;
			dst[o + 1] = s[i00 + 1]! * w00 + s[i10 + 1]! * w10 + s[i01 + 1]! * w01 + s[i11 + 1]! * w11;
			dst[o + 2] = s[i00 + 2]! * w00 + s[i10 + 2]! * w10 + s[i01 + 2]! * w01 + s[i11 + 2]! * w11;
			dst[o + 3] = 255;
		}
	}
}

function disco(dst: Uint8Array, cx: number, cy: number, raio: number): void {
	const r2 = raio * raio;
	const x0 = Math.max(0, Math.floor(cx - raio));
	const x1 = Math.min(LARGURA_PREVIA - 1, Math.ceil(cx + raio));
	const y0 = Math.max(0, Math.floor(cy - raio));
	const y1 = Math.min(ALTURA_PREVIA - 1, Math.ceil(cy + raio));
	for (let y = y0; y <= y1; y++) {
		const dy = y + 0.5 - cy;
		const row = y * LARGURA_PREVIA;
		for (let x = x0; x <= x1; x++) {
			const dx = x + 0.5 - cx;
			if (dx * dx + dy * dy > r2) continue;
			const o = (row + x) << 2;
			dst[o] = 255;
			dst[o + 1] = 255;
			dst[o + 2] = 255;
			dst[o + 3] = 255;
		}
	}
}

function rosto(dst: Uint8Array, src: Bitmap, cx: number, cy: number, raio: number, py: number): void {
	const lado = raio * 2;
	const escala = Math.max(lado / src.w, lado / src.h);
	const ox = (lado - src.w * escala) * 0.5;
	const oy = (lado - src.h * escala) * py;
	const r2 = raio * raio;
	const s = src.data;
	for (let y = -raio; y < raio; y++) {
		const yy = Math.round(cy + y);
		if (yy < 0 || yy >= ALTURA_PREVIA) continue;
		for (let x = -raio; x < raio; x++) {
			if (x * x + y * y > r2) continue;
			const sx = (x + raio - ox) / escala;
			const sy = (y + raio - oy) / escala;
			if (sx < 0 || sy < 0 || sx >= src.w || sy >= src.h) continue;
			const x0 = sx | 0;
			const y0 = sy | 0;
			const x1 = x0 + 1 < src.w ? x0 + 1 : src.w - 1;
			const y1 = y0 + 1 < src.h ? y0 + 1 : src.h - 1;
			const fx = sx - x0;
			const fy = sy - y0;
			const i00 = (y0 * src.w + x0) << 2;
			const i10 = (y0 * src.w + x1) << 2;
			const i01 = (y1 * src.w + x0) << 2;
			const i11 = (y1 * src.w + x1) << 2;
			const w00 = (1 - fx) * (1 - fy);
			const w10 = fx * (1 - fy);
			const w01 = (1 - fx) * fy;
			const w11 = fx * fy;
			const xx = Math.round(cx + x);
			if (xx < 0 || xx >= LARGURA_PREVIA) continue;
			const o = (yy * LARGURA_PREVIA + xx) << 2;
			dst[o] = s[i00]! * w00 + s[i10]! * w10 + s[i01]! * w01 + s[i11]! * w11;
			dst[o + 1] = s[i00 + 1]! * w00 + s[i10 + 1]! * w10 + s[i01 + 1]! * w01 + s[i11 + 1]! * w11;
			dst[o + 2] = s[i00 + 2]! * w00 + s[i10 + 2]! * w10 + s[i01 + 2]! * w01 + s[i11 + 2]! * w11;
			dst[o + 3] = 255;
		}
	}
}

function faixa(dst: Uint8Array, x: number, y: number, w: number, h: number, raio: number, cor: Cor): void {
	const a = cor[3] / 255;
	const inv = 1 - a;
	for (let yy = 0; yy < h; yy++) {
		for (let xx = 0; xx < w; xx++) {
			let dx = 0;
			let dy = 0;
			if (xx < raio && yy < raio) {
				dx = raio - xx;
				dy = raio - yy;
			} else if (xx >= w - raio && yy < raio) {
				dx = xx - (w - raio - 1);
				dy = raio - yy;
			} else if (xx < raio && yy >= h - raio) {
				dx = raio - xx;
				dy = yy - (h - raio - 1);
			} else if (xx >= w - raio && yy >= h - raio) {
				dx = xx - (w - raio - 1);
				dy = yy - (h - raio - 1);
			}
			if (dx * dx + dy * dy > raio * raio) continue;
			const o = ((y + yy) * LARGURA_PREVIA + x + xx) << 2;
			dst[o] = cor[0] * a + dst[o]! * inv;
			dst[o + 1] = cor[1] * a + dst[o + 1]! * inv;
			dst[o + 2] = cor[2] * a + dst[o + 2]! * inv;
			dst[o + 3] = 255;
		}
	}
}

function lado(
	dst: Uint8Array,
	fundo: Bitmap,
	rostoBmp: Bitmap,
	x: number,
	largura: number,
	cor: number,
	py: number,
): void {
	preencher(new Uint32Array(dst.buffer, dst.byteOffset, dst.byteLength / 4), LARGURA_PREVIA, x, largura, cor);
	cobrir(dst, fundo, x, 0, largura, ALTURA_PREVIA, 0.45);
	const cx = x + largura / 2;
	disco(dst, cx, 268, 78);
	rosto(dst, rostoBmp, cx, 268, 72, py);
}

function pintar(
	dst: Uint8Array,
	atlas: Uint8Array,
	atlasW: number,
	sprite: Sprite,
	x: number,
	y: number,
): void {
	carimbar(dst, LARGURA_PREVIA, ALTURA_PREVIA, atlas, atlasW, sprite, x, y);
}

export async function rgbaCartao(
	assets: BuscaAssets,
	requestUrl: string,
	glifos: Glifos,
	atlas: Uint8Array,
	payload: PayloadPesquisas,
	dias: number | null,
): Promise<Uint8Array> {
	const rec = await carregarFotos(assets, requestUrl);
	const media = payload.media;
	const esquerda = media ? Math.round((LARGURA_PREVIA * media.vf) / 100) : (LARGURA_PREVIA - 4) / 2;
	const larguraEsquerda = Math.min(LARGURA_PREVIA - 280, Math.max(280, esquerda));
	const larguraDireita = LARGURA_PREVIA - larguraEsquerda - 4;
	const dst = new Uint8Array(LARGURA_PREVIA * ALTURA_PREVIA * 4);
	lado(dst, rec.fundoFlavio, rec.flavio, 0, larguraEsquerda, cor32(45, 108, 223), 0.16);
	preencher(
		new Uint32Array(dst.buffer, dst.byteOffset, dst.byteLength / 4),
		LARGURA_PREVIA,
		larguraEsquerda,
		4,
		cor32(255, 255, 255),
	);
	lado(dst, rec.fundoLula, rec.lula, larguraEsquerda + 4, larguraDireita, cor32(224, 89, 42), 0.18);
	const atlasW = glifos.atlasW;
	escreverSprite(dst, LARGURA_PREVIA, ALTURA_PREVIA, atlas, atlasW, glifos.turno, 36, 28, "esquerda");
	if (dias != null) {
		const rotulo = String(dias);
		escreverTexto(
			(sprite, x, y) => pintar(dst, atlas, atlasW, sprite, x, y),
			glifos.g26,
			glifos.kern26,
			rotulo,
			dias === 1 ? glifos.sufixoDia : glifos.sufixoDias,
			LARGURA_PREVIA - 36,
			28,
			"direita",
		);
	}
	escreverSprite(
		dst,
		LARGURA_PREVIA,
		ALTURA_PREVIA,
		atlas,
		atlasW,
		glifos.flavio,
		larguraEsquerda / 2,
		360,
		"centro",
	);
	escreverSprite(
		dst,
		LARGURA_PREVIA,
		ALTURA_PREVIA,
		atlas,
		atlasW,
		glifos.lula,
		larguraEsquerda + 4 + larguraDireita / 2,
		360,
		"centro",
	);
	if (media) {
		escreverTexto(
			(sprite, x, y) => pintar(dst, atlas, atlasW, sprite, x, y),
			glifos.g150,
			glifos.kern150,
			textoUm(media.vf),
			null,
			larguraEsquerda / 2,
			400,
			"centro",
		);
		escreverTexto(
			(sprite, x, y) => pintar(dst, atlas, atlasW, sprite, x, y),
			glifos.g150,
			glifos.kern150,
			textoUm(media.vl),
			null,
			larguraEsquerda + 4 + larguraDireita / 2,
			400,
			"centro",
		);
	} else {
		const frase = glifos.frase;
		const faixaW = frase.w + 52;
		const faixaH = frase.h + 24;
		const fx = Math.round((LARGURA_PREVIA - faixaW) / 2);
		faixa(dst, fx, 430, faixaW, faixaH, 16, [8, 12, 20, 160]);
		carimbar(dst, LARGURA_PREVIA, ALTURA_PREVIA, atlas, atlasW, frase, fx + 26, 430 + 12);
	}
	escreverSprite(
		dst,
		LARGURA_PREVIA,
		ALTURA_PREVIA,
		atlas,
		atlasW,
		glifos.marca,
		LARGURA_PREVIA / 2,
		ALTURA_PREVIA - 48,
		"centro",
	);
	return dst;
}
