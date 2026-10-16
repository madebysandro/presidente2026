import { dataBrasilia } from "./liberacao";
import { dominioFonteAceito } from "./dominios-fonte";
import { validosDiferem } from "./validos";

export const CODIGOS_RECUSA = [
	"registro_desconhecido",
	"registro_nao_nacional",
	"antes_da_liberacao",
	"suspensa",
	"ja_publicado",
	"numeros_invalidos",
	"soma_fora",
	"validos_incoerentes",
	"falta_margem_confianca",
	"fonte_invalida",
	"fonte_inacessivel",
	"fonte_nao_confirma",
] as const;

export type CodigoRecusa = (typeof CODIGOS_RECUSA)[number];

export type MotivoRecusa = { codigo: CodigoRecusa; detalhe: string };

export type TotaisEnvio = {
	flavio: number;
	lula: number;
	brancoNulo: number | null;
	naoSabe: number | null;
	brancoNuloNaoSabe: number | null;
};

export type EnvioResultado = {
	registro: string;
	totais: TotaisEnvio;
	validosPublicados: { flavio: number; lula: number } | null;
	fonte: string;
	margem: number | null;
	confianca: number | null;
	substituir: boolean;
};

export type RegistroParaResultado = {
	classificacao: "nacional" | "estadual" | "ambigua";
	removidoDoTse: boolean;
	liberacaoEfetiva: string;
	campoFim: string;
	margem: number | null;
	confianca: number | null;
	instituto: string;
	suspensa: boolean;
	jaPublicado: boolean;
};

const LIMITE_URNAS = new Date("2026-10-25T17:00:00-03:00");

export function lerEnvio(bruto: unknown): {
	registro: string | null;
	envio: EnvioResultado | null;
	motivos: MotivoRecusa[];
} {
	const motivos: MotivoRecusa[] = [];
	if (!ehObj(bruto)) {
		return { registro: null, envio: null, motivos: [numeros("corpo inválido")] };
	}
	const registro = typeof bruto.registro === "string" ? bruto.registro.trim() : "";
	if (!registro) motivos.push(numeros("registro ausente"));
	const totais = lerTotais(bruto.totais, motivos);
	const validosPublicados = lerValidos(bruto.validosPublicados, motivos);
	const fonte = typeof bruto.fonte === "string" ? bruto.fonte.trim() : "";
	if (typeof bruto.fonte !== "string") motivos.push(fonteInvalida("fonte ausente"));
	const margem = lerOpcional(bruto.margem, "margem", motivos);
	const confianca = lerOpcional(bruto.confianca, "confiança", motivos);
	if (!registro || !totais || typeof bruto.fonte !== "string") {
		return { registro: registro || null, envio: null, motivos };
	}
	return {
		registro,
		envio: {
			registro,
			totais,
			validosPublicados,
			fonte,
			margem,
			confianca,
			substituir: bruto.substituir === true,
		},
		motivos,
	};
}

export function motivosDoRegistro(
	envio: EnvioResultado,
	registro: RegistroParaResultado | null,
	agora: Date,
): MotivoRecusa[] {
	const motivos: MotivoRecusa[] = [];
	if (!registro || registro.removidoDoTse) {
		motivos.push({
			codigo: "registro_desconhecido",
			detalhe: "registro não está no último import",
		});
	} else {
		if (registro.classificacao !== "nacional") {
			motivos.push({
				codigo: "registro_nao_nacional",
				detalhe: "registro não é nacional",
			});
		}
		if (antesDaLiberacao(registro, agora)) {
			motivos.push({
				codigo: "antes_da_liberacao",
				detalhe: "ainda não chegou a liberação efetiva",
			});
		}
		if (registro.suspensa) {
			motivos.push({ codigo: "suspensa", detalhe: "registro suspenso" });
		}
		if (registro.jaPublicado && !envio.substituir) {
			motivos.push({
				codigo: "ja_publicado",
				detalhe: "já existe resultado e substituir não é true",
			});
		}
		if (registro.margem == null || registro.confianca == null) {
			if (!faixaMargem(envio.margem) || !faixaConfianca(envio.confianca)) {
				motivos.push({
					codigo: "falta_margem_confianca",
					detalhe: "registro sem margem ou confiança e o envio não traz os dois na faixa",
				});
			}
		}
	}
	const soma = somaTotais(envio.totais);
	const somaComparavel = soma == null ? null : Math.round(soma * 100) / 100;
	if (somaComparavel == null) {
		motivos.push(numeros("números ausentes ou fora de 0 a 100"));
	} else if (somaComparavel < 97 || somaComparavel > 103) {
		motivos.push({
			codigo: "soma_fora",
			detalhe: "soma dos totais fora de 97 a 103",
		});
	}
	if (envio.validosPublicados && somaComparavel != null) {
		if (
			validosDiferem(envio.totais.flavio, envio.totais.lula, envio.validosPublicados)
		) {
			motivos.push({
				codigo: "validos_incoerentes",
				detalhe: "válidos publicados diferem do cálculo em mais de 1 ponto",
			});
		}
	}
	if (!urlFonteValida(envio.fonte)) {
		motivos.push(fonteInvalida("fonte não é https de domínio aceito"));
	}
	return motivos;
}

