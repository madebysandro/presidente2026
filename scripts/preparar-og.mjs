/**
 * Gera o atlas e a base sem média que o Worker só carimba.
 * Rode de novo se o desenho do cartão mudar: `node scripts/preparar-og.mjs`
 */
import { readFileSync, writeFileSync } from "node:fs";
import { build } from "esbuild";
import { fontes, kerning, raster } from "./og-raster.mjs";

const ATLAS_W = 2048;

async function comprimir(dados) {
	const stream = new ReadableStream({
		start(controller) {
			controller.enqueue(dados);
			controller.close();
		},
	});
	const comprimido = stream.pipeThrough(new CompressionStream("deflate"));
	return new Uint8Array(await new Response(comprimido).arrayBuffer());
}

function montarGlifos() {
	const { semi, extra } = fontes();
	const itens = [];
	const guardar = (grupo, chave, rec, letterSpacing) => {
		itens.push({ grupo, chave, letterSpacing, ...rec });
	};
	guardar("fixo", "turno", raster(extra, "2º TURNO", 26, 0.04), 0);
	guardar("fixo", "flavio", raster(semi, "Flávio", 34, 0), 0);
	guardar("fixo", "lula", raster(semi, "Lula", 34, 0), 0);
	guardar("fixo", "marca", raster(semi, "presidente2026.win", 22, 0), 0);
	guardar("fixo", "frase", raster(extra, "Acompanhe as pesquisas do 2º turno", 36, 0), 0);
	guardar("sufixo", "sufixoDia", raster(extra, " DIA ATÉ 25/10", 26, 0), 0);
	guardar("sufixo", "sufixoDias", raster(extra, " DIAS ATÉ 25/10", 26, 0), 0);
	for (const ch of "0123456789,") {
		guardar("g150", ch, raster(extra, ch, 150, -7 / 150), -7 / 150);
		guardar("g26", ch, raster(extra, ch, 26, 0), 0);
	}

	let x = 0;
	let y = 0;
	let rowH = 0;
	for (const item of itens) {
		if (x + item.w + 1 > ATLAS_W) {
			x = 0;
			y += rowH + 1;
			rowH = 0;
		}
		item.ax = x;
		item.ay = y;
		x += item.w + 1;
		rowH = Math.max(rowH, item.h);
	}
	const atlasH = y + rowH;
	const atlas = new Uint8Array(ATLAS_W * atlasH);
	for (const item of itens) {
		for (let row = 0; row < item.h; row++) {
			atlas.set(item.alpha.subarray(row * item.w, (row + 1) * item.w), (item.ay + row) * ATLAS_W + item.ax);
		}
	}
	const sprite = (item) => ({
		x: item.ax,
		y: item.ay,
		w: item.w,
		h: item.h,
		ox: item.ox,
		oy: item.oy,
		advance: item.advance,
	});
	const por = (grupo) => {
		const out = {};
		for (const item of itens) if (item.grupo === grupo) out[item.chave] = sprite(item);
		return out;
	};
	const fixo = por("fixo");
	const meta = {
		atlasW: ATLAS_W,
		atlasH,
		...fixo,
		...por("sufixo"),
		g150: por("g150"),
		g26: por("g26"),
		kern150: kerning(extra, "0123456789,", 150, -7 / 150),
		kern26: kerning(extra, "0123456789 ", 26, 0),
	};
	const json = new TextEncoder().encode(JSON.stringify(meta));
	const cru = new Uint8Array(8 + json.length + atlas.length);
	cru[0] = 79;
	cru[1] = 71;
	cru[2] = 71;
	cru[3] = 76;
	new DataView(cru.buffer).setUint32(4, json.length, true);
	cru.set(json, 8);
	cru.set(atlas, 8 + json.length);
	return cru;
}

const glifos = await comprimir(montarGlifos());
writeFileSync("public/midia/og-glifos.bin", glifos);
console.log("glifos", glifos.byteLength);

await build({
	entryPoints: ["src/pagina/gerar-base.ts"],
	bundle: true,
	platform: "node",
	format: "esm",
	outfile: "/tmp/gerar-base.mjs",
	logLevel: "silent",
});

const { baseSemBruta } = await import("/tmp/gerar-base.mjs");
const assets = {
	async fetch(url) {
		const arquivo = readFileSync(`public${url.pathname}`);
		return new Response(arquivo);
	},
};
const base = await comprimir(await baseSemBruta(assets, "https://presidente2026.local/"));
writeFileSync("public/midia/og-base-sem.bin", base);
console.log("base", base.byteLength);
