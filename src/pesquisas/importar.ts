import { classificarCampos } from "./classificar";
import { FIM_CAMPO_MINIMO } from "./fontes";
import { liberacaoEfetiva } from "./liberacao";
import { extrairMargemConfianca } from "./margem";
import { nomeContratante, nomeInstituto } from "./nomes";
import type {
	AuditoriaEntrada,
	Changeset,
	ContagensImport,
	MotivoImport,
	OrigemZip,
	RegistroPesquisas,
} from "./tipos";

const PROTOCOLO = /^BR(\d{5})(\d{4})$/;

function registroId(protocolo: string): string {
	const m = PROTOCOLO.exec(protocolo.trim());
	if (!m) throw new Error(`protocolo inválido: ${protocolo}`);
	return `BR-${m[1]}/${m[2]}`;
}

export function geradoEmBrasiliaDoCsv(
	linhas: Record<string, string>[],
): string | null {
	const data = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(linhas[0]?.DT_GERACAO ?? "");
	const hora = /^(\d{2}):(\d{2}):(\d{2})$/.exec(linhas[0]?.HH_GERACAO ?? "");
	if (!data || !hora) return null;
	return `${data[3]}-${data[2]}-${data[1]}T${hora[1]}:${hora[2]}:${hora[3]}-03:00`;
}

/** Presidente com fim de campo no recorte do 2º turno (filtro na parse do ZIP). */
export function linhaPesquisaNoCorte(linha: Record<string, string>): boolean {
	if (linha.DS_CARGO !== "Presidente") return false;
	const campoFim = dataIso(linha.DT_FIM_PESQUISA);
	return Boolean(campoFim && campoFim >= FIM_CAMPO_MINIMO);
}

export type RejeicaoLinha = {
	protocolo: string;
	detalhe: string;
};

export function registrosDoTse(
	pesquisa: Record<string, string>[],
	contratantes: Record<string, string>[],
): { lidos: RegistroPesquisas[]; rejeicoes: RejeicaoLinha[] } {
	const porProtocolo = new Map<string, Record<string, string>[]>();
	for (const linha of contratantes) {
		const protocolo = linha.NR_PROTOCOLO_REGISTRO ?? "";
		const lista = porProtocolo.get(protocolo) ?? [];
		lista.push(linha);
		porProtocolo.set(protocolo, lista);
	}

	const lidos: RegistroPesquisas[] = [];
	const rejeicoes: RejeicaoLinha[] = [];
	for (const linha of pesquisa) {
		if (!linhaPesquisaNoCorte(linha)) continue;
		const protocolo = linha.NR_PROTOCOLO_REGISTRO ?? "";
		try {
			lidos.push(registroDeLinha(linha, porProtocolo.get(protocolo) ?? []));
		} catch (erro) {
			rejeicoes.push({
				protocolo,
				detalhe: erro instanceof Error ? erro.message : String(erro),
			});
		}
	}
	return { lidos, rejeicoes };
}

export function montarAplicar(input: {
	anteriores: RegistroPesquisas[];
	lidos: RegistroPesquisas[];
	rejeicoes?: RejeicaoLinha[];
	em: string;
	motivo: MotivoImport;
	origem: OrigemZip;
	/** `nacional` não apaga estadual nem ambígua que ficaram de fora do JSON. */
	escopo?: "corte" | "nacional";
}): Extract<Changeset, { kind: "aplicar" }> {
	if (input.lidos.length === 0) {
		throw new Error("corte vazio");
	}
	const idsLidos = new Set(input.lidos.map((r) => r.registro));
	const rejeicoes = input.rejeicoes ?? [];
	// Linha no CSV que falhou o parse não "sumiu": fica no ledger + auditoria rejeitado.
	const idsRejeitados = new Set<string>();
	for (const rejeicao of rejeicoes) {
		try {
			idsRejeitados.add(registroId(rejeicao.protocolo));
		} catch {
			/* protocolo ilegível — não amarra a um registro do ledger */
		}
	}
	const escopo = input.escopo ?? "corte";
	if (escopo === "nacional" && input.lidos.some((r) => r.classificacao !== "nacional")) {
		throw new Error("plano B só aceita nacional");
	}
	const remover = input.anteriores
		.filter(
			(r) =>
				!idsLidos.has(r.registro) &&
				!idsRejeitados.has(r.registro) &&
				!r.removidoDoTse &&
				(escopo === "corte" || r.classificacao === "nacional"),
		)
		.map((r) => r.registro)
		.sort();
	const contagens =
		escopo === "nacional" ? contar(vivosDepois(input.anteriores, remover, input.lidos)) : contar(input.lidos);
	const auditoria: AuditoriaEntrada[] = [
		{
			em: input.em,
			tipo: "import",
			registro: null,
			detalhe: JSON.stringify({
				motivo: input.motivo,
				...contagens,
				removidos: remover,
				rejeitados: [...idsRejeitados].sort(),
			}),
		},
	];
	for (const rejeicao of rejeicoes) {
		let registro: string | null = null;
		try {
			registro = registroId(rejeicao.protocolo);
		} catch {
			registro = rejeicao.protocolo || null;
		}
		auditoria.push({
			em: input.em,
			tipo: "rejeitado",
			registro,
			detalhe: rejeicao.detalhe,
		});
	}
	for (const registro of remover) {
		auditoria.push({
			em: input.em,
			tipo: "removido",
			registro,
			detalhe: "sumiu do CSV",
		});
	}
	for (const registro of input.lidos) {
		if (registro.classificacao === "ambigua") {
			auditoria.push({
				em: input.em,
				tipo: "ambigua",
				registro: registro.registro,
				detalhe: "fora do site",
			});
		}
	}
	return {
		kind: "aplicar",
		meta: {
			...input.origem,
			ultimoImportEm: input.em,
			contagens,
		},
		upserts: input.lidos.map((r) => ({ ...r, removidoDoTse: false })),
		remover,
		auditoria,
	};
}

