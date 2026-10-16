import { arred1, arred2 } from "./validos";
import type { MediaPublica, PesquisaPublicada, PontoSerieMedia } from "./tipos";

/** Média final, congelada na abertura da apuração. */
export const DATA_MEDIA_FINAL = "2026-10-25";

function somarDiasIso(iso: string, dias: number): string {
	const [ano, mes, dia] = iso.split("-").map(Number) as [number, number, number];
	const utc = new Date(Date.UTC(ano, mes - 1, dia + dias));
	const y = utc.getUTCFullYear();
	const m = String(utc.getUTCMonth() + 1).padStart(2, "0");
	const d = String(utc.getUTCDate()).padStart(2, "0");
	return `${y}-${m}-${d}`;
}

/** Válidos de Flávio a partir dos totais, sem o arredondamento de uma pesquisa. */
function vfBruto(p: PesquisaPublicada): number | null {
	const base = p.totais.flavio + p.totais.lula;
	if (!(base > 0)) return null;
	return (p.totais.flavio / base) * 100;
}

/**
 * Última pesquisa publicada de cada CNPJ com fim de campo em (data − 14 dias, data].
 * `publicadas` pode vir em qualquer ordem.
 */
export function mediaEm(
	publicadas: readonly PesquisaPublicada[],
	data: string,
): MediaPublica | null {
	const desde = somarDiasIso(data, -14);
	const ult = new Map<string, { pesquisa: PesquisaPublicada; vf: number }>();
	const ordenadas = [...publicadas].sort(
		(a, b) => a.campoFim.localeCompare(b.campoFim) || a.registro.localeCompare(b.registro),
	);
	for (const pesquisa of ordenadas) {
		if (pesquisa.campoFim > data || pesquisa.campoFim <= desde) continue;
		const vf = vfBruto(pesquisa);
		if (vf == null) continue;
		ult.set(pesquisa.cnpj, { pesquisa, vf });
	}
	const ps = [...ult.values()].sort(
		(a, b) =>
			a.pesquisa.campoFim.localeCompare(b.pesquisa.campoFim) ||
			a.pesquisa.registro.localeCompare(b.pesquisa.registro),
	);
	if (!ps.length) return null;
	const vfRaw = ps.reduce((soma, item) => soma + item.vf, 0) / ps.length;
	const margem = arred1(ps.reduce((soma, item) => soma + item.pesquisa.margem, 0) / ps.length);
	return {
		data,
		vf: arred2(vfRaw),
		vl: arred2(100 - vfRaw),
		v: arred2(2 * vfRaw - 100),
		n: ps.length,
		margem,
		registros: ps.map((item) => item.pesquisa.registro),
	};
}

/** Um ponto por data distinta de fim de campo, até a data de referência. */
export function serieMediaDe(
	publicadas: readonly PesquisaPublicada[],
	dataRef: string,
): PontoSerieMedia[] {
	const datas = [...new Set(publicadas.map((p) => p.campoFim))]
		.filter((data) => data <= dataRef)
		.sort();
	const pontos: PontoSerieMedia[] = [];
	for (const data of datas) {
		const media = mediaEm(publicadas, data);
		if (!media) continue;
		pontos.push({ data: media.data, vf: media.vf, v: media.v, n: media.n });
	}
	return pontos;
}
