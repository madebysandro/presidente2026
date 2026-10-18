import { http, HttpResponse } from "msw";
import { network } from "./rede";
import indiceJsonl from "../../fixtures/tse-provisorio/indice.jsonl?raw";

/**
 * Corpos JSON das fixtures, indexados pelo caminho relativo ao glob.
 * O Vite embute só o recorte versionado em fixtures/tse-provisorio/.
 */
const corposGlob = import.meta.glob(
	"../../fixtures/tse-provisorio/*/*.json",
	{ eager: true, import: "default" },
) as Record<string, object>;

type MetaArquivo = {
	ciclo: string;
	chave: string;
	url: string;
	etag: string;
	cacheControl: string;
	corpo: object;
};

type EntradaIndice = {
	ciclo: string;
	chave: string;
	url: string;
	etag: string;
	cacheControl: string;
};

const indice: EntradaIndice[] = indiceJsonl
	.split("\n")
	.filter((l) => l.trim())
	.map((l) => JSON.parse(l) as EntradaIndice);

/** Ciclos versionados, em ordem cronológica. */
export const CICLOS = [
	"2026-10-04T21-36-05-598Z",
	"2026-10-04T21-38-48-884Z",
	"2026-10-04T21-39-46-908Z",
	"2026-10-04T21-44-49-070Z",
	"2026-10-04T23-17-25-721Z",
	"2026-10-05T00-01-02-086Z",
] as const;

export type IdCiclo = (typeof CICLOS)[number];

function corpoDoCiclo(ciclo: string, arquivo: string): object | undefined {
	const sufixo = `/fixtures/tse-provisorio/${ciclo}/${arquivo}`;
	for (const [caminho, corpo] of Object.entries(corposGlob)) {
		if (caminho.endsWith(sufixo) || caminho.includes(`${ciclo}/${arquivo}`)) {
			return corpo;
		}
	}
	return undefined;
}

function arquivoDaChave(chave: string): string {
	return `${chave}.json`;
}

/** Catálogo: por ciclo, por chave → meta + corpo. */
function montarCatalogo(): Map<string, Map<string, MetaArquivo>> {
	const out = new Map<string, Map<string, MetaArquivo>>();
	for (const entrada of indice) {
		if (!(CICLOS as readonly string[]).includes(entrada.ciclo)) continue;
		const corpo = corpoDoCiclo(entrada.ciclo, arquivoDaChave(entrada.chave));
		if (!corpo) continue;
		let porChave = out.get(entrada.ciclo);
		if (!porChave) {
			porChave = new Map();
			out.set(entrada.ciclo, porChave);
		}
		porChave.set(entrada.chave, {
			ciclo: entrada.ciclo,
			chave: entrada.chave,
			url: entrada.url,
			etag: entrada.etag,
			cacheControl: entrada.cacheControl,
			corpo,
		});
	}
	return out;
}

const CATALOGO = montarCatalogo();

/**
 * Resolve o arquivo vigente até `ateCiclo` (inclusive), andando para trás
 * na `ordem` informada (padrão: todos os ciclos versionados).
 */
export function resolverArquivo(
	chave: string,
	ateCiclo: string,
	ordem: readonly string[] = CICLOS,
): MetaArquivo | null {
	const idx = ordem.indexOf(ateCiclo);
	if (idx < 0) return null;
	for (let i = idx; i >= 0; i--) {
		const ciclo = ordem[i]!;
		const meta = CATALOGO.get(ciclo)?.get(chave);
		if (meta) return meta;
	}
	return null;
}

/** Sequência de Presidente (leituras distintas para tendência). */
export const CICLOS_PRESIDENTE = [
	"2026-10-04T21-36-05-598Z",
	"2026-10-04T21-39-46-908Z",
	"2026-10-04T21-44-49-070Z",
] as const;

/** Meio e fim da noite (além do início). */
export const CICLOS_NOITE = [
	"2026-10-04T21-36-05-598Z",
	"2026-10-04T23-17-25-721Z",
	"2026-10-05T00-01-02-086Z",
] as const;

