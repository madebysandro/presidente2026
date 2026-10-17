import { existsSync, readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

export const RAIZ = join(dirname(fileURLToPath(import.meta.url)), "..");

function falha(mensagem) {
	console.error(mensagem);
	process.exit(1);
}

export function acharConfigDoBuild(dir) {
	if (!existsSync(dir)) falha(`config do build: falta ${dir}`);
	const achados = [];
	for (const nome of readdirSync(dir)) {
		if (!nome.endsWith(".json")) continue;
		const caminho = join(dir, nome);
		let json;
		try {
			json = JSON.parse(readFileSync(caminho, "utf8"));
		} catch {
			continue;
		}
		if (
			json &&
			json.name === "presidente2026" &&
			json.assets &&
			typeof json.main === "string"
		) {
			achados.push({ caminho, json, dir: dirname(caminho) });
		}
	}
	if (achados.length !== 1) {
		falha(
			`config do build: esperava 1 JSON do Worker em ${dir}, achei ${achados.length}`,
		);
	}
	return achados[0];
}
