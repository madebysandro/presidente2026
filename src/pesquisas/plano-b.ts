import { parseCsvTse } from "./csv";
import { linhaPesquisaNoCorte, registrosDoTse } from "./importar";
import type { RegistroPesquisas } from "./tipos";
import { extrairCsvBrasil } from "./zip-brasil";

const REGISTRO = /^BR-\d{5}\/\d{4}$/;
const DATA = /^\d{4}-\d{2}-\d{2}$/;

/** Mesma classificação do cron, só as nacionais. É o JSON que a Action envia. */
export async function recorteNacionalDeZips(
	pesquisa: Uint8Array,
	contratante: Uint8Array,
): Promise<RegistroPesquisas[]> {
	const linhasPesquisa = parseCsvTse(await extrairCsvBrasil(pesquisa), {
		manter: linhaPesquisaNoCorte,
	});
	const protocolos = new Set(linhasPesquisa.map((linha) => linha.NR_PROTOCOLO_REGISTRO ?? ""));
	const linhasContratante = parseCsvTse(await extrairCsvBrasil(contratante), {
		manter: (linha) => protocolos.has(linha.NR_PROTOCOLO_REGISTRO ?? ""),
	});
	const { lidos } = registrosDoTse(linhasPesquisa, linhasContratante);
	return lidos.filter((registro) => registro.classificacao === "nacional");
}

export function lerRecorte(
	corpo: string,
): { registros: RegistroPesquisas[]; geradoEm: string | null } | { erro: string } {
	if (corpo.length === 0 || corpo.length > 1_000_000) return { erro: "tamanho" };
	let json: unknown;
	try {
		json = JSON.parse(corpo);
	} catch {
		return { erro: "json" };
	}
	if (!json || typeof json !== "object" || !Array.isArray((json as { registros?: unknown }).registros)) {
		return { erro: "forma" };
	}
	const bruto = json as { registros: unknown[]; geradoEm?: unknown };
	if (bruto.registros.length === 0) return { erro: "vazio" };
	const geradoEm = bruto.geradoEm == null ? null : bruto.geradoEm;
	if (geradoEm !== null && typeof geradoEm !== "string") return { erro: "geradoEm" };
	const registros: RegistroPesquisas[] = [];
	for (const item of bruto.registros) {
		const registro = registroNacional(item);
		if (!registro) return { erro: "registro" };
		registros.push(registro);
	}
	return { registros, geradoEm };
}

function registroNacional(valor: unknown): RegistroPesquisas | null {
	if (!valor || typeof valor !== "object") return null;
	const r = valor as Record<string, unknown>;
	if (typeof r.registro !== "string" || !REGISTRO.test(r.registro)) return null;
	if (r.classificacao !== "nacional") return null;
	if (typeof r.cnpj !== "string" || typeof r.instituto !== "string") return null;
	if (!Array.isArray(r.contratantes) || r.contratantes.some((c) => typeof c !== "string")) return null;
	for (const campo of ["campoInicio", "campoFim", "liberacao", "liberacaoEfetiva"] as const) {
		if (typeof r[campo] !== "string" || !DATA.test(r[campo])) return null;
	}
	if (typeof r.entrevistas !== "number" || !Number.isInteger(r.entrevistas) || r.entrevistas <= 0) {
		return null;
	}
	if (!(r.margem === null || typeof r.margem === "number")) return null;
	if (!(r.confianca === null || typeof r.confianca === "number")) return null;
	return {
		registro: r.registro,
		cnpj: r.cnpj,
		instituto: r.instituto,
		contratantes: [...r.contratantes],
		campoInicio: r.campoInicio as string,
		campoFim: r.campoFim as string,
		liberacao: r.liberacao as string,
		liberacaoEfetiva: r.liberacaoEfetiva as string,
		entrevistas: r.entrevistas,
		margem: r.margem,
		confianca: r.confianca,
		classificacao: "nacional",
		removidoDoTse: false,
	};
}
