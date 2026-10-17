import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { acharConfigDoBuild, RAIZ } from "./config-do-build.mjs";

export const bindingsRecusados = ["ratelimits"];

const MOTIVO =
	"o Void 1.1.11 não sobe esse binding com pinned secrets; bindingsFromOutput cai no default do switch";

const MOTIVO_PREVIEWS =
	"um bloco previews, mesmo vazio, faz o wrangler preview publicar URL de branch e outro namespace de Durable Object; o desligamento é previews_enabled no Workers Builds";

function propriedadeNoConfig(chave, texto) {
	const literal = chave.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
	return new RegExp(`${literal}\\s*:`).test(texto);
}

export function recusarBindings({ configText, lock, buildJson }) {
	const erros = [];
	for (const chave of bindingsRecusados) {
		if (typeof configText === "string" && propriedadeNoConfig(chave, configText)) {
			erros.push(
				`void.config.ts declara ${chave} (${MOTIVO}; o teto do agente fica no Durable Object até o Void suportar isso)`,
			);
		}
		if (
			lock?.source?.[chave] != null ||
			lock?.resolved?.[chave] != null ||
			(typeof lock?.text === "string" && lock.text.includes(`"${chave}"`))
		) {
			erros.push(
				`void.lock.json ainda tem ${chave} (o build materializa o lock a partir do void.config.ts; no Void 1.1.11 o \`void prepare\` só gera \`.void/\`)`,
			);
		}
		if (buildJson != null && Object.hasOwn(buildJson, chave)) {
			const valor = buildJson[chave];
			if (!(Array.isArray(valor) && valor.length === 0)) {
				erros.push(
					`${chave}=${JSON.stringify(valor)} no JSON do Worker (quer ausente ou []; ${MOTIVO})`,
				);
			}
		}
	}
	if (erros.length === 0) return { ok: true };
	return { ok: false, erros };
}

export function recusarPreviews({ configText, lock, buildJson }) {
	const erros = [];
	if (typeof configText === "string" && propriedadeNoConfig("previews", configText)) {
		erros.push(`void.config.ts declara previews (${MOTIVO_PREVIEWS})`);
	}
	if (
		lock?.source?.previews != null ||
		lock?.resolved?.previews != null ||
		(typeof lock?.text === "string" && lock.text.includes('"previews"'))
	) {
		erros.push(`void.lock.json ainda tem previews (${MOTIVO_PREVIEWS})`);
	}
	if (buildJson != null && Object.hasOwn(buildJson, "previews")) {
		erros.push(
			`previews=${JSON.stringify(buildJson.previews)} no JSON do Worker (${MOTIVO_PREVIEWS})`,
		);
	}
	if (erros.length === 0) return { ok: true };
	return { ok: false, erros };
}

function main() {
	const configText = readFileSync(join(RAIZ, "void.config.ts"), "utf8");
	const lock = JSON.parse(readFileSync(join(RAIZ, "void.lock.json"), "utf8"));
	const build = acharConfigDoBuild(join(RAIZ, "dist/ssr"));
	const entrada = {
		configText,
		lock,
		buildJson: build.json,
	};
	const erros = [recusarBindings(entrada), recusarPreviews(entrada)].flatMap(
		(resultado) => (resultado.ok ? [] : resultado.erros),
	);
	if (erros.length > 0) {
		for (const erro of erros) console.error(erro);
		process.exit(1);
	}
	console.log("pre-deploy ok");
}

const executavel = process.argv[1];
if (executavel && import.meta.url === pathToFileURL(resolve(executavel)).href) {
	main();
}
