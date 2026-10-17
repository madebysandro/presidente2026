#!/usr/bin/env node
import { spawn } from "node:child_process";
import { mkdir, open, readFile, rm, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const RAIZ = resolve(fileURLToPath(new URL("../../../", import.meta.url)));
const ESTADO = join(RAIZ, "artifacts/verificacao/atual.json");
const PORTA_PADRAO = 5273;
const LARGURAS = [390, 1280];

function exigirNode() {
	const [maior, menor] = process.versions.node.split(".").map(Number);
	if (maior < 24 || (maior === 24 && menor < 21)) {
		throw new Error(`Node ${process.version} não atende o .nvmrc (24.21).`);
	}
}

function ambienteLocal() {
	return {
		...process.env,
		PATH: `${dirname(process.execPath)}:${process.env.PATH ?? ""}`,
		VOID_REMOTE: "0",
		NO_COLOR: "1",
	};
}

function planoLancamento(porta) {
	const vite = join(RAIZ, "node_modules/vite/bin/vite.js");
	return {
		exec: process.execPath,
		args: [vite, "--host", "127.0.0.1", "--port", String(porta), "--strictPort"],
		env: { VOID_REMOTE: "0" },
	};
}

function dormir(ms) {
	return new Promise((resolver) => setTimeout(resolver, ms));
}

async function lerEstado() {
	const texto = await readFile(ESTADO, "utf8");
	return JSON.parse(texto);
}

function vivo(pid) {
	try {
		process.kill(pid, 0);
		return true;
	} catch {
		return false;
	}
}

async function cmdline(pid) {
	const bruto = await readFile(`/proc/${pid}/cmdline`);
	return bruto.toString().split("\0").filter(Boolean);
}

async function variavel(pid, nome) {
	const bruto = await readFile(`/proc/${pid}/environ`);
	const linha = bruto
		.toString()
		.split("\0")
		.find((item) => item.startsWith(`${nome}=`));
	return linha?.slice(nome.length + 1);
}

function redigir(texto) {
	return texto
		.replace(/\x1b\[[0-9;]*m/g, "")
		.replace(/x-void-dev-trigger:\s*\S+/g, "x-void-dev-trigger: [redigido]")
		.replace(/([?&]token=)[^&\s'"]+/g, "$1[redigido]");
}

async function redigirLog(logPath) {
	const texto = await readFile(logPath, "utf8").catch(() => "");
	if (!texto) return;
	await writeFile(logPath, redigir(texto));
}

async function esperarUrl(logPath, porta, pid) {
	const alvo = `http://127.0.0.1:${porta}/`;
	const inicio = Date.now();
	while (Date.now() - inicio < 60_000) {
		if (!vivo(pid)) throw new Error("O Vite encerrou antes de ficar pronto.");
		const texto = redigir(await readFile(logPath, "utf8").catch(() => ""));
		if (texto.includes("ready") && texto.includes(alvo)) return alvo;
		await dormir(200);
	}
	throw new Error("O Vite não imprimiu a URL local em 60s.");
}

async function launch(porta) {
	exigirNode();
	try {
		const atual = await lerEstado();
		if (vivo(atual.pid)) {
			throw new Error(`Já existe uma instância desta verificação no pid ${atual.pid}. Recuse uma segunda.`);
		}
	} catch (erro) {
		if (erro instanceof Error && erro.message.startsWith("Já existe")) throw erro;
	}
	const prova = join(RAIZ, "artifacts/verificacao/provas", new Date().toISOString().replace(/[:.]/g, "-"));
	const logPath = join(prova, "servidor.log");
	await mkdir(prova, { recursive: true });
	const plano = planoLancamento(porta);
	const saida = await open(logPath, "a");
	const filho = spawn(plano.exec, plano.args, {
		cwd: RAIZ,
		env: ambienteLocal(),
		detached: true,
		stdio: ["ignore", saida.fd, saida.fd],
	});
	filho.unref();
	await saida.close();
	const pid = filho.pid;
	if (!pid) throw new Error("O Vite não devolveu pid.");
	const base = `http://127.0.0.1:${porta}/`;
	const estado = { pid, porta, base, prova, logPath };
	await mkdir(dirname(ESTADO), { recursive: true });
	await writeFile(ESTADO, JSON.stringify(estado, null, 2));
	try {
		await esperarUrl(logPath, porta, pid);
	} catch (erro) {
		await cleanup();
		throw erro;
	}
	console.log(JSON.stringify({ pronto: base, pid, prova }));
}

async function donoDaPorta(porta) {
	const { execFile } = await import("node:child_process");
	const texto = await new Promise((resolver) => {
		execFile("lsof", ["-nP", `-iTCP:${porta}`, "-sTCP:LISTEN", "-t"], (erro, stdout) => resolver(erro ? "" : stdout));
	});
	const pid = texto.trim().split("\n").find(Boolean);
	return pid ? Number(pid) : null;
}

async function doctor() {
	exigirNode();
	const estado = await lerEstado();
	if (!vivo(estado.pid)) throw new Error(`O pid ${estado.pid} não está no ar.`);
	const args = await cmdline(estado.pid);
	const linha = args.join(" ");
	if (/\bwrangler\b/.test(linha)) throw new Error("A instância foi iniciada com wrangler.");
	if (!linha.includes("vite.js") && !linha.includes(`${join("node_modules", "vite")}`)) {
		throw new Error(`O pid ${estado.pid} não é o Vite desta verificação.`);
	}
	if ((await variavel(estado.pid, "VOID_REMOTE")) !== "0") {
		throw new Error("VOID_REMOTE não está em 0. A verificação só dirige Miniflare local.");
	}
	const ouvinte = await donoDaPorta(estado.porta);
	if (ouvinte && ouvinte !== estado.pid) {
		throw new Error(`A porta ${estado.porta} pertence ao pid ${ouvinte}, não ao ${estado.pid}.`);
	}
	const resposta = await fetch(estado.base, { signal: AbortSignal.timeout(180_000) });
	const html = await resposta.text();
	if (resposta.status !== 200) throw new Error(`GET / respondeu ${resposta.status}.`);
	if (!html.includes("<title>Presidente 2026")) throw new Error("O HTML não é a página do 2º turno.");
	if (!html.includes('class="a"')) throw new Error("O HTML não tem o <main> da página.");
	const trecho = redigir(await readFile(estado.logPath, "utf8"))
		.split("\n")
		.filter((item) => item.includes("Local:") || item.includes("ready"))
		.join("\n");
	await writeFile(join(estado.prova, "doctor.txt"), `${trecho}\nstatus ${resposta.status}\n`);
	console.log(JSON.stringify({ ok: true, base: estado.base, pid: estado.pid, prova: estado.prova }));
}

async function browser() {
	const exigir = createRequire(join(RAIZ, "package.json"));
	const { chromium } = exigir("playwright-core");
	return chromium.launch({
		executablePath: process.env.CHROME_PATH || "/usr/bin/google-chrome",
		args: ["--no-sandbox", "--disable-dev-shm-usage"],
	});
}

async function abrir(pagina, url) {
	const erros = [];
	pagina.on("pageerror", (erro) => erros.push(String(erro)));
	await pagina.goto(url, { waitUntil: "domcontentloaded", timeout: 180_000 });
	await pagina.waitForSelector("main.a", { timeout: 30_000 });
	const intro = pagina.locator(".a-intro");
	if (await intro.count()) {
		await pagina.keyboard.press("Escape");
		await intro.waitFor({ state: "detached", timeout: 5_000 });
	}
	if (erros.length) throw new Error(erros.join(" | "));
}

async function diaNoTopo(pagina) {
	return pagina.evaluate(() => {
		const dias = [...document.querySelectorAll(".a-dia")].filter((dia) => {
			const caixa = dia.getBoundingClientRect();
			return caixa.width > 0 && caixa.height > 0;
		});
		dias.sort((a, b) => a.getBoundingClientRect().top - b.getBoundingClientRect().top || a.getBoundingClientRect().left - b.getBoundingClientRect().left);
		return dias[0]?.getAttribute("data-d") ?? "";
	});
}

async function capturar(pagina, prova, nome) {
	const caminho = join(prova, `${nome}.png`);
	await pagina.screenshot({ path: caminho, fullPage: true });
	return caminho;
}

async function drivePagina(estado) {
	const navegador = await browser();
	const relatorio = { feature: "pagina-pesquisas", larguras: {} };
	try {
		for (const largura of LARGURAS) {
			const contexto = await navegador.newContext({
				viewport: { width: largura, height: largura === 390 ? 844 : 800 },
				reducedMotion: "no-preference",
				colorScheme: "light",
			});
			const pagina = await contexto.newPage();
			await abrir(pagina, estado.base);
			const titulo = await pagina.title();
			const h1 = (await pagina.locator("h1").first().textContent())?.trim() ?? "";
			const fase = await pagina.locator("main.a").getAttribute("data-fase");
			const comoCalculamos = await pagina.getByRole("heading", { name: "Como calculamos" }).count();
			const topo = await diaNoTopo(pagina);
			const png = await capturar(pagina, estado.prova, `pagina-${largura}`);
			relatorio.larguras[largura] = { titulo, h1, fase, comoCalculamos, topo, png };
			if (titulo !== "Presidente 2026 · 2º turno") throw new Error(`Título inesperado: ${titulo}`);
			if (!h1) throw new Error("A página não tem h1.");
			if (fase !== "pesquisas" && fase !== "ao_vivo" && fase !== "encerrada") {
				throw new Error(`Fase desconhecida: ${fase}`);
			}
			if (!comoCalculamos) throw new Error('O heading "Como calculamos" não apareceu.');
			await contexto.close();
		}
	} finally {
		await navegador.close();
	}
	const estreita = relatorio.larguras[390].topo;
	const larga = relatorio.larguras[1280].topo;
	const fase = relatorio.larguras[390].fase;
	const topoLargo = fase === "pesquisas" ? "2026-10-05" : "2026-10-19";
	if (estreita !== "2026-10-25") throw new Error(`Em 390 px o dia do topo foi ${estreita}.`);
	if (larga !== topoLargo) throw new Error(`Em 1280 px o dia do topo foi ${larga}.`);
	await writeFile(join(estado.prova, "pagina-pesquisas.json"), JSON.stringify(relatorio, null, 2));
	console.log(JSON.stringify(relatorio));
}

async function driveCalendario(estado) {
	const navegador = await browser();
	try {
		const contexto = await navegador.newContext({
			viewport: { width: 390, height: 844 },
			colorScheme: "light",
		});
		const pagina = await contexto.newPage();
		await abrir(pagina, estado.base);
		const rotulo = pagina.getByRole("region", { name: "Calendário das pesquisas, de 5 a 25 de outubro" });
		if (!(await rotulo.count())) throw new Error("O calendário não está na página.");
		const dias = await pagina.locator(".a-dia").count();
		if (dias !== 21) throw new Error(`O calendário tem ${dias} dias.`);
		const rever = pagina.getByRole("button", { name: "Rever as três semanas" });
		if (!(await rever.count())) throw new Error('O botão "Rever as três semanas" não apareceu.');
		await rever.click();
		await pagina.screenshot({ path: join(estado.prova, "calendario-390.png"), fullPage: true });
		await contexto.close();
	} finally {
		await navegador.close();
	}
	console.log(JSON.stringify({ feature: "calendario", ok: true }));
}

async function driveGrafico(estado) {
	const resposta = await fetch(estado.base);
	const html = await resposta.text();
	const vazio = html.includes("Ainda não há pesquisas publicadas neste gráfico.");
	const chips = html.includes('aria-label="Institutos no gráfico"');
	if (!vazio && !chips) throw new Error("O gráfico não está nem vazio nem com institutos.");
	await writeFile(join(estado.prova, "grafico.txt"), vazio ? "vazio\n" : "com institutos\n");
	console.log(JSON.stringify({ feature: "grafico-vantagem", vazio, chips }));
}

async function driveApis(estado) {
	const provas = {};
	for (const caminho of ["/api/pesquisas", "/api/apuracao"]) {
		const resposta = await fetch(new URL(caminho, estado.base), { signal: AbortSignal.timeout(180_000) });
		const corpo = await resposta.text();
		if (resposta.status !== 200) throw new Error(`${caminho} respondeu ${resposta.status}.`);
		const json = JSON.parse(corpo);
		if (caminho === "/api/pesquisas" && json.fase == null) throw new Error("/api/pesquisas sem fase.");
		const nome = caminho.slice(1).replaceAll("/", "-");
		await writeFile(join(estado.prova, `${nome}.json`), corpo);
		provas[caminho] = { status: resposta.status, bytes: corpo.length };
	}
	console.log(JSON.stringify({ feature: "apis-publicas", provas }));
}

async function driveOg(estado) {
	const resposta = await fetch(new URL("/og.png", estado.base), { signal: AbortSignal.timeout(180_000) });
	if (resposta.status !== 200) throw new Error(`/og.png respondeu ${resposta.status}.`);
	const bytes = Buffer.from(await resposta.arrayBuffer());
	if (bytes.subarray(0, 8).toString("hex") !== "89504e470d0a1a0a") throw new Error("/og.png não é PNG.");
	const largura = bytes.readUInt32BE(16);
	const altura = bytes.readUInt32BE(20);
	if (largura !== 1200 || altura !== 630) throw new Error(`/og.png mediu ${largura}x${altura}.`);
	await writeFile(join(estado.prova, "og.png"), bytes);
	console.log(JSON.stringify({ feature: "previa-og", largura, altura, bytes: bytes.length }));
}

async function drive(feature) {
	const estado = await lerEstado();
	if (feature === "pagina-pesquisas") return drivePagina(estado);
	if (feature === "calendario") return driveCalendario(estado);
	if (feature === "grafico-vantagem") return driveGrafico(estado);
	if (feature === "apis-publicas") return driveApis(estado);
	if (feature === "previa-og") return driveOg(estado);
	throw new Error(`Feature desconhecida: ${feature}`);
}

function urlLocal(base, caminho) {
	if (!caminho.startsWith("/") || caminho.startsWith("//")) {
		throw new Error(`Rota fora do servidor local: ${caminho}`);
	}
	const url = new URL(caminho, base);
	if (url.origin !== new URL(base).origin) throw new Error(`Rota fora do servidor local: ${caminho}`);
	return url;
}

async function paginas(caminhos) {
	const estado = await lerEstado();
	const feito = [];
	let navegador;
	try {
		for (const caminho of caminhos) {
			const url = urlLocal(estado.base, caminho);
			const resposta = await fetch(url, { signal: AbortSignal.timeout(180_000) });
			const tipo = resposta.headers.get("content-type") ?? "";
			const corpo = Buffer.from(await resposta.arrayBuffer());
			if (resposta.status !== 200) throw new Error(`${caminho} respondeu ${resposta.status}.`);
			const nome = caminho === "/" ? "raiz" : caminho.slice(1).replaceAll("/", "-");
			if (!tipo.includes("text/html")) {
				await writeFile(join(estado.prova, `alterada-${nome}.bin`), corpo);
				feito.push({ caminho, status: 200, tipo });
				continue;
			}
			navegador ??= await browser();
			for (const largura of LARGURAS) {
				const contexto = await navegador.newContext({
					viewport: { width: largura, height: largura === 390 ? 844 : 800 },
					colorScheme: "light",
				});
				const pagina = await contexto.newPage();
				if (caminho === "/") await abrir(pagina, estado.base);
				else {
					const ida = await pagina.goto(url.href, { waitUntil: "domcontentloaded", timeout: 180_000 });
					if (!ida || ida.status() !== 200) throw new Error(`${caminho} respondeu ${ida?.status()}.`);
				}
				await pagina.screenshot({ path: join(estado.prova, `alterada-${nome}-${largura}.png`), fullPage: caminho === "/" });
				await contexto.close();
				feito.push({ caminho, largura, status: 200 });
			}
		}
	} finally {
		await navegador?.close();
	}
	console.log(JSON.stringify({ paginas: feito, prova: estado.prova }));
}

async function testes() {
	exigirNode();
	const estado = await lerEstado();
	const logPath = join(estado.prova, "npm-test.log");
	const saida = await open(logPath, "w");
	try {
		const codigo = await new Promise((resolver, rejeitar) => {
			const filho = spawn("npm", ["test"], {
				cwd: RAIZ,
				env: ambienteLocal(),
				stdio: ["ignore", saida.fd, saida.fd],
			});
			filho.on("error", rejeitar);
			filho.on("exit", (codigoSaida) => resolver(codigoSaida ?? 1));
		});
		if (codigo !== 0) throw new Error(`npm test saiu com ${codigo}. Log: ${logPath}`);
	} finally {
		await saida.close();
	}
	console.log(JSON.stringify({ ok: true, log: logPath }));
}

async function cleanup() {
	let estado;
	try {
		estado = await lerEstado();
	} catch {
		console.log(JSON.stringify({ encerrado: false, motivo: "sem instância" }));
		return;
	}
	if (vivo(estado.pid)) {
		try {
			process.kill(-estado.pid, "SIGTERM");
		} catch {
			process.kill(estado.pid, "SIGTERM");
		}
		for (let i = 0; i < 25 && vivo(estado.pid); i += 1) await dormir(200);
		if (vivo(estado.pid)) process.kill(-estado.pid, "SIGKILL");
	}
	await redigirLog(estado.logPath);
	await rm(ESTADO, { force: true });
	console.log(JSON.stringify({ encerrado: true, prova: estado.prova }));
}

const [comando, ...resto] = process.argv.slice(2);

try {
	if (comando === "plano-lancamento") {
		exigirNode();
		const porta = Number(resto[0] ?? PORTA_PADRAO);
		const plano = planoLancamento(porta);
		const texto = [plano.exec, ...plano.args].join(" ");
		if (/\bwrangler\b/.test(texto) || plano.env.VOID_REMOTE !== "0") {
			throw new Error("O plano de lançamento apontou para fora do Miniflare local.");
		}
		console.log(JSON.stringify(plano));
	} else if (comando === "launch") {
		const indice = resto.indexOf("--port");
		const porta = indice >= 0 ? Number(resto[indice + 1]) : PORTA_PADRAO;
		await launch(porta);
	} else if (comando === "doctor") {
		await doctor();
	} else if (comando === "drive") {
		await drive(resto[0]);
	} else if (comando === "paginas") {
		const caminhos = [];
		for (let i = 0; i < resto.length; i += 1) {
			if (resto[i] === "--path") caminhos.push(resto[i + 1]);
		}
		if (!caminhos.length) throw new Error("paginas exige ao menos um --path.");
		await paginas(caminhos);
	} else if (comando === "testes") {
		await testes();
	} else if (comando === "cleanup") {
		await cleanup();
	} else {
		throw new Error("Comando: launch | doctor | drive <feature> | paginas --path <rota> | testes | cleanup | plano-lancamento");
	}
} catch (erro) {
	console.error(erro instanceof Error ? erro.message : erro);
	process.exit(1);
}
