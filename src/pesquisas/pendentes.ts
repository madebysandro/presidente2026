import { antesDaLiberacao } from "./validar-resultado";
import type { RegistroPesquisas, ResultadoGuardado } from "./tipos";

const SETE_DIAS_MS = 7 * 24 * 60 * 60 * 1000;

export type PendenteAgente = {
	registro: string;
	instituto: string;
	contratantes: string[];
	campo: { inicio: string; fim: string };
	liberacaoEfetiva: string;
	entrevistas: number;
	faltaMargem: boolean;
	faltaConfianca: boolean;
	/** Publicado há mais de 7 dias: conferência, não cadastro novo. */
	jaPublicado: boolean;
};

/** Liberadas sem número, mais as publicadas há mais de 7 dias. */
export function selecionarPendentes(
	registros: readonly RegistroPesquisas[],
	resultados: readonly ResultadoGuardado[],
	suspensos: ReadonlySet<string>,
	agora: Date,
): PendenteAgente[] {
	const porRegistro = new Map(resultados.map((resultado) => [resultado.registro, resultado]));
	const saida: PendenteAgente[] = [];
	for (const registro of registros) {
		if (registro.classificacao !== "nacional" || registro.removidoDoTse) continue;
		if (suspensos.has(registro.registro)) continue;
		if (antesDaLiberacao(registro, agora)) continue;
		const resultado = porRegistro.get(registro.registro);
		if (resultado && !publicadaHaMaisDeSeteDias(resultado.cadastradoEm, agora)) continue;
		saida.push({
			registro: registro.registro,
			instituto: registro.instituto,
			contratantes: registro.contratantes,
			campo: { inicio: registro.campoInicio, fim: registro.campoFim },
			liberacaoEfetiva: registro.liberacaoEfetiva,
			entrevistas: registro.entrevistas,
			faltaMargem: registro.margem == null,
			faltaConfianca: registro.confianca == null,
			jaPublicado: resultado != null,
		});
	}
	saida.sort(
		(a, b) =>
			a.liberacaoEfetiva.localeCompare(b.liberacaoEfetiva) ||
			a.registro.localeCompare(b.registro),
	);
	return saida;
}

function publicadaHaMaisDeSeteDias(cadastradoEm: string, agora: Date): boolean {
	const em = new Date(cadastradoEm).getTime();
	return Number.isFinite(em) && agora.getTime() - em > SETE_DIAS_MS;
}