export function antesDaLiberacao(
	registro: { liberacaoEfetiva: string; campoFim: string },
	agora: Date,
): boolean {
	if (dataBrasilia(agora) < registro.liberacaoEfetiva) return true;
	return registro.campoFim === "2026-10-25" && agora.getTime() < LIMITE_URNAS.getTime();
}

export function urlFonteValida(fonte: string): boolean {
	let url: URL;
	try {
		url = new URL(fonte);
	} catch {
		return false;
	}
	if (url.protocol !== "https:") return false;
	if (url.username || url.password) return false;
	return dominioFonteAceito(url.hostname);
}

export function somaTotais(totais: TotaisEnvio): number | null {
	if (!naFaixa(totais.flavio) || !naFaixa(totais.lula)) return null;
	if (totais.brancoNuloNaoSabe != null) {
		if (!naFaixa(totais.brancoNuloNaoSabe)) return null;
		if (totais.brancoNulo != null || totais.naoSabe != null) return null;
		return totais.flavio + totais.lula + totais.brancoNuloNaoSabe;
	}
	if (totais.brancoNulo == null || totais.naoSabe == null) return null;
	if (!naFaixa(totais.brancoNulo) || !naFaixa(totais.naoSabe)) return null;
	return totais.flavio + totais.lula + totais.brancoNulo + totais.naoSabe;
}

function faixaMargem(n: number | null): boolean {
	return n != null && n >= 0.3 && n <= 10;
}

function faixaConfianca(n: number | null): boolean {
	return n != null && n >= 80 && n <= 99.9;
}

function naFaixa(n: number): boolean {
	return Number.isFinite(n) && n >= 0 && n <= 100;
}

function lerTotais(bruto: unknown, motivos: MotivoRecusa[]): TotaisEnvio | null {
	if (!ehObj(bruto)) {
		motivos.push(numeros("totais ausentes"));
		return null;
	}
	const flavio = numeroCampo(bruto.flavio);
	const lula = numeroCampo(bruto.lula);
	if (flavio == null || lula == null) {
		motivos.push(numeros("Flávio ou Lula ausente ou não numérico"));
		return null;
	}
	const junto = bruto.brancoNuloNaoSabe;
	const separado = bruto.brancoNulo != null || bruto.naoSabe != null;
	if (junto != null && junto !== null) {
		const brancoNuloNaoSabe = numeroCampo(junto);
		if (brancoNuloNaoSabe == null) {
			motivos.push(numeros("brancos, nulos e não sabem não numérico"));
			return null;
		}
		if (separado) {
			motivos.push(numeros("não misture brancoNuloNaoSabe com branco e nulo separados"));
			return null;
		}
		return { flavio, lula, brancoNulo: null, naoSabe: null, brancoNuloNaoSabe };
	}
	const brancoNulo = numeroCampo(bruto.brancoNulo);
	const naoSabe = numeroCampo(bruto.naoSabe);
	if (brancoNulo == null || naoSabe == null) {
		motivos.push(numeros("brancos/nulos e não sabem ausentes"));
		return null;
	}
	return { flavio, lula, brancoNulo, naoSabe, brancoNuloNaoSabe: null };
}

function lerValidos(
	bruto: unknown,
	motivos: MotivoRecusa[],
): { flavio: number; lula: number } | null {
	if (bruto == null) return null;
	if (!ehObj(bruto)) {
		motivos.push(numeros("válidos publicados inválidos"));
		return null;
	}
	const flavio = numeroCampo(bruto.flavio);
	const lula = numeroCampo(bruto.lula);
	if (flavio == null || lula == null) {
		motivos.push(numeros("válidos publicados sem Flávio ou Lula"));
		return null;
	}
	return { flavio, lula };
}

function lerOpcional(bruto: unknown, nome: string, motivos: MotivoRecusa[]): number | null {
	if (bruto == null) return null;
	const n = numeroCampo(bruto);
	if (n == null) {
		motivos.push(numeros(`${nome} não numérica`));
		return null;
	}
	return n;
}

function numeroCampo(v: unknown): number | null {
	if (typeof v !== "number" || !Number.isFinite(v)) return null;
	return v;
}

function ehObj(v: unknown): v is Record<string, unknown> {
	return typeof v === "object" && v !== null && !Array.isArray(v);
}

function numeros(detalhe: string): MotivoRecusa {
	return { codigo: "numeros_invalidos", detalhe };
}

function fonteInvalida(detalhe: string): MotivoRecusa {
	return { codigo: "fonte_invalida", detalhe };
}
