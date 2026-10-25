/**
 * Atualiza a faixa e, quando a fase ou a versão da apuração mudam,
 * troca só o miolo. Não recarrega o documento.
 */
(() => {
	const main = document.querySelector("main");
	if (!main) return;

	// Espelha textoIdade e textoFaixaProxima em src/pagina/ao-vivo.ts.
	function idade(consultado, agora) {
		if (!Number.isFinite(consultado)) return "ainda sem leitura";
		const segundos = Math.max(0, Math.round((agora - consultado) / 1000));
		if (segundos < 60) return "agora há pouco";
		return `há ${Math.floor(segundos / 60)} min`;
	}

	function proxima(fase, alvo, agora) {
		if (fase === "encerrada") return "Sem nova consulta";
		if (!Number.isFinite(alvo)) {
			return fase === "pesquisas" ? "Próxima consulta às 17h" : "Sem nova consulta";
		}
		const segundos = Math.max(0, Math.round((alvo - agora) / 1000));
		if (segundos >= 86400) {
			const quando = new Intl.DateTimeFormat("pt-BR", {
				timeZone: "America/Sao_Paulo",
				day: "2-digit",
				month: "2-digit",
				hour: "2-digit",
				minute: "2-digit",
				hourCycle: "h23",
			}).format(new Date(alvo));
			return `Próxima consulta ${quando}`;
		}
		if (segundos >= 3600) {
			const horas = Math.floor(segundos / 3600);
			const min = Math.floor((segundos % 3600) / 60);
			return `Próxima consulta em ${horas} h ${String(min).padStart(2, "0")} min`;
		}
		const min = Math.floor(segundos / 60);
		const seg = String(segundos % 60).padStart(2, "0");
		return `Próxima consulta em ${min} min ${seg} s`;
	}

	function numeroAttr(faixa, nome) {
		if (!faixa || !faixa.hasAttribute(nome)) return NaN;
		const n = Number(faixa.getAttribute(nome));
		return Number.isFinite(n) ? n : NaN;
	}

	function tique() {
		const faixa = document.querySelector("[data-faixa]");
		if (!faixa) return;
		const agora = Date.now();
		const fase = faixa.getAttribute("data-fase") || "pesquisas";
		const hora = faixa.getAttribute("data-hora-tse") || "sem horário";
		const linha = faixa.querySelector("[data-faixa-idade]");
		const consulta = faixa.querySelector("[data-faixa-proxima]");
		// Pausa do TSE (#124): os textos vêm do servidor; passado `data-pausa-ate`, volta o normal.
		const pausada = fase === "ao_vivo" && agora < numeroAttr(faixa, "data-pausa-ate");
		faixa.toggleAttribute("data-pausada", pausada);
		const rotulo = faixa.querySelector("[data-faixa-rotulo]");
		if (rotulo && fase === "ao_vivo") rotulo.textContent = pausada ? "Pausada" : "Ao vivo";
		if (linha) {
			linha.textContent = pausada
				? faixa.getAttribute("data-pausa-meio") || ""
				: fase === "pesquisas"
					? "Primeiros resultados às 17:00"
					: `Dados do TSE ${hora} · ${idade(numeroAttr(faixa, "data-consultado"), agora)}`;
		}
		if (consulta) {
			consulta.textContent = pausada
				? faixa.getAttribute("data-pausa-dir") || ""
				: fase === "encerrada"
					? "Resultado final · 2º turno"
					: proxima(fase, numeroAttr(faixa, "data-proxima-em"), agora);
		}
	}

	function aplicarRelogio(faixa, dados) {
		if (!faixa || !dados) return;
		if (dados.consultadoEm == null) faixa.removeAttribute("data-consultado");
		else faixa.setAttribute("data-consultado", String(dados.consultadoEm));
		if (dados.proximaConsulta == null) faixa.removeAttribute("data-proxima-em");
		else faixa.setAttribute("data-proxima-em", String(dados.proximaConsulta));
		const hora = dados.cargos && dados.cargos.presidente && dados.cargos.presidente.hora;
		if (typeof hora === "string" && hora) faixa.setAttribute("data-hora-tse", hora);
		if (typeof dados.fase === "string" && dados.fase) faixa.setAttribute("data-fase", dados.fase);
	}

	async function sincronizar() {
		const resposta = await fetch("/api/apuracao", { headers: { accept: "application/json" } });
		if (!resposta.ok) return;
		const dados = await resposta.json();
		document.dispatchEvent(new CustomEvent("apuracao:leitura", { detail: dados }));
		const fase = typeof dados.fase === "string" ? dados.fase : "";
		const versao = String(dados.versao ?? "");
		const atualFase = main.getAttribute("data-fase") || "";
		const atualVersao = main.getAttribute("data-versao") || "";
		const aoVivo = fase === "ao_vivo" || fase === "encerrada";
		const mudouFase = Boolean(fase) && fase !== atualFase;
		const mudouVersao = versao !== atualVersao;
		if (!mudouFase && !mudouVersao) {
			aplicarRelogio(document.querySelector("[data-faixa]"), dados);
			tique();
			return;
		}
		const fragmento = await fetch("/?fragmento=1", { headers: { accept: "application/json" } });
		if (!fragmento.ok) return;
		const corpo = await fragmento.json();
		const scroll = document.documentElement.scrollTop;
		const faixa = document.querySelector("[data-faixa]");
		const miolo = document.querySelector("[data-miolo]");
		const registroAberto = document.querySelector(".a-pesq.sel")?.getAttribute("data-registro") || "";
		if (faixa && typeof corpo.faixa === "string") faixa.outerHTML = corpo.faixa;
		const trocaMiolo = mudouFase || (aoVivo && mudouVersao);
		if (trocaMiolo && miolo && typeof corpo.miolo === "string") {
			// O mapa atravessa a troca e guarda a UF tocada.
			const mapa = miolo.querySelector("[data-mapa-br]");
			miolo.innerHTML = corpo.miolo;
			const novo = miolo.querySelector("[data-mapa-br]");
			if (mapa && novo) novo.replaceWith(mapa);
			if (registroAberto && window.CSS && CSS.escape) {
				const botao = miolo.querySelector(
					`.a-pesq[data-registro="${CSS.escape(registroAberto)}"]`,
				);
				if (botao) botao.click();
			}
		}
		if (typeof corpo.fase === "string") main.setAttribute("data-fase", corpo.fase);
		if (corpo.versao != null) main.setAttribute("data-versao", String(corpo.versao));
		document.documentElement.scrollTop = scroll;
		tique();
	}

	tique();
	setInterval(tique, 1000);
	setInterval(() => {
		sincronizar().catch(() => {});
	}, 5000);
})();
