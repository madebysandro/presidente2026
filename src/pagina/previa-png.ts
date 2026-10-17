import { parse as lerFonte, type ComandoOt, type FonteOt } from "@shuding/opentype.js";
import { decode as decodificarJpeg } from "jpeg-js";
import UPNG from "upng-js";
import type { PayloadPesquisas } from "../pesquisas/tipos";
import { contagemVotacao } from "./topo";
import {
	ALTURA_PREVIA,
	descricaoDaPrevia,
	LARGURA_PREVIA,
	textoDias,
	textoUm,
} from "./previa";

const TETO_BYTES = 300 * 1024;
const BRANCO: Cor = [255, 255, 255, 255];

type Cor = [number, number, number, number];

type Bitmap = {
	w: number;
	h: number;
	data: Uint8Array;
};

type Ponto = { x: number; y: number };

type BuscaAssets = {
	fetch(input: URL): Promise<Response>;
};

type Recursos = {
	fundoFlavio: Bitmap;
	fundoLula: Bitmap;
	flavio: Bitmap;
	lula: Bitmap;
	semi: FonteOt;
	extra: FonteOt;
};

let recursos: Promise<Recursos> | null = null;

function copia(buf: ArrayBuffer | SharedArrayBuffer): ArrayBuffer {
	const origem = new Uint8Array(buf);
	const novo = new ArrayBuffer(origem.byteLength);
	new Uint8Array(novo).set(origem);
	return novo;
}

async function ler(assets: BuscaAssets, requestUrl: string, caminho: string): Promise<ArrayBuffer> {
	const resposta = await assets.fetch(new URL(caminho, requestUrl));
	if (!resposta.ok) throw new Error(`asset ${caminho} respondeu ${resposta.status}`);
	return resposta.arrayBuffer();
}

function jpeg(buf: ArrayBuffer): Bitmap {
	const dec = decodificarJpeg(new Uint8Array(buf), { useTArray: true, formatAsRGBA: true });
	return { w: dec.width, h: dec.height, data: dec.data };
}

function carregar(assets: BuscaAssets, requestUrl: string): Promise<Recursos> {
	recursos ??= Promise.all([
		ler(assets, requestUrl, "/midia/og-fundo-flavio.jpg"),
		ler(assets, requestUrl, "/midia/og-fundo-lula.jpg"),
		ler(assets, requestUrl, "/midia/flavio.jpg"),
		ler(assets, requestUrl, "/midia/lula.jpg"),
		ler(assets, requestUrl, "/fontes/Archivo-latin-600-normal.woff"),
		ler(assets, requestUrl, "/fontes/Archivo-latin-800-normal.woff"),
	])
		.then(([fundoFlavio, fundoLula, flavio, lula, semi, extra]) => ({
			fundoFlavio: jpeg(fundoFlavio),
			fundoLula: jpeg(fundoLula),
			flavio: jpeg(flavio),
			lula: jpeg(lula),
			semi: lerFonte(copia(semi)),
			extra: lerFonte(copia(extra)),
		}))
		.catch((erro: unknown) => {
			recursos = null;
			throw erro;
		});
	return recursos;
}

function pixel(bmp: Bitmap, x: number, y: number): number {
	return (y * bmp.w + x) * 4;
}

function mistura(dst: Bitmap, x: number, y: number, cor: Cor): void {
	if (x < 0 || y < 0 || x >= dst.w || y >= dst.h) return;
	const o = pixel(dst, x, y);
	const a = cor[3] / 255;
	const inv = 1 - a;
	dst.data[o] = cor[0] * a + dst.data[o]! * inv;
	dst.data[o + 1] = cor[1] * a + dst.data[o + 1]! * inv;
	dst.data[o + 2] = cor[2] * a + dst.data[o + 2]! * inv;
	dst.data[o + 3] = 255;
}

function amostra(src: Bitmap, x0: number, y0: number, x1: number, y1: number, fx: number, fy: number): Cor {
	const i00 = pixel(src, x0, y0);
	const i10 = pixel(src, x1, y0);
	const i01 = pixel(src, x0, y1);
	const i11 = pixel(src, x1, y1);
	const d = src.data;
	const canal = (c: number) => {
		const a = d[i00 + c]! * (1 - fx) + d[i10 + c]! * fx;
		const b = d[i01 + c]! * (1 - fx) + d[i11 + c]! * fx;
		return a * (1 - fy) + b * fy;
	};
	return [canal(0), canal(1), canal(2), 255];
}

