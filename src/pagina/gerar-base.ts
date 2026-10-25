import { empacotarBase, inflate, lerGlifos, quantizar } from "./og-codec";
import { rgbaCartao, type Cartao } from "./previa-png-media";
import { ALTURA_PREVIA, LARGURA_PREVIA } from "./previa";

type BuscaAssets = {
	fetch(input: URL): Promise<Response>;
};

const SEM: Cartao = { esquerda: "flavio", placar: null, convite: true };

/** Cartão sem média e sem a contagem de dias, já na paleta do Worker. */
export async function baseSemBruta(assets: BuscaAssets, requestUrl: string): Promise<Uint8Array> {
	const resposta = await assets.fetch(new URL("/midia/og-glifos.bin", requestUrl));
	if (!resposta.ok) throw new Error(`glifos ${resposta.status}`);
	const cru = new Uint8Array(await resposta.arrayBuffer());
	const { meta, atlas } = lerGlifos(await inflate(cru));
	const rgba = await rgbaCartao(assets, requestUrl, meta, atlas, SEM, null);
	const q = quantizar(rgba, LARGURA_PREVIA, ALTURA_PREVIA, 128);
	return empacotarBase(q.indices, LARGURA_PREVIA, ALTURA_PREVIA, q.paleta);
}
