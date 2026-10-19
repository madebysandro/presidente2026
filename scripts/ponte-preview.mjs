import { copyFileSync, existsSync, mkdirSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { RAIZ } from "./config-do-build.mjs";

export const RELATIVO_PONTE = join(".wrangler", "deploy", "config.json");
export const RELATIVO_STASH = join(".void", "preview-deploy-config.json");

export function objetoVazio(valor) {
	return (
		valor !== null &&
		typeof valor === "object" &&
		!Array.isArray(valor) &&
		Object.keys(valor).length === 0
	);
}

function lerJson(caminho) {
	try {
		return { ok: true, json: JSON.parse(readFileSync(caminho, "utf8")) };
	} catch {
		return { ok: false, erros: [`${caminho} não é JSON`] };
	}
}

export function conferirPonte(raiz) {
	const ponte = join(raiz, RELATIVO_PONTE);
	if (!existsSync(ponte)) {
		return {
			ok: false,
			erros: [
				`${RELATIVO_PONTE} ausente (o Void esconde a ponte no fim do vite build; o npm run build precisa regravá-la, senão o wrangler preview lê config vazia)`,
			],
		};
	}
	const lida = lerJson(ponte);
	if (!lida.ok) return lida;
	if (typeof lida.json?.configPath !== "string" || lida.json.configPath.length === 0) {
		return { ok: false, erros: [`${RELATIVO_PONTE} sem configPath`] };
	}
	const alvo = resolve(dirname(ponte), lida.json.configPath);
	if (!existsSync(alvo)) {
		return { ok: false, erros: [`${RELATIVO_PONTE} aponta para ${alvo}, que não existe`] };
	}
	const config = lerJson(alvo);
	if (!config.ok) return config;
	if (!objetoVazio(config.json.previews)) {
		return {
			ok: false,
			erros: [
				`${alvo} previews=${JSON.stringify(config.json.previews)} (quer {}; o wrangler preview lê este arquivo pela ponte)`,
			],
		};
	}
	return { ok: true, ponte, alvo, json: config.json };
}

export function restaurarPonte(raiz) {
	const ponte = join(raiz, RELATIVO_PONTE);
	if (!existsSync(ponte)) {
		const stash = join(raiz, RELATIVO_STASH);
		if (!existsSync(stash)) {
			return {
				ok: false,
				erros: [`falta ${RELATIVO_PONTE} e o stash ${RELATIVO_STASH}`],
			};
		}
		mkdirSync(dirname(ponte), { recursive: true });
		copyFileSync(stash, ponte);
	}
	return conferirPonte(raiz);
}

function main() {
	const resultado = restaurarPonte(RAIZ);
	if (!resultado.ok) {
		for (const erro of resultado.erros) console.error(erro);
		process.exit(1);
	}
	console.log(`ponte de preview ok (${RELATIVO_PONTE} -> ${resultado.alvo})`);
}

const executavel = process.argv[1];
if (executavel && import.meta.url === pathToFileURL(resolve(executavel)).href) {
	main();
}
