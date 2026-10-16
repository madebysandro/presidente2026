/**
 * Ensaio da noite (#21). Fora do vitest.
 *   npm run ensaio
 *
 * Costura: Worker local (o build em dist/ssr) + TSE falso + gerador
 * `noite-sintetica` + smoke Playwright em 1440/390, claro, com e sem
 * reduzir movimento. Sobe sozinho; não pede clique.
 */
import { createServer } from "node:http";
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import * as esbuild from "esbuild";
import { chromium } from "playwright-core";
import { createTestHarness } from "wrangler";

const RAIZ = new URL("..", import.meta.url).pathname;
const ABERTURA = Date.parse("2026-10-25T17:00:00-03:00");
const REL_PESQUISAS = Date.parse("2026-10-16T12:00:00-03:00");
/** 30 s antes da abertura: a escada de 60 s seria depois das 17h e tem de cair na hora. */
const REL_AGUARDANDO = ABERTURA - 30_000;
const REL_AO_VIVO = Date.parse("2026-10-25T19:50:00-03:00");
const REL_ENCERRADA = Date.parse("2026-10-25T22:15:00-03:00");
const ZIP_PESQUISA = readFileSync(join(RAIZ, "fixtures/pesquisas-tse/fixture_dia0_pesquisa.zip"));
const ZIP_CONTRATANTE = readFileSync(join(RAIZ, "fixtures/pesquisas-tse/fixture_dia0_contratante.zip"));

const VIEWPORTS = [
	{ nome: "1440 claro", largura: 1440, reduzido: false },
	{ nome: "390 claro", largura: 390, reduzido: false },
	{ nome: "1440 reduzir", largura: 1440, reduzido: true },
	{ nome: "390 reduzir", largura: 390, reduzido: true },
];

function ouvir(porta) {
	return new Promise((resolve) => {
		porta.listen(0, "127.0.0.1", () => resolve(porta.address().port));
	});
}

async function corposDaNoite() {
	const outfile = "/tmp/ensaio-corpos.mjs";
	await esbuild.build({
		entryPoints: [join(RAIZ, "scripts/ensaio-corpos.ts")],
		bundle: true,
		format: "esm",
		platform: "node",
		outfile,
		logLevel: "silent",
	});
	const modulo = await import(`${pathToFileURL(outfile).href}?t=${Date.now()}`);
	return modulo.montarCorpos();
}

function tseFalso(corpos) {
	let modo = { tipo: "zerado" };

	function atual() {
		if (modo.tipo === "virada") return corpos.viradas[modo.indice];
		if (modo.tipo === "encerrada") return corpos.encerrada;
		return corpos.zerado;
	}

	function etag() {
		if (modo.tipo === "virada") return `"ensaio-v${modo.indice}"`;
		if (modo.tipo === "encerrada") return `"ensaio-fim"`;
		return `"ensaio-zerado"`;
	}

	const servidor = createServer((req, res) => {
		const url = new URL(req.url || "/", "http://127.0.0.1");
		const caminho = url.pathname;
		if (caminho.endsWith("pesquisa_eleitoral_2026.zip")) {
			res.writeHead(200, {
				"content-type": "application/zip",
				etag: '"ensaio-zip-pesquisa"',
				"cache-control": "no-store",
			});
			res.end(ZIP_PESQUISA);
			return;
		}
		if (caminho.endsWith("pesquisa_contratante_2026.zip")) {
			res.writeHead(200, {
				"content-type": "application/zip",
				etag: '"ensaio-zip-contratante"',
				"cache-control": "no-store",
			});
			res.end(ZIP_CONTRATANTE);
			return;
		}
		if (!caminho.includes("/ele2026/6258/dados/")) {
			res.writeHead(404, { "content-type": "text/plain; charset=utf-8" });
			res.end(`ensaio não serve ${caminho}`);
			return;
		}
		const marca = etag();
		if (req.headers["if-none-match"] === marca) {
			res.writeHead(304, { etag: marca, "cache-control": "max-age=86400" });
			res.end();
			return;
		}
		res.writeHead(200, {
			"content-type": "application/json; charset=utf-8",
			etag: marca,
			"cache-control": "max-age=86400",
		});
		res.end(JSON.stringify(atual()));
	});

	return {
		servidor,
		definir(proximo) {
			modo = proximo;
		},
	};
}

