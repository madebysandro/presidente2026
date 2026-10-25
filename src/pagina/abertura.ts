import { mediaEm } from "../pesquisas/media";
import type { PayloadPesquisas } from "../pesquisas/tipos";

const INICIO_RETA = "2026-10-05";
const FIM_RETA = "2026-10-25";

type PassoAbertura = {
	data: string;
	vf: number;
	vl: number;
	n: number;
};

export type DadosAbertura = {
	hoje: string;
	vf: number | null;
	vl: number | null;
	n: number | null;
	margem: number | null;
	passos: PassoAbertura[];
};

function somarDias(iso: string, dias: number): string {
	const [ano, mes, dia] = iso.split("-").map(Number) as [number, number, number];
	const utc = new Date(Date.UTC(ano, mes - 1, dia + dias));
	const y = utc.getUTCFullYear();
	const m = String(utc.getUTCMonth() + 1).padStart(2, "0");
	const d = String(utc.getUTCDate()).padStart(2, "0");
	return `${y}-${m}-${d}`;
}

/**
 * O que a vinheta precisa no cliente, sem reimplementar a média.
 * Cada passo é a média da data em que uma pesquisa foi liberada.
 */
export function dadosAbertura(payload: PayloadPesquisas): DadosAbertura {
	const passos: PassoAbertura[] = [];
	const limite = payload.hoje < FIM_RETA ? payload.hoje : FIM_RETA;
	for (let iso = INICIO_RETA; iso <= limite; iso = somarDias(iso, 1)) {
		if (!payload.publicadas.some((pesquisa) => pesquisa.liberacaoEfetiva === iso)) continue;
		const media = mediaEm(payload.publicadas, iso);
		if (!media) continue;
		passos.push({ data: iso, vf: media.vf, vl: media.vl, n: media.n });
	}
	const media = payload.media;
	return {
		hoje: payload.hoje,
		vf: media?.vf ?? null,
		vl: media?.vl ?? null,
		n: media?.n ?? null,
		margem: media?.margem ?? null,
		passos,
	};
}
