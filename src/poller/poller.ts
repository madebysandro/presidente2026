import { DurableObject } from "cloudflare:workers";
import {
	configTseDeEnv,
	metasCargos,
	urlArquivoCargo,
	type ConfigTse,
} from "../config/tse";
import type { DadosBrutosCargo } from "../dominio/cargos/dados-brutos";
import { normalizarMajoritario } from "../dominio/cargos/majoritario";
import { analisarMajoritarias } from "../dominio/majoritarias/analise";
import type {
	Cargo,
	EstadoApuracao,
	Leitura,
	MetaCargo,
} from "../dominio/tipos";
import { buscarArquivoTse, ErroTse } from "./cliente-tse";
import { escoposProntosParaEncerrar } from "./encerrada";
import { montarLeitura } from "./historico";

const CHAVE_ESTADO = "estado";
const CHAVE_ETAGS = "etags";
const CHAVE_HISTORICO = "historico";
const CHAVE_BACKOFF = "backoffSegundos";
/** Índice do próximo degrau da escada de estabilidade (#24); separado do backoff de erro. */
const CHAVE_ESCADA = "escadaEstavel";
/** Sem mudança: 60 → 120 → 300 → 600 → 1800 → 3600 (teto 60 min). */
const ESCADA_ESTAVEL = [60, 120, 300, 600, 1800, 3600] as const;

/** #7: ciclo mínimo só Presidente br; 27 UFs + exterior voltam na Fase 2. */
const SIGLAS_UF_CICLO: readonly string[] = [];

type Etags = Record<string, string>;

function estadoVazio(): EstadoApuracao {
	return {
		versao: 0,
		consultadoEm: null,
		proximaConsulta: null,
		erro: null,
		cargos: {},
		ufs: {},
		analise: { majoritarias: {}, proporcionais: {}, destaques: [] },
	};
}

function cargoMudou(antes: Cargo | undefined, novo: Cargo): boolean {
	if (!antes) return true;
	if (antes.apurado !== novo.apurado) return true;
	return antes.candidatos.some(
		(c, i) => c.votos !== novo.candidatos[i]?.votos,
	);
}

function normalizarCargo(
	meta: MetaCargo,
	json: DadosBrutosCargo,
	cfg: ConfigTse,
): Cargo | null {
	if (meta.id === "presidente") {
		return normalizarMajoritario(meta, json, cfg);
	}
	return null;
}

/**
 * Durable Object por eleição (`ele-6258`): único poller do TSE para o 2º turno.
 * Intervalo via alarme (respeita max-age / Retry-After), não Cron Trigger.
 */
export class PollerApuracao extends DurableObject<Env> {
	private cfg(): ConfigTse {
		return configTseDeEnv(this.env);
	}

	private async lerEstado(): Promise<EstadoApuracao> {
		return (
			(await this.ctx.storage.get<EstadoApuracao>(CHAVE_ESTADO)) ??
			estadoVazio()
		);
	}

	async obterEstado(): Promise<EstadoApuracao> {
		await this.garantirAlarme();
		return this.lerEstado();
	}

	/** Leituras posteriores a `desde` (para tendência quando a fase ao vivo entrar). */
	async obterHistorico(desde = 0): Promise<Leitura[]> {
		const historico =
			(await this.ctx.storage.get<Leitura[]>(CHAVE_HISTORICO)) ?? [];
		return historico.filter((p) => p.t > desde);
	}

	/** Força um ciclo de consulta (usado nos testes e no primeiro aquecimento). */
	async consultarAgora(): Promise<EstadoApuracao> {
		await this.consultar();
		return this.lerEstado();
	}

	async alarm(): Promise<void> {
		await this.consultar();
	}

	private async garantirAlarme(): Promise<void> {
		const estado = await this.lerEstado();
		if (estado.encerrada) return;

		const alarme = await this.ctx.storage.getAlarm();
		if (alarme != null) return;

		if (estado.consultadoEm == null) {
			await this.consultar();
			return;
		}
		await this.ctx.storage.setAlarm(Date.now() + 30_000);
	}

