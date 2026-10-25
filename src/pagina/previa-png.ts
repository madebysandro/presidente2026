import { contagemVotacao } from "./topo";
import {
	carimbarIndice,
	codificarPng,
	escreverTexto,
	inflate,
	lerBase,
	lerGlifos,
	quantizar,
	type Glifos,
} from "./og-codec";
import type { Cartao } from "./previa-png-media";
import { ehNoite, LARGURA_PREVIA, placarDaPrevia, versaoDaPrevia, type FontePrevia } from "./previa";

type BuscaAssets = {
	fetch(input: URL): Promise<Response>;
};

type Atlas = {
	meta: Glifos;
	atlas: Uint8Array;
};

const CORES = 128;
const cachePng = new Map<string, Uint8Array>();
const ordemCache: string[] = [];
let glifos: Promise<Atlas> | null = null;
let baseSem: Promise<ReturnType<typeof lerBase>> | null = null;

async function ler(assets: BuscaAssets, requestUrl: string, caminho: string): Promise<Uint8Array> {
	const resposta = await assets.fetch(new URL(caminho, requestUrl));
	if (!resposta.ok) throw new Error(`asset ${caminho} respondeu ${resposta.status}`);
	return inflate(new Uint8Array(await resposta.arrayBuffer()));
}

function carregarGlifos(assets: BuscaAssets, requestUrl: string): Promise<Atlas> {
	glifos ??= ler(assets, requestUrl, "/midia/og-glifos.bin")
		.then(lerGlifos)
		.catch((erro: unknown) => {
			glifos = null;
			throw erro;
		});
	return glifos;
}

function carregarBase(assets: BuscaAssets, requestUrl: string): Promise<ReturnType<typeof lerBase>> {
	baseSem ??= ler(assets, requestUrl, "/midia/og-base-sem.bin")
		.then(lerBase)
		.catch((erro: unknown) => {
			baseSem = null;
			throw erro;
		});
	return baseSem;
}

function guardar(chave: string, png: Uint8Array): Uint8Array {
	cachePng.set(chave, png);
	ordemCache.push(chave);
	if (ordemCache.length > 4) {
		const velha = ordemCache.shift();
		if (velha) cachePng.delete(velha);
	}
	return png;
}

async function pngSemMedia(assets: BuscaAssets, requestUrl: string, dias: number): Promise<Uint8Array> {
	const [base, fonte] = await Promise.all([
		carregarBase(assets, requestUrl),
		carregarGlifos(assets, requestUrl),
	]);
	const indices = base.indices.slice();
	const rotulo = String(dias);
	escreverTexto(
		(sprite, x, y) =>
			carimbarIndice(indices, base.w, base.h, fonte.atlas, fonte.meta.atlasW, sprite, x, y),
		fonte.meta.g26,
		fonte.meta.kern26,
		rotulo,
		dias === 1 ? fonte.meta.sufixoDia : fonte.meta.sufixoDias,
		LARGURA_PREVIA - 36,
		28,
		"direita",
	);
	return codificarPng(indices, base.w, base.h, base.paleta);
}

/**
 * O PNG fica em memória pela versão da prévia (os dígitos que ele mostra). A
 * arte sem média já vem indexada; o resto desenha uma vez e reaproveita.
 */
export async function pngDaPrevia(
	assets: BuscaAssets,
	requestUrl: string,
	fonte: FontePrevia,
): Promise<Uint8Array> {
	const chave = versaoDaPrevia(fonte);
	const pronto = cachePng.get(chave);
	if (pronto) return pronto;
	const placar = placarDaPrevia(fonte);
	const noite = ehNoite(fonte);
	if (!noite && !placar) {
		return guardar(chave, await pngSemMedia(assets, requestUrl, contagemVotacao(fonte.agora).dias));
	}
	const dias = noite ? null : contagemVotacao(fonte.agora).dias;
	const glifos = await carregarGlifos(assets, requestUrl);
	const { rgbaCartao } = await import("./previa-png-media");
	const cartao: Cartao = { esquerda: placar?.esquerda.quem ?? "lula", placar, convite: false };
	const rgba = await rgbaCartao(assets, requestUrl, glifos.meta, glifos.atlas, cartao, dias);
	const q = quantizar(rgba, LARGURA_PREVIA, 630, CORES);
	return guardar(chave, await codificarPng(q.indices, LARGURA_PREVIA, 630, q.paleta));
}