function metaObrigatoria(chave: string, ciclo: string): MetaArquivo {
	const meta = resolverArquivo(chave, ciclo);
	if (!meta) {
		throw new Error(`fixture ausente: ${chave} @ ${ciclo}`);
	}
	return meta;
}

export const SEQUENCIA_PRESIDENTE = CICLOS_PRESIDENTE.map((ciclo) => {
	const m = metaObrigatoria("presidente", ciclo);
	return {
		ciclo,
		etag: m.etag,
		cacheControl: m.cacheControl,
		corpo: m.corpo,
	};
});

export const URLS_TSE = {
	presidente:
		"https://resultados.tse.jus.br/oficial/ele2026/6258/dados/br/br-c0001-e006258-u.json",
} as const;

export type PedidoTse = {
	url: string;
	ifNoneMatch: string | null;
};

export type OpcoesTseFalso = {
	sequenciaNoite?: boolean;
};

/** Sobrescrita do % de seções totalizadas (e opcionalmente `tf`) nas fixtures. */
export type VarianteSecoes = {
	/** Percentual padrão (ex. 100 ou "100,00"). */
	padrao: number | string;
	/** Sobrescritas por chave (`presidente`, `pres-sp`, …). */
	porChave?: Record<string, number | string>;
	/** Indicador de totalização final do TSE (`s` / `n`). */
	tf?: "s" | "n";
};

export type TseFalso = {
	indice: number;
	pedidos: PedidoTse[];
	avancar: () => void;
	/** Próxima resposta do Presidente será 429 com este Retry-After (segundos). */
	simular429: (retryAfter: number) => void;
	/** Próxima resposta do Presidente será erro HTTP genérico. */
	simularErro: (status?: number) => void;
	/** Próxima resposta desta UF de Presidente falha (as demais seguem). */
	simularErroUf: (uf: string, status?: number) => void;
	/** Próxima resposta desta UF será 429 (interrompe o ciclo). */
	simular429Uf: (uf: string, retryAfter?: number) => void;
	/**
	 * Sobrescreve o Cache-Control do próximo 200/304 de todos os arquivos
	 * (útil para testar max(30 s, max-age) com valor controlado).
	 */
	definirCacheControl: (cacheControl: string) => void;
	/**
	 * Deriva variantes a 100% (ou quase) a partir das fixtures reais:
	 * ajusta `s.pst` / `s.pstn` e, se informado, `tf`.
	 */
	definirVarianteSecoes: (variante: VarianteSecoes | null) => void;
	urlPresidente: string;
	/** Próxima URL que contém este trecho responde com erro HTTP. */
	simularErroUrl: (trecho: string, status?: number) => void;
	/** Ciclo vigente para UFs / sequência da noite. */
	cicloAtual: () => string;
	/** Substitui o Presidente `br` por corpos sintéticos; `avancar` anda na lista. */
	usarNoiteSintetica: (corpos: object[]) => void;
};

function formatarPctTse(valor: number | string): { pst: string; pstn: string } {
	if (typeof valor === "string") {
		const n = Number(valor.replace(",", ".")) || 0;
		return { pst: valor.includes(",") ? valor : valor.replace(".", ","), pstn: String(n) };
	}
	const pst =
		Number.isInteger(valor)
			? `${valor},00`
			: String(valor).replace(".", ",");
	return { pst, pstn: String(valor) };
}

/** Clona o JSON do TSE e força o percentual de seções totalizadas. */
export function comPctSecoes(
	corpo: object,
	pct: number | string,
	tf?: "s" | "n",
): object {
	const clone = structuredClone(corpo) as {
		tf?: string;
		s?: Record<string, string>;
	};
	const { pst, pstn } = formatarPctTse(pct);
	clone.s = { ...(clone.s ?? {}), pst, pstn };
	if (tf) clone.tf = tf;
	return clone;
}

type ModoEspecial =
	| { tipo: "429"; retryAfter: number }
	| { tipo: "erro"; status: number }
	| null;

