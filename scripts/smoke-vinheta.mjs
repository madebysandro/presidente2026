/**
 * Smoke da vinheta (#13). Fora do vitest.
 *   node scripts/smoke-vinheta.mjs
 * Usa o Chrome do sistema (CHROME_PATH) e a página renderizada com a fixture.
 */
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join, normalize } from "node:path";
import { pathToFileURL } from "node:url";
import { chromium } from "playwright-core";
import * as esbuild from "esbuild";

const RAIZ = new URL("..", import.meta.url).pathname;
const PUBLICO = join(RAIZ, "public");
const CSP = [
	"default-src 'self'",
	"script-src 'self'",
	"style-src 'self' 'unsafe-inline'",
	"img-src 'self' https://resultados.tse.jus.br",
	"media-src 'self'",
	"font-src 'self'",
	"connect-src 'self'",
	"frame-ancestors 'none'",
].join("; ");

const TIPOS = {
	".css": "text/css; charset=utf-8",
	".js": "text/javascript; charset=utf-8",
	".svg": "image/svg+xml",
	".woff2": "font/woff2",
	".webm": "video/webm",
	".mp4": "video/mp4",
	".jpg": "image/jpeg",
	".jpeg": "image/jpeg",
};

async function htmlDaFixture() {
	const outfile = "/tmp/fixture-pagina.mjs";
	await esbuild.build({
		entryPoints: [join(RAIZ, "scripts/fixture-pagina.ts")],
		bundle: true,
		format: "esm",
		platform: "node",
		outfile,
		logLevel: "silent",
	});
	const modulo = await import(`${pathToFileURL(outfile).href}?t=${Date.now()}`);
	return modulo.htmlFixture(new Date());
}

function servidor(html) {
	return createServer(async (req, res) => {
		const url = new URL(req.url || "/", "http://127.0.0.1");
		if (url.pathname === "/") {
			res.writeHead(200, {
				"content-type": "text/html; charset=utf-8",
				"content-security-policy": CSP,
				"cache-control": "no-store",
			});
			res.end(html);
			return;
		}
		const caminho = normalize(join(PUBLICO, decodeURIComponent(url.pathname)));
		if (!caminho.startsWith(PUBLICO)) {
			res.writeHead(403);
			res.end();
			return;
		}
		try {
			const corpo = await readFile(caminho);
			res.writeHead(200, {
				"content-type": TIPOS[extname(caminho)] || "application/octet-stream",
				"content-security-policy": CSP,
				"cache-control": "no-store",
			});
			res.end(corpo);
		} catch {
			res.writeHead(404);
			res.end();
		}
	});
}

function px(n) {
	return Math.round(n);
}

async function medirPouso(page) {
	return page.evaluate(
		() =>
			new Promise((resolve, reject) => {
				const limite = setTimeout(() => reject(new Error("a faixa não pousou")), 20000);
				const olhar = () => {
					const faixa = document.querySelector(".a-i-faixa");
					const animacao = faixa?.getAnimations().find((item) => {
						const duracao = item.effect?.getTiming?.().duration;
						return duracao === 750;
					});
					if (!animacao || !faixa) {
						requestAnimationFrame(olhar);
						return;
					}
					animacao.finished
						.then(() => {
							clearTimeout(limite);
							const a = faixa.getBoundingClientRect();
							const b = document.querySelector(".a-cabo").getBoundingClientRect();
							resolve({
								dx: a.left - b.left,
								dy: a.top - b.top,
								dw: a.width - b.width,
								dh: a.height - b.height,
							});
						})
						.catch((erro) => {
							clearTimeout(limite);
							reject(erro);
						});
				};
				olhar();
			}),
	);
}

async function esperarRotulo(page) {
	await page.waitForFunction(() => {
		const rotulo = document.querySelector(".a-i-ia");
		if (!rotulo) return false;
		const opacidade = Number(getComputedStyle(rotulo).opacity);
		const caixa = rotulo.getBoundingClientRect();
		return opacidade > 0.5 && caixa.width > 0 && caixa.top >= 0 && caixa.top < innerHeight;
	}, { timeout: 15000 });
}

