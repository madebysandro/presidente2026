/**
 * CSV do TSE: separador `;`, campos entre aspas, aspas duplicadas,
 * quebra de linha dentro das aspas. O texto já vem em Unicode (windows-1252 decodificado).
 */
export function parseCsv(texto: string): Record<string, string>[] {
	const src = texto.charCodeAt(0) === 0xfeff ? texto.slice(1) : texto;
	const linhas: string[][] = [];
	let linha: string[] = [];
	let campo = "";
	let aspas = false;

	for (let i = 0; i < src.length; i++) {
		const c = src[i]!;
		if (aspas) {
			if (c === '"') {
				if (src[i + 1] === '"') {
					campo += '"';
					i++;
				} else {
					aspas = false;
				}
			} else if (c !== "\r") {
				campo += c;
			}
			continue;
		}
		if (c === '"') {
			aspas = true;
			continue;
		}
		if (c === ";") {
			linha.push(campo);
			campo = "";
			continue;
		}
		if (c === "\n") {
			linha.push(campo);
			linhas.push(linha);
			linha = [];
			campo = "";
			continue;
		}
		if (c !== "\r") campo += c;
	}
	if (campo.length > 0 || linha.length > 0) {
		linha.push(campo);
		linhas.push(linha);
	}

	const cabecalho = linhas[0];
	if (!cabecalho) return [];
	const saida: Record<string, string>[] = [];
	for (let i = 1; i < linhas.length; i++) {
		const cols = linhas[i]!;
		if (cols.every((celula) => celula === "")) continue;
		const row: Record<string, string> = {};
		for (let j = 0; j < cabecalho.length; j++) {
			row[cabecalho[j]!] = cols[j] ?? "";
		}
		saida.push(row);
	}
	return saida;
}