/** Instala o handler MSW que serve a sequência atual do TSE falso. */
export function instalarTseFalso(opcoes: OpcoesTseFalso = {}): TseFalso {
	const estado = {
		indice: 0,
		pedidos: [] as PedidoTse[],
		modo: null as ModoEspecial,
		cacheControlOverride: null as string | null,
		varianteSecoes: null as VarianteSecoes | null,
		erroUf: null as {
			uf: string;
			status: number;
			retryAfter?: number;
		} | null,
		corposSinteticos: null as object[] | null,
		erroUrl: null as { trecho: string; status: number } | null,
	};
	const sequenciaNoite = opcoes.sequenciaNoite ?? false;

	const ordemAtiva = (): readonly string[] =>
		sequenciaNoite ? CICLOS_NOITE : CICLOS;

	const cicloPresidente = () => {
		if (sequenciaNoite) {
			return (
				CICLOS_NOITE[estado.indice] ?? CICLOS_NOITE.at(-1)!
			);
		}
		return (
			CICLOS_PRESIDENTE[estado.indice] ?? CICLOS_PRESIDENTE.at(-1)!
		);
	};

	const resolver = (chave: string) =>
		resolverArquivo(chave, cicloPresidente(), ordemAtiva());

	const presidenteAtual = () => {
		if (estado.corposSinteticos) {
			const i = Math.min(
				estado.indice,
				estado.corposSinteticos.length - 1,
			);
			return {
				etag: `"sint-${i}"`,
				cacheControl: "max-age=10",
				corpo: estado.corposSinteticos[i]!,
			};
		}
		if (sequenciaNoite) {
			const m = resolver("presidente");
			if (!m) throw new Error("presidente ausente na sequência da noite");
			return {
				etag: m.etag,
				cacheControl: m.cacheControl,
				corpo: m.corpo,
			};
		}
		return (
			SEQUENCIA_PRESIDENTE[estado.indice] ??
			SEQUENCIA_PRESIDENTE.at(-1)!
		);
	};

	const pctDaChave = (chave: string): number | string => {
		const v = estado.varianteSecoes;
		if (!v) return "";
		return v.porChave?.[chave] ?? v.padrao;
	};

	/** ETag estável por (chave, pct, tf) para o poller poder receber 304 entre ciclos. */
	const etagDaResposta = (etagBase: string, chave: string): string => {
		const v = estado.varianteSecoes;
		if (!v) return etagBase;
		const pct = String(pctDaChave(chave));
		const tf = v.tf ?? "";
		const base = etagBase.replaceAll('"', "");
		return `"v-${pct}-${tf}-${base}"`;
	};

	const aplicarVariante = (chave: string, corpo: object): object => {
		const v = estado.varianteSecoes;
		if (!v) return corpo;
		return comPctSecoes(corpo, pctDaChave(chave), v.tf);
	};

	const responderArquivo = (
		url: string,
		ifNoneMatch: string | null,
		atual: { etag: string; cacheControl: string; corpo: object },
		chave: string,
	) => {
		estado.pedidos.push({ url, ifNoneMatch });
		const cacheControl = estado.cacheControlOverride ?? atual.cacheControl;
		const etag = etagDaResposta(atual.etag, chave);
		if (ifNoneMatch && ifNoneMatch === etag) {
			return new HttpResponse(null, {
				status: 304,
				headers: {
					etag,
					"cache-control": cacheControl,
				},
			});
		}
		return HttpResponse.json(aplicarVariante(chave, atual.corpo), {
			headers: {
				etag,
				"cache-control": cacheControl,
			},
		});
	};

	network.use(
		http.get(URLS_TSE.presidente, ({ request }) => {
			const ifNoneMatch = request.headers.get("if-none-match");
			if (estado.modo?.tipo === "429") {
				const retryAfter = estado.modo.retryAfter;
				estado.modo = null;
				estado.pedidos.push({ url: request.url, ifNoneMatch });
				return new HttpResponse("calma", {
					status: 429,
					headers: { "retry-after": String(retryAfter) },
				});
			}
			if (estado.modo?.tipo === "erro") {
				const status = estado.modo.status;
				estado.modo = null;
				estado.pedidos.push({ url: request.url, ifNoneMatch });
				return new HttpResponse("falha", { status });
			}
			return responderArquivo(
				request.url,
				ifNoneMatch,
				presidenteAtual(),
				"presidente",
			);
		}),
		http.get(
			/https:\/\/resultados\.tse\.jus\.br\/oficial\/ele2026\/6258\/dados\/([a-z]{2})\/\1(\d+)-c0001-e006258-u\.json/,
			({ request, params }) => {
				const uf = String(params[0] ?? "");
				const cd = String(params[1] ?? "");
				const ifNoneMatch = request.headers.get("if-none-match");
				if (
					estado.erroUrl &&
					request.url.includes(estado.erroUrl.trecho)
				) {
					const status = estado.erroUrl.status;
					estado.erroUrl = null;
					estado.pedidos.push({ url: request.url, ifNoneMatch });
					return new HttpResponse("falha município", { status });
				}
				const meta = resolver(`pres-${uf}`);
				if (!meta) {
					estado.pedidos.push({ url: request.url, ifNoneMatch });
					return new HttpResponse("município sem UF", { status: 404 });
				}
				return responderArquivo(
					request.url,
					ifNoneMatch,
					{
						etag: `"mu-${cd}-${meta.etag.replaceAll('"', "")}"`,
						cacheControl: meta.cacheControl,
						corpo: meta.corpo,
					},
					`pres-${uf}`,
				);
			},
		),
		// Presidente por UF / exterior: …/dados/{uf}/{uf}-c0001-e006258-u.json
		http.get(
			/https:\/\/resultados\.tse\.jus\.br\/oficial\/ele2026\/6258\/dados\/([a-z]{2})\/\1-c0001-e006258-u\.json/,
			({ request, params }) => {
				const uf = String(params[0] ?? "");
				const ifNoneMatch = request.headers.get("if-none-match");
				if (estado.erroUf && estado.erroUf.uf === uf) {
					const { status, retryAfter } = estado.erroUf;
					estado.erroUf = null;
					estado.pedidos.push({ url: request.url, ifNoneMatch });
					if (status === 429) {
						return new HttpResponse("calma", {
							status: 429,
							headers: {
								"retry-after": String(retryAfter ?? 120),
							},
						});
					}
					return new HttpResponse("falha uf", { status });
				}
				const meta = resolver(`pres-${uf}`);
				if (!meta) {
					estado.pedidos.push({ url: request.url, ifNoneMatch });
					return new HttpResponse("uf desconhecida", { status: 404 });
				}
				return responderArquivo(
					request.url,
					ifNoneMatch,
					{
						etag: meta.etag,
						cacheControl: meta.cacheControl,
						corpo: meta.corpo,
					},
					`pres-${uf}`,
				);
			},
		),
	);

	return {
		get indice() {
			return estado.indice;
		},
		get pedidos() {
			return estado.pedidos;
		},
		avancar() {
			estado.indice += 1;
		},
		simular429(retryAfter: number) {
			estado.modo = { tipo: "429", retryAfter };
		},
		simularErro(status = 503) {
			estado.modo = { tipo: "erro", status };
		},
		simularErroUf(uf: string, status = 503) {
			estado.erroUf = { uf, status };
		},
		simular429Uf(uf: string, retryAfter = 90) {
			estado.erroUf = { uf, status: 429, retryAfter };
		},
		definirCacheControl(cacheControl: string) {
			estado.cacheControlOverride = cacheControl;
		},
		definirVarianteSecoes(variante: VarianteSecoes | null) {
			estado.varianteSecoes = variante;
		},
		urlPresidente: URLS_TSE.presidente,
		simularErroUrl(trecho: string, status = 404) {
			estado.erroUrl = { trecho, status };
		},
		cicloAtual: () => cicloPresidente(),
		usarNoiteSintetica(corpos: object[]) {
			estado.corposSinteticos = corpos;
			estado.indice = 0;
		},
	};
}