function cobrir(dst: Bitmap, src: Bitmap, dx: number, dy: number, dw: number, dh: number, py: number): void {
	const escala = Math.max(dw / src.w, dh / src.h);
	const sw = src.w * escala;
	const sh = src.h * escala;
	const ox = (dw - sw) * 0.5;
	const oy = (dh - sh) * py;
	for (let y = 0; y < dh; y++) {
		const sy = (y - oy) / escala;
		if (sy < 0 || sy >= src.h) continue;
		const y0 = Math.floor(sy);
		const y1 = Math.min(src.h - 1, y0 + 1);
		const fy = sy - y0;
		for (let x = 0; x < dw; x++) {
			const sx = (x - ox) / escala;
			if (sx < 0 || sx >= src.w) continue;
			const x0 = Math.floor(sx);
			const x1 = Math.min(src.w - 1, x0 + 1);
			const cor = amostra(src, x0, y0, x1, y1, sx - x0, fy);
			const xx = dx + x;
			const yy = dy + y;
			if (xx < 0 || yy < 0 || xx >= dst.w || yy >= dst.h) continue;
			const o = pixel(dst, xx, yy);
			dst.data[o] = cor[0];
			dst.data[o + 1] = cor[1];
			dst.data[o + 2] = cor[2];
			dst.data[o + 3] = 255;
		}
	}
}

function disco(dst: Bitmap, cx: number, cy: number, raio: number, cor: Cor): void {
	const r2 = raio * raio;
	const x0 = Math.max(0, Math.floor(cx - raio));
	const x1 = Math.min(dst.w - 1, Math.ceil(cx + raio));
	const y0 = Math.max(0, Math.floor(cy - raio));
	const y1 = Math.min(dst.h - 1, Math.ceil(cy + raio));
	for (let y = y0; y <= y1; y++) {
		for (let x = x0; x <= x1; x++) {
			const dx = x + 0.5 - cx;
			const dy = y + 0.5 - cy;
			if (dx * dx + dy * dy <= r2) mistura(dst, x, y, cor);
		}
	}
}

function rosto(dst: Bitmap, src: Bitmap, cx: number, cy: number, raio: number, py: number): void {
	const lado = raio * 2;
	const escala = Math.max(lado / src.w, lado / src.h);
	const sw = src.w * escala;
	const sh = src.h * escala;
	const ox = (lado - sw) * 0.5;
	const oy = (lado - sh) * py;
	const r2 = raio * raio;
	for (let y = -raio; y < raio; y++) {
		for (let x = -raio; x < raio; x++) {
			if (x * x + y * y > r2) continue;
			const sx = (x + raio - ox) / escala;
			const sy = (y + raio - oy) / escala;
			if (sx < 0 || sy < 0 || sx >= src.w || sy >= src.h) continue;
			const x0 = Math.floor(sx);
			const y0 = Math.floor(sy);
			const cor = amostra(
				src,
				x0,
				y0,
				Math.min(src.w - 1, x0 + 1),
				Math.min(src.h - 1, y0 + 1),
				sx - x0,
				sy - y0,
			);
			mistura(dst, Math.round(cx + x), Math.round(cy + y), cor);
		}
	}
}

function achatar(comandos: ComandoOt[]): Ponto[][] {
	const polys: Ponto[][] = [];
	let atual: Ponto[] = [];
	const passo = 8;
	for (const c of comandos) {
		const ultimo = atual.at(-1);
		if (c.type === "M") {
			if (atual.length > 2) polys.push(atual);
			atual = [{ x: c.x, y: c.y }];
		} else if (c.type === "L") {
			atual.push({ x: c.x, y: c.y });
		} else if (c.type === "Q" && ultimo && c.x1 != null && c.y1 != null) {
			for (let i = 1; i <= passo; i++) {
				const t = i / passo;
				const u = 1 - t;
				atual.push({
					x: u * u * ultimo.x + 2 * u * t * c.x1 + t * t * c.x,
					y: u * u * ultimo.y + 2 * u * t * c.y1 + t * t * c.y,
				});
			}
		} else if (c.type === "C" && ultimo && c.x1 != null && c.y1 != null && c.x2 != null && c.y2 != null) {
			for (let i = 1; i <= passo; i++) {
				const t = i / passo;
				const u = 1 - t;
				atual.push({
					x: u * u * u * ultimo.x + 3 * u * u * t * c.x1 + 3 * u * t * t * c.x2 + t * t * t * c.x,
					y: u * u * u * ultimo.y + 3 * u * u * t * c.y1 + 3 * u * t * t * c.y2 + t * t * t * c.y,
				});
			}
		} else if (c.type === "Z") {
			if (atual.length > 2) polys.push(atual);
			atual = [];
		}
	}
	if (atual.length > 2) polys.push(atual);
	return polys;
}