async function fotosOficiais(page) {
	const srcs = await page.locator(".a-i-rosto").evaluateAll((els) => els.map((el) => el.getAttribute("src")));
	if (!srcs[0]?.includes("280002551544.jpeg") || !srcs[1]?.includes("280002542548.jpeg")) {
		throw new Error(`rostos fora do TSE: ${srcs.join(" | ")}`);
	}
	const videos = await page.locator("video").evaluateAll((els) =>
		els.map((el) => ({
			muted: el.muted && el.hasAttribute("muted"),
			playsinline: el.playsInline && el.hasAttribute("playsinline"),
		})),
	);
	if (videos.length < 2) throw new Error("a vinheta não trouxe os dois vídeos");
	if (videos.some((video) => !video.muted || !video.playsinline)) {
		throw new Error(`vídeo sem muted/playsinline: ${JSON.stringify(videos)}`);
	}
}

function textoRuim(texto) {
	if (texto.includes("undefined") || texto.includes("NaN")) return "undefined ou NaN no texto";
	return "";
}

async function checarPaginaQuieta(page, largura) {
	await page.waitForFunction(() => document.documentElement.dataset.abertura !== "1");
	const dias = await page.locator(".a-dia").count();
	if (dias !== 21) throw new Error(`calendário com ${dias} quadrados`);
	const rola = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1);
	if (rola) throw new Error(`rolagem lateral em ${largura}`);
	const calha = await page.evaluate(() => getComputedStyle(document.documentElement).scrollbarGutter);
	if (!calha.includes("stable")) throw new Error(`scrollbar-gutter: ${calha}`);
	const texto = await page.locator("body").innerText();
	const ruim = textoRuim(texto);
	if (ruim) throw new Error(ruim);
	const detalhe = page.locator("[data-detalhe-vivo]");
	const antes = await detalhe.innerText();
	const outro = page.locator("button.a-pesq:not(.sel)").first();
	await outro.click();
	await page.waitForFunction(
		(textoAntes) => {
			const vivo = document.querySelector("[data-detalhe-vivo]");
			return vivo && vivo.innerText !== textoAntes && !vivo.innerText.includes("undefined");
		},
		antes,
		{ timeout: 3000 },
	);
}

async function focoVisivel(page) {
	await page.locator(".a-marca").click();
	let pesquisa = false;
	let chip = false;
	for (let i = 0; i < 40 && !(pesquisa && chip); i++) {
		await page.keyboard.press("Tab");
		const info = await page.evaluate(() => {
			const el = document.activeElement;
			if (!(el instanceof HTMLElement) || el.tagName !== "BUTTON") return null;
			const estilo = getComputedStyle(el);
			return {
				pesquisa: el.classList.contains("a-pesq"),
				chip: el.getAttribute("aria-pressed") != null,
				solido: estilo.outlineStyle !== "none" && estilo.outlineWidth !== "0px",
			};
		});
		if (!info?.solido) continue;
		if (info.pesquisa) pesquisa = true;
		if (info.chip) chip = true;
	}
	if (!pesquisa || !chip) throw new Error(`foco visível pesquisa=${pesquisa} chip=${chip}`);
}

async function cenario(browser, largura, reduzido) {
	const context = await browser.newContext({
		viewport: { width: largura, height: 900 },
		reducedMotion: reduzido ? "reduce" : "no-preference",
		colorScheme: "light",
	});
	const page = await context.newPage();
	const erros = [];
	page.on("console", (msg) => {
		if (msg.type() === "error") erros.push(msg.text());
	});
	page.on("pageerror", (erro) => erros.push(String(erro)));
	await page.goto("http://127.0.0.1:8765/", { waitUntil: "domcontentloaded" });
	if (reduzido) {
		await page.waitForTimeout(400);
		if (await page.locator(".a-intro").count()) throw new Error("vinheta apareceu com reduzir movimento");
		if (await page.locator("video").count()) throw new Error("vídeo obrigatório com reduzir movimento");
		await checarPaginaQuieta(page, largura);
	} else {
		await esperarRotulo(page);
		await fotosOficiais(page);
		await larguraDaMedia(page);
		const pouso = await medirPouso(page);
		for (const [eixo, valor] of Object.entries(pouso)) {
			if (px(valor) !== 0) throw new Error(`pouso ${eixo}=${valor}px`);
		}
		await checarPaginaQuieta(page, largura);
		await focoVisivel(page);
		await page.locator("[data-rever]").click();
		await page.waitForSelector(".a-intro", { timeout: 3000 });
		await page.keyboard.press("Escape");
		await page.waitForFunction(() => !document.querySelector(".a-intro") && document.documentElement.dataset.abertura !== "1");
	}
	if (erros.length) throw new Error(erros.join(" | "));
	await context.close();
}

