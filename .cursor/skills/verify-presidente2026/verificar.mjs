#!/usr/bin/env node
import { spawn, execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { createWriteStream } from "node:fs";
import { accessSync, constants, mkdirSync, openSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { connect } from "node:net";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { chromium } from "playwright-core";
import { LARGURAS, alvosDaProva, htmlDoisTurno, noiteSemSuperficie } from "./paginas.mjs";

const RAIZ = fileURLToPath(new URL("../../..", import.meta.url));
const SUFIXO = createHash("sha256").update(RAIZ).digest("hex").slice(0, 8);
const PID = `/tmp/verify-presidente2026-${SUFIXO}.pid`;
const LOG = `/tmp/verify-presidente2026-${SUFIXO}.log`;
const RUN = `/tmp/verify-presidente2026-${SUFIXO}.run`;
const ALTURA = 900;

const args = process.argv.slice(2);

function comandoDe(lista) {
	const pulados = new Set();
	for (let i = 0; i < lista.length; i++) {
		if (lista[i] === "--port" || lista[i] === "--base" || lista[i] === "--base-ref") pulados.add(i + 1);
	}
	for (let i = 0; i < lista.length; i++) {
		if (pulados.has(i) || lista[i].startsWith("--")) continue;
		return lista[i];
	}
	return "tudo";
}

const comando = comandoDe(args);

function valor(nome, padrao) {
	const indice = args.indexOf(`--${nome}`);
	if (indice === -1 || !args[indice + 1] || args[indice + 1].startsWith("--")) return padrao;
	return args[indice + 1];
}

function portaPedida() {
	const porta = Number(valor("port", "5173"));
	if (!Number.isInteger(porta) || porta < 1 || porta > 65535) {
		throw new Error(`porta inválida: ${valor("port", "5173")}`);
	}
	return porta;
}

function basePedida(porta) {
	return valor("base", `http://127.0.0.1:${porta}`).replace(/\/$/, "");
}

function ambiente() {
	const bin = dirname(process.execPath);
	return { ...process.env, PATH: `${bin}:${process.env.PATH ?? ""}` };
}

function exigirNode() {
	const [maior, menor] = process.versions.node.split(".").map(Number);
	if (maior < 24 || (maior === 24 && menor < 21)) {
		throw new Error(`Node ${process.versions.node} não serve. O repositório pede Node >= 24.21.`);
	}
}

function chromePath() {
	const caminho = process.env.CHROME_PATH || "/usr/bin/google-chrome";
	accessSync(caminho, constants.X_OK);
	return caminho;
}

function portaOcupada(porta) {
	return new Promise((resolve) => {
		const socket = connect({ host: "127.0.0.1", port: porta }, () => {
			socket.end();
			resolve(true);
		});
		socket.on("error", () => resolve(false));
	});
}

function git(argumentos) {
	return execFileSync("git", argumentos, { cwd: RAIZ, encoding: "utf8" })
		.split("\n")
		.map((linha) => linha.trim())
		.filter(Boolean);
}

function arquivosDoDiff(baseRef) {
	const listas = [
		git(["diff", "--name-only", `${baseRef}...HEAD`]),
		git(["diff", "--name-only", "HEAD"]),
		git(["diff", "--name-only", "--cached"]),
		git(["ls-files", "--others", "--exclude-standard"]),
	];
	return [...new Set(listas.flat())];
}

async function lerPagina(base) {
	const resposta = await fetch(base + "/", { redirect: "manual", signal: AbortSignal.timeout(60_000) });
	const corpo = await resposta.text();
	const tipo = resposta.headers.get("content-type") || "";
	const titulo = corpo.match(/<title>([^<]*)<\/title>/)?.[1] ?? "";
	const fase = corpo.match(/data-fase="([^"]*)"/)?.[1] ?? "";
	return { resposta, corpo, tipo, titulo, fase };
}

export async function doctor(base) {
	exigirNode();
	chromePath();
	const { resposta, tipo, titulo, fase, corpo } = await lerPagina(base);
	const marca = corpo.includes("Presidente 2026, 2º turno");
	const ok =
		resposta.status === 200 && tipo.includes("text/html") && htmlDoisTurno(titulo, fase, marca);
	return {
		ok,
		url: base + "/",
		status: resposta.status,
		tipo,
		titulo,
		fase,
		marca,
		node: process.versions.node,
		chrome: chromePath(),
	};
}

function esperarPronto(base, filho) {
	const limite = Date.now() + 180_000;
	return new Promise((resolve, reject) => {
		const olhar = async () => {
			if (filho.exitCode !== null) {
				reject(new Error(`o servidor local saiu com código ${filho.exitCode}`));
				return;
			}
			let log = "";
			try {
				log = readFileSync(LOG, "utf8");
			} catch {
				log = "";
			}
			if (log.includes("Local:")) {
				try {
					const laudo = await doctor(base);
					if (laudo.ok) {
						resolve(laudo);
						return;
					}
				} catch (erro) {
					const nome = erro && erro.name;
					const rede = erro instanceof TypeError || nome === "TimeoutError" || nome === "AbortError";
					if (!rede) {
						reject(erro);
						return;
					}
				}
			}
			if (Date.now() > limite) {
				reject(new Error("o servidor local não ficou utilizável em 180s"));
				return;
			}
			setTimeout(olhar, 500);
		};
		olhar();
	});
}

async function launch(porta) {
	exigirNode();
	if (await portaOcupada(porta)) {
		throw new Error(
			`127.0.0.1:${porta} já responde. Esta prova não mata processo alheio e não sobe uma segunda instância no mesmo .void/.`,
		);
	}
	rmSync(LOG, { force: true });
	const saida = openSync(LOG, "a");
	const filho = spawn(
		"npm",
		["run", "dev", "--", "--host", "127.0.0.1", "--port", String(porta), "--strictPort"],
		{
			cwd: RAIZ,
			detached: true,
			stdio: ["ignore", saida, saida],
			env: ambiente(),
		},
	);
	filho.unref();
	writeFileSync(PID, String(filho.pid));
	const base = `http://127.0.0.1:${porta}`;
	try {
		const laudo = await esperarPronto(base, filho);
		return { pid: filho.pid, base, laudo };
	} catch (erro) {
		await cleanup();
		throw erro;
	}
}

function processoJaSaiu(erro) {
	return Boolean(erro && erro.code === "ESRCH");
}

async function cleanup() {
	let pid = 0;
	try {
		pid = Number(readFileSync(PID, "utf8"));
	} catch {
		pid = 0;
	}
	if (pid > 0) {
		try {
			process.kill(-pid, "SIGTERM");
		} catch (erro) {
			if (!processoJaSaiu(erro)) {
				try {
					process.kill(pid, "SIGTERM");
				} catch (erroPid) {
					if (!processoJaSaiu(erroPid)) throw erroPid;
				}
			}
		}
		await new Promise((resolve) => setTimeout(resolve, 1000));
		try {
			process.kill(-pid, "SIGKILL");
		} catch (erro) {
			if (!processoJaSaiu(erro)) {
				try {
					process.kill(pid, "SIGKILL");
				} catch (erroPid) {
					if (!processoJaSaiu(erroPid)) throw erroPid;
				}
			}
		}
	}
	rmSync(PID, { force: true });
	rmSync(LOG, { force: true });
	return { pid };
}

function pastaDaProva() {
	const id = new Date().toISOString().replace(/[:.]/g, "-");
	const pasta = join(RAIZ, "artifacts", "verify-presidente2026", id);
	mkdirSync(pasta, { recursive: true });
	writeFileSync(RUN, pasta);
	return pasta;
}

async function capturar(base, alvos, pasta) {
	const browser = await chromium.launch({
		executablePath: chromePath(),
		args: ["--no-sandbox", "--disable-dev-shm-usage"],
	});
	const capturas = [];
	let pagina = null;
	try {
		for (const alvo of alvos) {
			for (const largura of LARGURAS) {
				const contexto = await browser.newContext({
					viewport: { width: largura, height: ALTURA },
					reducedMotion: "reduce",
					locale: "pt-BR",
				});
				const page = await contexto.newPage();
				const resposta = await page.goto(new URL(alvo.url, base).toString(), {
					waitUntil: "load",
					timeout: 60_000,
				});
				const status = resposta?.status() ?? 0;
				if (alvo.url === "/") {
					await page.waitForSelector("main.a[data-fase]");
					const h1 = (await page.locator("h1").innerText()).trim();
					const titulo = await page.title();
					const fase = await page.getAttribute("main.a", "data-fase");
					const marca = await page.locator(".a-marca").innerText();
					const calendario = await page
						.locator("section.a-cal")
						.first()
						.getAttribute("aria-label");
					const comoCalculamos = await page.locator("#a-calc-titulo").innerText();
					const rever = await page.getByRole("button", { name: "Rever as três semanas" }).count();
					const graficoVazio = await page.locator(".a-graf-vazio").count();
					const pesquisas = await page.locator("button.a-pesq").count();
					if (!h1 || !htmlDoisTurno(titulo, fase ?? "", marca.includes("Presidente 2026, 2º turno"))) {
						throw new Error(`a página ${largura}px não mostrou o 2º turno`);
					}
					if (!calendario?.startsWith("Calendário das pesquisas")) {
						throw new Error("o calendário não está na página");
					}
					if (comoCalculamos !== "Como calculamos") {
						throw new Error("falta a seção Como calculamos");
					}
					if (graficoVazio > 0) {
						const textoVazio = (await page.locator(".a-graf-vazio").innerText()).trim();
						if (textoVazio !== "Ainda não há pesquisas publicadas neste gráfico.") {
							throw new Error("o gráfico vazio não diz o que o visitante lê");
						}
					}
					pagina = {
						fase,
						h1,
						titulo,
						marca,
						calendario,
						comoCalculamos,
						botaoRever: rever > 0,
						graficoVazio: graficoVazio > 0,
						pesquisasPublicadas: pesquisas,
					};
				}
				if (alvo.url === "/og.png") {
					const tipo = resposta?.headers()["content-type"] || "";
					if (status !== 200 || !tipo.includes("image/png")) {
						throw new Error(`/og.png respondeu ${status} ${tipo}`);
					}
				}
				const nome = `${alvo.url === "/" ? "pagina" : "og"}-${largura}.png`;
				const arquivo = join(pasta, nome);
				await page.screenshot({ path: arquivo, fullPage: true });
				capturas.push({ url: alvo.url, motivo: alvo.motivo, largura, status, arquivo: nome });
				if (alvo.url === "/" && largura === 1280) {
					const botao = page.getByRole("button", { name: "Rever as três semanas" });
					if ((await botao.count()) !== 1) {
						throw new Error("o botão Rever as três semanas não está na página");
					}
					await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
					const scrollAntes = await page.evaluate(() => window.scrollY);
					if (scrollAntes < 100) throw new Error("a página não desceu para provar o botão");
					await botao.click();
					await page.waitForFunction(() => window.scrollY === 0);
					const h1Depois = (await page.locator("h1").innerText()).trim();
					if (!h1Depois || new URL(page.url()).pathname !== "/") {
						throw new Error("rever as três semanas saiu da página");
					}
					const acao = join(pasta, "acao-rever-1280.png");
					await page.screenshot({ path: acao, fullPage: true });
					capturas.push({
						url: "/",
						motivo: "acao-rever",
						largura: 1280,
						status,
						arquivo: "acao-rever-1280.png",
						h1Depois,
					});
					pagina = { ...pagina, h1Depois, scrollAntes };
				}
				await contexto.close();
			}
		}
	} finally {
		await browser.close();
	}
	return { capturas, pagina };
}

function testes(pasta) {
	const log = join(pasta, "npm-test.log");
	const filho = spawn("npm", ["test"], { cwd: RAIZ, env: ambiente() });
	const saida = createWriteStream(log);
	filho.stdout.pipe(saida);
	filho.stderr.pipe(saida);
	filho.stdout.pipe(process.stdout);
	filho.stderr.pipe(process.stderr);
	return new Promise((resolve) => {
		filho.on("error", (erro) => {
			saida.end(() => resolve({ codigo: 1, log: "npm-test.log", erro: erro.message }));
		});
		filho.on("close", (codigo) => {
			saida.end(() => resolve({ codigo: codigo ?? 1, log: "npm-test.log" }));
		});
	});
}

function gravar(pasta, relatorio) {
	writeFileSync(join(pasta, "relatorio.json"), JSON.stringify(relatorio, null, 2));
	console.log(pasta);
}

async function main() {
	const porta = portaPedida();
	const baseRef = valor("base-ref", "main");
	if (comando === "cleanup") {
		const morto = await cleanup();
		rmSync(RUN, { force: true });
		console.log(JSON.stringify(morto));
		return;
	}
	if (comando === "doctor") {
		const laudo = await doctor(basePedida(porta));
		console.log(JSON.stringify(laudo, null, 2));
		if (!laudo.ok) process.exitCode = 1;
		return;
	}
	if (comando === "launch") {
		const subiu = await launch(porta);
		console.log(JSON.stringify({ pid: subiu.pid, base: subiu.base, fase: subiu.laudo.fase }));
		return;
	}
	if (comando === "provar") {
		const pasta = pastaDaProva();
		const arquivos = arquivosDoDiff(baseRef);
		const alvos = alvosDaProva(arquivos);
		const prova = await capturar(basePedida(porta), alvos, pasta);
		gravar(pasta, { alvos, arquivos, ...prova });
		return;
	}
	if (comando === "testes") {
		const pasta = pastaDaProva();
		const resultado = await testes(pasta);
		if (resultado.codigo !== 0) process.exitCode = resultado.codigo;
		return;
	}
	if (comando !== "tudo") {
		throw new Error(`comando desconhecido: ${comando}`);
	}
	const pasta = pastaDaProva();
	let laudo = null;
	let prova = null;
	let arquivos = [];
	let alvos = [];
	let base = null;
	let pid = null;
	let erroCaptura = null;
	try {
		const subiu = await launch(porta);
		base = subiu.base;
		pid = subiu.pid;
		laudo = subiu.laudo;
		writeFileSync(join(pasta, "doctor.json"), JSON.stringify(laudo, null, 2));
		arquivos = arquivosDoDiff(baseRef);
		alvos = alvosDaProva(arquivos);
		prova = await capturar(subiu.base, alvos, pasta);
	} catch (erro) {
		erroCaptura = erro;
	} finally {
		await cleanup();
		rmSync(RUN, { force: true });
	}
	const resultadoTestes = await testes(pasta);
	const noite = prova ? noiteSemSuperficie(arquivos, prova.pagina?.fase ?? "") : false;
	gravar(pasta, {
		base,
		pid,
		doctor: laudo,
		alvos,
		arquivos,
		...(prova ?? { capturas: [], pagina: null }),
		noite: noite ? "nao-exercitada" : null,
		testes: resultadoTestes,
		erroCaptura: erroCaptura instanceof Error ? erroCaptura.message : null,
	});
	if (erroCaptura) throw erroCaptura;
	if (noite) {
		throw new Error(
			"o diff mexe na noite e o dev local ainda está em pesquisas. A captura de / não prova ao vivo nem encerrada.",
		);
	}
	if (resultadoTestes.codigo) process.exitCode = resultadoTestes.codigo;
}

const executadoDireto =
	process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (executadoDireto) {
	main().catch(async (erro) => {
		console.error(erro instanceof Error ? erro.message : erro);
		process.exitCode = 1;
	});
}