function textoBitmap(
	fonte: FonteOt,
	texto: string,
	tamanho: number,
	cor: Cor,
	letterSpacing = 0,
): Bitmap {
	const path = fonte.getPath(texto, 0, tamanho, tamanho, { letterSpacing, kerning: true });
	let x1 = Infinity;
	let y1 = Infinity;
	let x2 = -Infinity;
	let y2 = -Infinity;
	for (const c of path.commands) {
		for (const n of [c.x, c.x1, c.x2]) {
			if (n != null) {
				x1 = Math.min(x1, n);
				x2 = Math.max(x2, n);
			}
		}
		for (const n of [c.y, c.y1, c.y2]) {
			if (n != null) {
				y1 = Math.min(y1, n);
				y2 = Math.max(y2, n);
			}
		}
	}
	if (!Number.isFinite(x1)) return { w: 1, h: 1, data: new Uint8Array(4) };
	const x0 = Math.floor(x1) - 1;
	const y0 = Math.floor(y1) - 1;
	const w = Math.max(1, Math.ceil(x2) - x0 + 2);
	const h = Math.max(1, Math.ceil(y2) - y0 + 2);
	const data = new Uint8Array(w * h * 4);
	const polys = achatar(path.commands);
	for (let y = 0; y < h; y++) {
		const yy = y0 + y + 0.5;
		const xs: number[] = [];
		for (const poly of polys) {
			for (let i = 0; i < poly.length; i++) {
				const a = poly[i]!;
				const b = poly[(i + 1) % poly.length]!;
				if ((a.y <= yy && b.y > yy) || (b.y <= yy && a.y > yy)) {
					const t = (yy - a.y) / (b.y - a.y);
					xs.push(a.x + t * (b.x - a.x));
				}
			}
		}
		xs.sort((p, q) => p - q);
		for (let i = 0; i + 1 < xs.length; i += 2) {
			const ini = Math.max(0, Math.ceil(xs[i]! - x0));
			const fim = Math.min(w, Math.floor(xs[i + 1]! - x0));
			for (let x = ini; x < fim; x++) {
				const o = (y * w + x) * 4;
				data[o] = cor[0];
				data[o + 1] = cor[1];
				data[o + 2] = cor[2];
				data[o + 3] = cor[3];
			}
		}
	}
	return { w, h, data };
}

function colar(dst: Bitmap, src: Bitmap, dx: number, dy: number): void {
	for (let y = 0; y < src.h; y++) {
		for (let x = 0; x < src.w; x++) {
			const o = pixel(src, x, y);
			const a = src.data[o + 3] ?? 0;
			if (a === 0) continue;
			mistura(dst, dx + x, dy + y, [
				src.data[o] ?? 0,
				src.data[o + 1] ?? 0,
				src.data[o + 2] ?? 0,
				a,
			]);
		}
	}
}

function escrever(
	dst: Bitmap,
	fonte: FonteOt,
	texto: string,
	tamanho: number,
	x: number,
	y: number,
	ancora: "centro" | "esquerda" | "direita",
	letterSpacing = 0,
): void {
	const bmp = textoBitmap(fonte, texto, tamanho, BRANCO, letterSpacing);
	const dx = ancora === "centro" ? x - bmp.w / 2 : ancora === "direita" ? x - bmp.w : x;
	colar(dst, bmp, Math.round(dx), Math.round(y));
}

function faixa(dst: Bitmap, x: number, y: number, w: number, h: number, raio: number, cor: Cor): void {
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
			mistura(dst, x + xx, y + yy, cor);
		}
	}
}