async function pularNaVarredura(browser) {
	const context = await browser.newContext({
		viewport: { width: 1440, height: 900 },
		reducedMotion: "no-preference",
		colorScheme: "light",
	});
	const page = await context.newPage();
	const erros = [];
	page.on("pageerror", (erro) => erros.push(String(erro)));
	page.on("console", (msg) => {
		if (msg.type() === "error") erros.push(msg.text());
	});
	await page.goto("http://127.0.0.1:8765/", { waitUntil: "domcontentloaded" });
	await page.waitForFunction(() => {
		const texto = document.querySelector("[data-vf]")?.textContent;
		return texto && texto !== "51,6" && document.documentElement.dataset.abertura === "1";
	}, { timeout: 15000 });
	await page.keyboard.press("Escape");
	await page.waitForTimeout(500);
	const texto = await page.locator("[data-vf]").innerText();
	if (texto !== "51,6") throw new Error(`veredito depois do skip ficou em ${texto}`);
	if (await page.locator(".a-intro").count()) throw new Error("vinheta continuou depois do skip");
	const larguraFaixa = await page.evaluate(() => {
		const faixa = document.querySelector(".a-i-f");
		return faixa ? faixa.style.width : "";
	});
	if (larguraFaixa) throw new Error("a faixa colorida sobreviveu ao skip");
	if (erros.length) throw new Error(erros.join(" | "));
	await context.close();
}

async function larguraDaMedia(page) {
	const largura = await page.locator(".a-i-f").evaluate((el) => el.style.width);
	if (largura !== "51.62%") throw new Error(`campo do Flávio com largura ${largura}`);
}

async function pularCedo(browser, largura, tecla) {
	const context = await browser.newContext({
		viewport: { width: largura, height: 900 },
		reducedMotion: "no-preference",
		colorScheme: "light",
	});
	const page = await context.newPage();
	const erros = [];
	page.on("pageerror", (erro) => erros.push(String(erro)));
	page.on("console", (msg) => {
		if (msg.type() === "error") erros.push(msg.text());
	});
	await page.goto("http://127.0.0.1:8765/", { waitUntil: "domcontentloaded" });
	await page.waitForSelector(".a-intro");
	if (tecla) await page.keyboard.press("Escape");
	else await page.locator(".a-intro").click({ position: { x: 20, y: 20 } });
	await page.waitForFunction(() => !document.querySelector(".a-intro") && document.documentElement.dataset.abertura !== "1", null, {
		timeout: 3000,
	});
	const dias = await page.locator(".a-dia").count();
	if (dias !== 21) throw new Error(`depois do skip, ${dias} quadrados`);
	if (erros.length) throw new Error(erros.join(" | "));
	await context.close();
}

const html = await htmlDaFixture();
const http = servidor(html);
await new Promise((resolve) => http.listen(8765, "127.0.0.1", resolve));
const browser = await chromium.launch({
	executablePath: process.env.CHROME_PATH || "/usr/bin/google-chrome",
	args: ["--no-sandbox", "--disable-dev-shm-usage"],
});
const casos = [
	["1440 movimento", () => cenario(browser, 1440, false)],
	["390 movimento", () => cenario(browser, 390, false)],
	["1440 reduzir", () => cenario(browser, 1440, true)],
	["390 reduzir", () => cenario(browser, 390, true)],
	["1440 skip na varredura", () => pularNaVarredura(browser)],
	["1440 skip tecla", () => pularCedo(browser, 1440, true)],
	["390 skip toque", () => pularCedo(browser, 390, false)],
];
let falhas = 0;
for (const [nome, rodar] of casos) {
	try {
		await rodar();
		console.log(`ok  ${nome}`);
	} catch (erro) {
		falhas += 1;
		console.log(`FALHOU  ${nome}  ${erro instanceof Error ? erro.message : erro}`);
	}
}
await browser.close();
http.close();
console.log(`${casos.length - falhas}/${casos.length} casos ok`);
process.exit(falhas ? 1 : 0);