	private async consultar(): Promise<void> {
		const cfg = this.cfg();
		const estado = await this.lerEstado();
		if (estado.encerrada) return;

		const etags =
			(await this.ctx.storage.get<Etags>(CHAVE_ETAGS)) ?? {};
		const backoffAnterior =
			(await this.ctx.storage.get<number>(CHAVE_BACKOFF)) ?? null;

		let maxAgeCiclo = 0;
		let novoBackoff: number | null = null;
		let mudou = false;
		let cicloCompleto = true;
		const tfPorEscopo: Record<string, string | undefined> = {
			...(estado.tfPorEscopo ?? {}),
		};

		const guardarTfEscopo = (chave: string, bruto: DadosBrutosCargo) => {
			tfPorEscopo[chave] =
				bruto.tf == null || bruto.tf === ""
					? undefined
					: String(bruto.tf);
		};

		try {
			const metas = metasCargos(cfg);
			for (const meta of metas) {
				const url = urlArquivoCargo(cfg, meta);
				const { maxAge, json, etag } = await buscarArquivoTse(
					url,
					etags[meta.id],
				);
				maxAgeCiclo = Math.max(maxAgeCiclo, maxAge);
				if (etag) etags[meta.id] = etag;
				if (!json) {
					if (!estado.cargos[meta.id]) cicloCompleto = false;
					continue;
				}
				const bruto = json as DadosBrutosCargo;
				guardarTfEscopo(meta.id, bruto);

				const novo = normalizarCargo(meta, bruto, cfg);
				if (!novo) {
					cicloCompleto = false;
					continue;
				}

				if (cargoMudou(estado.cargos[meta.id], novo)) mudou = true;
				estado.cargos[meta.id] = novo;
			}

			estado.tfPorEscopo = tfPorEscopo;

			if (mudou) {
				estado.versao += 1;
				await this.registrarLeitura(estado);
			}

			const historico =
				(await this.ctx.storage.get<Leitura[]>(CHAVE_HISTORICO)) ?? [];
			estado.analise = {
				majoritarias: analisarMajoritarias(estado.cargos, historico),
				proporcionais: {},
				destaques: [],
			};
			estado.erro = null;
			novoBackoff = null;

			const idsCargos = metas.map((m) => m.id);
			// #7: lista de UFs ainda vazia — não gravar encerrada no mesmo
			// ele-6258, senão a Fase 2 (UFs) acha o DO já morto.
			estado.encerrada =
				SIGLAS_UF_CICLO.length > 0 &&
				cicloCompleto &&
				escoposProntosParaEncerrar(
					estado,
					idsCargos,
					SIGLAS_UF_CICLO,
				);
		} catch (erro) {
			const e = erro as ErroTse;
			estado.erro = e.message ?? String(erro);
			estado.encerrada = false;
			if (typeof e.espera === "number") {
				maxAgeCiclo = e.espera;
				novoBackoff = null;
			} else {
				const base = backoffAnterior ?? 60;
				maxAgeCiclo = Math.min(base * 2, 600);
				novoBackoff = maxAgeCiclo;
			}
		}

		estado.consultadoEm = Date.now();
		await this.ctx.storage.put(CHAVE_ETAGS, etags);
		if (novoBackoff == null) {
			await this.ctx.storage.delete(CHAVE_BACKOFF);
		} else {
			await this.ctx.storage.put(CHAVE_BACKOFF, novoBackoff);
		}

		if (estado.encerrada) {
			estado.proximaConsulta = null;
			await this.ctx.storage.put(CHAVE_ESTADO, estado);
			await this.ctx.storage.deleteAlarm();
			await this.ctx.storage.delete(CHAVE_ESCADA);
			return;
		}

		let esperaSegundos: number;
		if (estado.erro != null) {
			esperaSegundos = Math.max(30, maxAgeCiclo || 60);
		} else if (mudou) {
			await this.ctx.storage.delete(CHAVE_ESCADA);
			esperaSegundos = Math.max(30, maxAgeCiclo || 60);
		} else {
			const degrau =
				(await this.ctx.storage.get<number>(CHAVE_ESCADA)) ?? 0;
			const idx = Math.min(degrau, ESCADA_ESTAVEL.length - 1);
			esperaSegundos = ESCADA_ESTAVEL[idx]!;
			await this.ctx.storage.put(
				CHAVE_ESCADA,
				Math.min(degrau + 1, ESCADA_ESTAVEL.length - 1),
			);
		}
		estado.proximaConsulta = Date.now() + esperaSegundos * 1000;
		await this.ctx.storage.put(CHAVE_ESTADO, estado);
		await this.ctx.storage.setAlarm(estado.proximaConsulta);
	}

	private async registrarLeitura(estado: EstadoApuracao): Promise<void> {
		const historico =
			(await this.ctx.storage.get<Leitura[]>(CHAVE_HISTORICO)) ?? [];
		const leitura = montarLeitura(estado);
		const anterior = historico.at(-1);
		if (
			anterior &&
			JSON.stringify(anterior.c) === JSON.stringify(leitura.c)
		) {
			return;
		}
		historico.push(leitura);
		await this.ctx.storage.put(CHAVE_HISTORICO, historico);
	}
}