function lado(
	dst: Bitmap,
	fundo: Bitmap,
	rostoBmp: Bitmap,
	x: number,
	largura: number,
	cor: Cor,
	py: number,
): void {
	for (let y = 0; y < ALTURA_PREVIA; y++) {
		for (let xx = 0; xx < largura; xx++) mistura(dst, x + xx, y, cor);
	}
	cobrir(dst, fundo, x, 0, largura, ALTURA_PREVIA, 0.45);
	const cx = x + largura / 2;
	const cy = 268;
	disco(dst, cx, cy, 78, BRANCO);
	rosto(dst, rostoBmp, cx, cy, 72, py);
}

function desenhar(rec: Recursos, payload: PayloadPesquisas, dias: number): Bitmap {
	const media = payload.media;
	const esquerda = media ? Math.round((LARGURA_PREVIA * media.vf) / 100) : (LARGURA_PREVIA - 4) / 2;
	const larguraEsquerda = Math.min(LARGURA_PREVIA - 280, Math.max(280, esquerda));
	const larguraDireita = LARGURA_PREVIA - larguraEsquerda - 4;
	const dst: Bitmap = {
		w: LARGURA_PREVIA,
		h: ALTURA_PREVIA,
		data: new Uint8Array(LARGURA_PREVIA * ALTURA_PREVIA * 4),
	};
	lado(dst, rec.fundoFlavio, rec.flavio, 0, larguraEsquerda, [45, 108, 223, 255], 0.16);
	for (let y = 0; y < ALTURA_PREVIA; y++) {
		for (let x = 0; x < 4; x++) mistura(dst, larguraEsquerda + x, y, BRANCO);
	}
	lado(dst, rec.fundoLula, rec.lula, larguraEsquerda + 4, larguraDireita, [224, 89, 42, 255], 0.18);
	escrever(dst, rec.extra, "2º TURNO", 26, 36, 28, "esquerda", 0.04);
	escrever(dst, rec.extra, textoDias(dias), 26, LARGURA_PREVIA - 36, 28, "direita");
	escrever(dst, rec.semi, "Flávio", 34, larguraEsquerda / 2, 360, "centro");
	escrever(dst, rec.semi, "Lula", 34, larguraEsquerda + 4 + larguraDireita / 2, 360, "centro");
	if (media) {
		escrever(dst, rec.extra, textoUm(media.vf), 150, larguraEsquerda / 2, 400, "centro", -7 / 150);
		escrever(dst, rec.extra, textoUm(media.vl), 150, larguraEsquerda + 4 + larguraDireita / 2, 400, "centro", -7 / 150);
	} else {
		const frase = descricaoDaPrevia(payload);
		const bmp = textoBitmap(rec.extra, frase, 36, BRANCO);
		const faixaW = bmp.w + 52;
		const faixaH = bmp.h + 24;
		const fx = Math.round((LARGURA_PREVIA - faixaW) / 2);
		const fy = 430;
		faixa(dst, fx, fy, faixaW, faixaH, 16, [8, 12, 20, 160]);
		colar(dst, bmp, fx + 26, fy + 12);
	}
	escrever(dst, rec.semi, "presidente2026.win", 22, LARGURA_PREVIA / 2, ALTURA_PREVIA - 48, "centro");
	return dst;
}

function quantizar(rgba: ArrayBuffer, w: number, h: number): Uint8Array {
	let menor: Uint8Array | null = null;
	for (const cores of [128, 64, 32, 16]) {
		const saida = new Uint8Array(UPNG.encode([rgba], w, h, cores));
		if (!menor || saida.byteLength < menor.byteLength) menor = saida;
		if (saida.byteLength < TETO_BYTES) return saida;
	}
	return menor ?? new Uint8Array();
}

/**
 * O runtime recusa `WebAssembly.instantiate` de bytes, então o cartão é
 * desenhado em JS: JPEG das fotos, Archivo via opentype e PNG quantizado.
 * Os fundos já vêm multiplicados em azul e laranja.
 */
export async function pngDaPrevia(
	assets: BuscaAssets,
	requestUrl: string,
	payload: PayloadPesquisas,
	agora: Date,
): Promise<Uint8Array> {
	const rec = await carregar(assets, requestUrl);
	const bmp = desenhar(rec, payload, contagemVotacao(agora).dias);
	return quantizar(copia(bmp.data.buffer), bmp.w, bmp.h);
}