function configDoEnsaio(origem) {
	const built = JSON.parse(readFileSync(join(RAIZ, "dist/ssr/wrangler.json"), "utf8"));
	const config = {
		...built,
		vars: {
			...built.vars,
			TSE_BASE: origem,
			CDN_PESQUISAS: origem,
			CHAVE_AGENTE: "ensaio-local",
		},
	};
	delete config.ratelimits;
	delete config.configPath;
	delete config.userConfigPath;
	const caminho = join(RAIZ, "dist/ssr/wrangler.ensaio.json");
	writeFileSync(caminho, JSON.stringify(config));
	return caminho;
}

async function poller(worker) {
	const env = await worker.getEnv();
	if (!env.POLLER?.getByName) {
		throw new Error("binding POLLER sem getByName");
	}
	return env.POLLER.getByName("ele-6258");
}

async function consultar(worker, relogio) {
	const stub = await poller(worker);
	await stub.fixarAgora(relogio);
	await stub.consultarAgora();
}

async function jsonDa(origem, caminho) {
	const resposta = await fetch(new URL(caminho, origem));
	const texto = await resposta.text();
	if (!resposta.ok) throw new Error(`${caminho} ${resposta.status} ${texto.slice(0, 400)}`);
	return JSON.parse(texto);
}

function textoRuim(texto) {
	if (texto.includes("undefined") || texto.includes("NaN")) return "undefined ou NaN no texto";
	return "";
}

async function checarLeitura(page, largura, reduzido) {
	const texto = await page.locator("body").innerText();
	const ruim = textoRuim(texto);
	if (ruim) throw new Error(ruim);
	const rola = await page.evaluate(
		() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
	);
	if (rola) throw new Error(`rolagem lateral em ${largura}`);
	if (reduzido && (await page.locator(".a-intro").count())) {
		throw new Error("vinheta com reduzir movimento");
	}
	return texto;
}

async function smoke(browser, origem, nome, afirmar) {
	const falhas = [];
	for (const viewport of VIEWPORTS) {
		const rotulo = `${nome} · ${viewport.nome}`;
		const context = await browser.newContext({
			viewport: { width: viewport.largura, height: 900 },
			reducedMotion: viewport.reduzido ? "reduce" : "no-preference",
			colorScheme: "light",
		});
		const page = await context.newPage();
		const erros = [];
		page.on("console", (msg) => {
			if (msg.type() === "error") erros.push(msg.text());
		});
		page.on("pageerror", (erro) => erros.push(String(erro)));
		try {
			await page.goto(new URL("/", origem).href, { waitUntil: "domcontentloaded" });
			await page.waitForSelector("[data-faixa]", { timeout: 15000 });
			const texto = await checarLeitura(page, viewport.largura, viewport.reduzido);
			await afirmar(page, texto);
			if (erros.length) throw new Error(erros.join(" | "));
			console.log(`ok  ${rotulo}`);
			falhas.push({ item: rotulo, ok: true, detalhe: "leitura limpa" });
		} catch (erro) {
			const detalhe = erro instanceof Error ? erro.message : String(erro);
			console.log(`FALHOU  ${rotulo}  ${detalhe}`);
			falhas.push({ item: rotulo, ok: false, detalhe });
		}
		await context.close();
	}
	return falhas;
}

const linhas = [];
function anotar(item, ok, detalhe) {
	linhas.push({ item, ok, detalhe });
	console.log(`${ok ? "ok " : "FALHOU"}  ${item}  ${detalhe}`);
}

const built = join(RAIZ, "dist/ssr/index.js");
try {
	readFileSync(built);
} catch {
	console.error("falta dist/ssr/index.js — rode npm run build");
	process.exit(1);
}

