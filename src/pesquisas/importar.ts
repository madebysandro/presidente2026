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

export function registroId(protocolo: string): string {
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

export function registrosDoTse(
	pesquisa: Record<string, string>[],
	contratantes: Record<string, string>[],
): RegistroPesquisas[] {
	const porProtocolo = new Map<string, Record<string, string>[]>();
	for (const linha of contratantes) {
		const protocolo = linha.NR_PROTOCOLO_REGISTRO ?? "";
		const lista = porProtocolo.get(protocolo) ?? [];
		lista.push(linha);
		porProtocolo.set(protocolo, lista);
	}

	const saida: RegistroPesquisas[] = [];
	for (const linha of pesquisa) {
		if (linha.DS_CARGO !== "Presidente") continue;
		const campoFim = dataIso(linha.DT_FIM_PESQUISA);
		if (!campoFim || campoFim < FIM_CAMPO_MINIMO) continue;
		saida.push(registroDeLinha(linha, porProtocolo.get(linha.NR_PROTOCOLO_REGISTRO ?? "") ?? []));
	}
	return saida;
}

export function montarAplicar(input: {
	anteriores: RegistroPesquisas[];
	lidos: RegistroPesquisas[];
	em: string;
	motivo: MotivoImport;
	origem: OrigemZip;
}): Extract<Changeset, { kind: "aplicar" }> {
	if (input.lidos.length === 0) {
		throw new Error("corte vazio");
	}
	const idsLidos = new Set(input.lidos.map((r) => r.registro));
	const remover = input.anteriores
		.filter((r) => !idsLidos.has(r.registro) && !r.removidoDoTse)
		.map((r) => r.registro)
		.sort();
	const contagens = contar(input.lidos);
	const auditoria: AuditoriaEntrada[] = [
		{
			em: input.em,
			tipo: "import",
			registro: null,
			detalhe: JSON.stringify({
				motivo: input.motivo,
				...contagens,
				removidos: remover,
			}),
		},
	];
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
	const entrevistas = Number(linha.QT_ENTREVISTADO);
	if (!Number.isInteger(entrevistas)) {
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