function vivosDepois(
	anteriores: RegistroPesquisas[],
	remover: string[],
	lidos: RegistroPesquisas[],
): RegistroPesquisas[] {
	const fora = new Set(remover);
	const ids = new Set(lidos.map((r) => r.registro));
	const ficam = anteriores.filter(
		(r) => !r.removidoDoTse && !fora.has(r.registro) && !ids.has(r.registro),
	);
	return [...ficam, ...lidos];
}

function contar(lidos: RegistroPesquisas[]): ContagensImport {
	const contagens: ContagensImport = { nacional: 0, estadual: 0, ambigua: 0 };
	for (const registro of lidos) contagens[registro.classificacao]++;
	return contagens;
}

function registroDeLinha(
	linha: Record<string, string>,
	contratantes: Record<string, string>[],
): RegistroPesquisas {
	const protocolo = linha.NR_PROTOCOLO_REGISTRO ?? "";
	const registro = registroId(protocolo);
	const campoInicio = exigirData(linha.DT_INICIO_PESQUISA, "início", protocolo);
	const campoFim = exigirData(linha.DT_FIM_PESQUISA, "fim", protocolo);
	const liberacao = exigirData(linha.DT_DIVULGACAO, "divulgação", protocolo);
	const brutoEntrevistas = (linha.QT_ENTREVISTADO ?? "").trim();
	const entrevistas = Number(brutoEntrevistas);
	if (
		brutoEntrevistas === "" ||
		!Number.isInteger(entrevistas) ||
		entrevistas <= 0
	) {
		throw new Error(`${protocolo}: entrevistas inválidas`);
	}
	const { margem, confianca } = extrairMargemConfianca({
		plano: linha.DS_PLANO_AMOSTRAL ?? "",
		metodologia: linha.DS_METODOLOGIA_PESQUISA ?? "",
		municipio: linha.DS_DADO_MUNICIPIO ?? "",
		controle: linha.DS_SISTEMA_CONTROLE ?? "",
	});
	const cnpj = linha.NR_CNPJ_EMPRESA ?? "";
	return {
		registro,
		cnpj,
		instituto: nomeInstituto(linha.NM_EMPRESA ?? "", linha.NM_EMPRESA_FANTASIA ?? ""),
		contratantes: contratantes
			.map((c) =>
				nomeContratante(
					c.NM_CONTRATANTE ?? "",
					c.NR_CPF_CNPJ_CONTRATANTE ?? "",
					cnpj,
				),
			)
			.sort((a, b) => a.localeCompare(b, "pt-BR")),
		campoInicio,
		campoFim,
		liberacao,
		liberacaoEfetiva: liberacaoEfetiva(liberacao, campoFim),
		entrevistas,
		margem,
		confianca,
		classificacao: classificarCampos(
			linha.DS_DADO_MUNICIPIO ?? "",
			linha.DS_PLANO_AMOSTRAL ?? "",
			linha.DS_METODOLOGIA_PESQUISA ?? "",
		),
		removidoDoTse: false,
	};
}

function dataIso(bruto: string | undefined): string | null {
	const m = /^(\d{4}-\d{2}-\d{2})/.exec((bruto ?? "").trim());
	return m ? m[1]! : null;
}

function exigirData(bruto: string | undefined, campo: string, protocolo: string): string {
	const data = dataIso(bruto);
	if (!data) throw new Error(`${protocolo}: ${campo} inválido`);
	return data;
}