const corpos = await corposDaNoite();
const tse = tseFalso(corpos);
const portaTse = await ouvir(tse.servidor);
const origemTse = `http://127.0.0.1:${portaTse}`;
const configPath = configDoEnsaio(origemTse);

const servidor = createTestHarness({
	workers: [
		{
			configPath,
			prebuiltWorkerDir: join(RAIZ, "dist/ssr"),
		},
	],
});

let browser;
try {
	const { url } = await servidor.listen();
	const origem = url.href;
	const worker = servidor.getWorker();
	console.log(`worker ${origem} · tse falso ${origemTse}`);

	browser = await chromium.launch({
		executablePath: process.env.CHROME_PATH || "/usr/bin/google-chrome",
		args: ["--no-sandbox", "--disable-dev-shm-usage"],
	});

	tse.definir({ tipo: "zerado" });
	await consultar(worker, REL_PESQUISAS);
	const pesquisas = await jsonDa(origem, "/api/apuracao");
	anotar(
		"pesquisas · API antes das 17h de 25/10",
		pesquisas.fase === "pesquisas" &&
			pesquisas.cargos?.presidente?.apurado === 0 &&
			!pesquisas.encerrada &&
			pesquisas.proximaConsulta < ABERTURA,
		`fase=${pesquisas.fase} apurado=${pesquisas.cargos?.presidente?.apurado} próxima=${pesquisas.proximaConsulta}`,
	);

	await consultar(worker, REL_AGUARDANDO);
	const aguardando = await jsonDa(origem, "/api/apuracao");
	anotar(
		"aguardando 17h · API segura a consulta na abertura",
		aguardando.fase === "pesquisas" &&
			aguardando.cargos?.presidente?.apurado === 0 &&
			aguardando.proximaConsulta === ABERTURA,
		`fase=${aguardando.fase} próxima=${aguardando.proximaConsulta} abertura=${ABERTURA}`,
	);

	const quente = await fetch(new URL("/", origem));
	const htmlAguardando = await quente.text();
	if (!quente.ok) throw new Error(`GET / ${quente.status} ${htmlAguardando.slice(0, 500)}`);
	anotar(
		"aguardando 17h · página de pesquisas com arquivo zerado",
		htmlAguardando.includes("Aguardando 17h") &&
			htmlAguardando.includes("arquivo zerado") &&
			htmlAguardando.includes('data-fase="pesquisas"') &&
			!htmlAguardando.includes("Momentos da noite"),
		"faixa Aguardando 17h, arquivo zerado, sem placar da noite",
	);

	linhas.push(
		...(await smoke(browser, origem, "pesquisas", async (page, texto) => {
			const fase = await page.locator("[data-faixa]").getAttribute("data-fase");
			if (fase !== "pesquisas") throw new Error(`fase ${fase}`);
			if (!texto.includes("Aguardando 17h")) throw new Error("sem faixa Aguardando 17h");
			if (!texto.includes("arquivo zerado")) throw new Error("sem arquivo zerado");
			if (texto.includes("Momentos da noite")) throw new Error("a noite entrou na fase pesquisas");
			if (await page.locator(".t-virada").count()) throw new Error("virada fora de hora");
		})),
	);

	for (let indice = 0; indice < corpos.viradas.length; indice++) {
		tse.definir({ tipo: "virada", indice });
		await consultar(worker, REL_AO_VIVO);
	}
	const aoVivo = await jsonDa(origem, "/api/apuracao");
	const viradas = aoVivo.analise?.viradas ?? [];
	anotar(
		"ao vivo · viradas na API",
		aoVivo.fase === "ao_vivo" &&
			viradas.length === 2 &&
			viradas[0]?.de === "22" &&
			viradas[0]?.para === "13" &&
			viradas[1]?.de === "13" &&
			viradas[1]?.para === "22",
		`fase=${aoVivo.fase} viradas=${viradas.length}`,
	);
	linhas.push(
		...(await smoke(browser, origem, "ao vivo", async (page, texto) => {
			const fase = await page.locator("[data-faixa]").getAttribute("data-fase");
			if (fase !== "ao_vivo") throw new Error(`fase ${fase}`);
			if (!texto.includes("Ao vivo")) throw new Error("sem faixa Ao vivo");
			if (!texto.includes("virou de Flávio para Lula")) throw new Error("momento da virada ausente");
			if (!texto.includes("virou de Lula para Flávio")) throw new Error("segunda virada ausente");
			const marcas = await page.locator(".t-virada").count();
			if (marcas !== 2) throw new Error(`${marcas} marcas no gráfico`);
			const altura = await page.locator(".t-virada").first().evaluate((el) => el.getBoundingClientRect().height);
			if (altura < 10) throw new Error(`marca da virada com altura ${altura}`);
			if (texto.includes("Resultado final")) throw new Error("carimbo de encerrada no ao vivo");
			if (texto.includes("Pesquisas × urnas")) throw new Error("comparação entrou no ao vivo");
			if ((await page.locator("[data-estimativas]").count()) !== 1) {
				throw new Error("estimativas ausentes no ao vivo");
			}
		})),
	);

	tse.definir({ tipo: "encerrada" });
	await consultar(worker, REL_ENCERRADA);
	const encerrada = await jsonDa(origem, "/api/apuracao");
	anotar(
		"encerrada · API para de agendar",
		encerrada.fase === "encerrada" &&
			encerrada.encerrada === true &&
			encerrada.proximaConsulta === null &&
			encerrada.analise?.fechamento?.viradas === 2,
		`fase=${encerrada.fase} viradas=${encerrada.analise?.fechamento?.viradas} próxima=${encerrada.proximaConsulta}`,
	);
	linhas.push(
		...(await smoke(browser, origem, "encerrada", async (page, texto) => {
			const fase = await page.locator("[data-faixa]").getAttribute("data-fase");
			if (fase !== "encerrada") throw new Error(`fase ${fase}`);
			if (!texto.includes("Resultado final · 2º turno")) throw new Error("sem carimbo final");
			if (!texto.includes("✓ Eleito")) throw new Error("sem selo");
			const eleito = await page.locator("[data-eleito]").getAttribute("data-eleito");
			if (eleito !== "22") throw new Error(`selo em ${eleito}`);
			if (!texto.includes("Pesquisas × urnas")) throw new Error("sem Pesquisas × urnas");
			const esperaMedia = texto.includes("A comparação entra quando");
			const linhasUrna = await page.locator("[data-pesquisas-urnas] li").count();
			if (!esperaMedia && linhasUrna < 1) {
				throw new Error("comparação sem linhas e sem a frase de espera");
			}
			if (await page.locator("[data-estimativas]").count()) throw new Error("estimativa sobreviveu");
			if (texto.includes("até a votação")) throw new Error("contagem da fase pesquisas");
			const viradasNoite = await page.locator("[data-viradas]").innerText();
			if (viradasNoite !== "2") throw new Error(`viradas na análise final: ${viradasNoite}`);
		})),
	);
} catch (erro) {
	anotar("roteiro", false, erro instanceof Error ? erro.stack || erro.message : String(erro));
	try {
		console.log(servidor.getLogs().slice(-30));
	} catch {
		// o harness pode não ter subido
	}
} finally {
	if (browser) await browser.close();
	await servidor.close();
	tse.servidor.close();
}

const ok = linhas.filter((linha) => linha.ok).length;
console.log("\n## Checklist do ensaio #21\n");
for (const linha of linhas) {
	console.log(`- [${linha.ok ? "x" : " "}] ${linha.item} — ${linha.detalhe}`);
}
console.log(`\n${ok}/${linhas.length} itens ok`);
console.log(
	"Exceção: as linhas dos institutos em Pesquisas × urnas dependem da semeadura da #14, fora do caminho crítico. O bloco e o título entram; sem números publicados a página explica que a comparação espera a média final.",
);
process.exit(linhas.every((linha) => linha.ok) && linhas.length > 0 ? 0 : 1);
