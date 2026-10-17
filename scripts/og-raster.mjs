/**
 * Raster binário do Archivo, o mesmo recorte do cartão (passo 8 nas curvas).
 * Só o gerador offline usa; o Worker carimba o atlas pronto.
 */
import { readFileSync } from "node:fs";
import { parse } from "@shuding/opentype.js";

function arquivo(caminho) {
	const b = readFileSync(caminho);
	return b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength);
}

export function fontes() {
	return {
		semi: parse(arquivo("public/fontes/Archivo-latin-600-normal.woff")),
		extra: parse(arquivo("public/fontes/Archivo-latin-800-normal.woff")),
	};
}

function achatar(comandos) {
	const polys = [];
	let atual = [];
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

/** Bitmap cortado. ox/oy são o canto do bitmap em relação à caneta na linha de base. */
export function raster(fonte, texto, tamanho, letterSpacing = 0) {
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
	if (!Number.isFinite(x1)) {
		return { w: 1, h: 1, alpha: new Uint8Array(1), ox: 0, oy: -tamanho, advance: 0 };
	}
	const x0 = Math.floor(x1) - 1;
	const y0 = Math.floor(y1) - 1;
	const w = Math.max(1, Math.ceil(x2) - x0 + 2);
	const h = Math.max(1, Math.ceil(y2) - y0 + 2);
	const alpha = new Uint8Array(w * h);
	const polys = achatar(path.commands);
	for (let y = 0; y < h; y++) {
		const yy = y0 + y + 0.5;
		const xs = [];
		for (const poly of polys) {
			for (let i = 0; i < poly.length; i++) {
				const a = poly[i];
				const b = poly[(i + 1) % poly.length];
				if ((a.y <= yy && b.y > yy) || (b.y <= yy && a.y > yy)) {
					const t = (yy - a.y) / (b.y - a.y);
					xs.push(a.x + t * (b.x - a.x));
				}
			}
		}
		xs.sort((p, q) => p - q);
		for (let i = 0; i + 1 < xs.length; i += 2) {
			const ini = Math.max(0, Math.ceil(xs[i] - x0));
			const fim = Math.min(w, Math.floor(xs[i + 1] - x0));
			alpha.fill(255, y * w + ini, y * w + fim);
		}
	}
	const advance = fonte.getAdvanceWidth(texto, tamanho, { kerning: false, letterSpacing });
	return { w, h, alpha, ox: x0, oy: y0 - tamanho, advance };
}

export function kerning(fonte, chars, tamanho, letterSpacing) {
	const out = {};
	const opcoes = { kerning: true, letterSpacing };
	for (const a of chars) {
		for (const b of chars) {
			const ambos = fonte.getAdvanceWidth(a + b, tamanho, opcoes);
			const soma =
				fonte.getAdvanceWidth(a, tamanho, opcoes) + fonte.getAdvanceWidth(b, tamanho, opcoes);
			const k = ambos - soma;
			if (Math.abs(k) > 0.05) out[a + b] = k;
		}
	}
	return out;
}
