import { DurableObject } from "cloudflare:workers";
import { faseDe, limitarEsperaMs } from "../apuracao/abertura";
import {
	anexarReferenciaColegio,
	comparacaoTurnos,
	fechamentoDe,
	momentosDaNoite,
	regioesDe,
	ufsQueViraram,
	viradasDoHistorico,
} from "../apuracao/analise-2t";
import { alvosCiclo, chaveTf, urlDoAlvo } from "../apuracao/escopos";
import { configTseDeEnv, type ConfigTse } from "../config/tse";
import { SIGLAS_UF } from "../config/ufs";
import { colegioMudou, normalizarColegio } from "../dominio/cargos/colegio";
import type { DadosBrutosCargo } from "../dominio/cargos/dados-brutos";
import { normalizarMajoritario } from "../dominio/cargos/majoritario";
import {
	normalizarPresidenteUf,
	ufMudou,
} from "../dominio/cargos/presidente-uf";
import { analisarMajoritarias } from "../dominio/majoritarias/analise";
import type {
	Cargo,
	ColegioPresidente,
	EstadoApuracao,
	Leitura,
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

const CHAVE_RELOGIO = "relogio";

type Etags = Record<string, string>;

function estadoVazio(): EstadoApuracao {
	return {
		versao: 0,
		consultadoEm: null,
		proximaConsulta: null,
		erro: null,
		cargos: {},
		ufs: {},
		colegios: {},
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

function normalizarBrasil(
	json: DadosBrutosCargo,
	cfg: ConfigTse,
): Cargo {
	return normalizarMajoritario(
		{
			id: "presidente",
			titulo: "Presidente",
			local: "Brasil",
			ele: cfg.eleicaoFederal,
			uf: "br",
			cd: "0001",
		},
		json,
		cfg,
	);
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
		const estado = await this.lerEstado();
		estado.fase = faseDe(await this.agora(), estado.encerrada);
		estado.colegios = this.comReferencia(estado.colegios);
		return estado;
	}

	/** Relógio fixo para a escada das 17h nos testes. Produção não chama. */
	async fixarAgora(ms: number | null): Promise<void> {
		if (ms == null) await this.ctx.storage.delete(CHAVE_RELOGIO);
		else await this.ctx.storage.put(CHAVE_RELOGIO, ms);
	}

	private async agora(): Promise<number> {
		const fixo = await this.ctx.storage.get<number>(CHAVE_RELOGIO);
		return fixo ?? Date.now();
	}

	private comReferencia(
		colegios: Record<string, ColegioPresidente> | undefined,
	): Record<string, ColegioPresidente> | undefined {
		if (!colegios) return colegios;
		const out: Record<string, ColegioPresidente> = {};
		for (const [chave, colegio] of Object.entries(colegios)) {
			out[chave] = anexarReferenciaColegio(colegio);
		}
		return out;
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
		const agora = await this.agora();
		const espera = limitarEsperaMs(
			30,
			agora,
			estado.cargos.presidente?.apurado ?? 0,
		);
		await this.ctx.storage.setAlarm(agora + espera);
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

		estado.ufs ??= {};
		estado.colegios ??= {};

		let erroGating: ErroTse | null = null;
		try {
			for (const alvo of alvosCiclo()) {
				try {
					const url = urlDoAlvo(cfg, alvo);
					const { maxAge, json, etag } = await buscarArquivoTse(
						url,
						etags[alvo.chave],
					);
					maxAgeCiclo = Math.max(maxAgeCiclo, maxAge);
					if (etag) etags[alvo.chave] = etag;
					if (!json) {
						if (
							alvo.tipo !== "municipio" &&
							!this.escopoGuardado(estado, alvo.chave)
						) {
							cicloCompleto = false;
						}
						continue;
					}
					const bruto = json as DadosBrutosCargo;
					const tf = chaveTf(alvo);
					if (tf) guardarTfEscopo(tf, bruto);

					if (alvo.tipo === "brasil") {
						const novo = normalizarBrasil(bruto, cfg);
						if (cargoMudou(estado.cargos.presidente, novo)) mudou = true;
						estado.cargos.presidente = novo;
					} else if (alvo.tipo === "uf") {
						const novo = normalizarPresidenteUf(alvo.uf, bruto);
						if (ufMudou(estado.ufs[alvo.uf], novo)) mudou = true;
						estado.ufs[alvo.uf] = novo;
					} else {
						const novo = normalizarColegio(
							alvo.uf,
							alvo.cd,
							alvo.nome,
							bruto,
						);
						if (colegioMudou(estado.colegios[alvo.cd], novo)) {
							mudou = true;
						}
						estado.colegios[alvo.cd] = novo;
					}
				} catch (erro) {
					if (alvo.tipo === "municipio") continue;
					erroGating = erro as ErroTse;
					break;
				}
			}

			if (erroGating) throw erroGating;

			estado.tfPorEscopo = tfPorEscopo;

			if (mudou) {
				estado.versao += 1;
				await this.registrarLeitura(estado);
			}

			const historico =
				(await this.ctx.storage.get<Leitura[]>(CHAVE_HISTORICO)) ?? [];
			estado.encerrada =
				cicloCompleto &&
				escoposProntosParaEncerrar(
					estado,
					["presidente"],
					SIGLAS_UF,
				);
			estado.analise = this.montarAnalise(estado, historico);
			estado.erro = null;
			novoBackoff = null;
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

		const agora = await this.agora();
		estado.consultadoEm = agora;
		estado.fase = faseDe(agora, estado.encerrada);
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
		const esperaMs = limitarEsperaMs(
			esperaSegundos,
			agora,
			estado.cargos.presidente?.apurado ?? 0,
		);
		estado.proximaConsulta = agora + esperaMs;
		await this.ctx.storage.put(CHAVE_ESTADO, estado);
		await this.ctx.storage.setAlarm(estado.proximaConsulta);
	}

	private escopoGuardado(estado: EstadoApuracao, chave: string): boolean {
		if (chave === "presidente") return Boolean(estado.cargos.presidente);
		if (chave.startsWith("uf:")) return Boolean(estado.ufs?.[chave.slice(3)]);
		if (chave.startsWith("mu:")) {
			const cd = chave.split(":")[2];
			return Boolean(cd && estado.colegios?.[cd]);
		}
		return false;
	}

	private montarAnalise(
		estado: EstadoApuracao,
		historico: Leitura[],
	): EstadoApuracao["analise"] {
		const majoritarias = analisarMajoritarias(estado.cargos, historico);
		const pres = majoritarias.presidente;
		if (pres) pres.primeiroTurno = null;
		const viradas = viradasDoHistorico(historico);
		if (estado.encerrada && pres) {
			pres.validosAApurar = null;
			pres.margemParaVirarPp = null;
			pres.foraDeAlcance = false;
			pres.tendencias = [];
		}
		const cargo = estado.cargos.presidente;
		const lider = cargo?.candidatos[0];
		const segundo = cargo?.candidatos[1];
		return {
			majoritarias,
			proporcionais: {},
			destaques: [],
			viradas,
			momentos: momentosDaNoite(
				historico,
				viradas,
				Boolean(estado.encerrada),
				cargo?.hora,
				lider?.n,
				lider && segundo ? lider.pct - segundo.pct : undefined,
			),
			regioes: regioesDe(estado.ufs ?? {}),
			ufsQueViraram: ufsQueViraram(estado.ufs ?? {}),
			comparacao: comparacaoTurnos(cargo),
			fechamento:
				estado.encerrada && cargo
					? fechamentoDe(cargo, viradas.length)
					: null,
		};
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
