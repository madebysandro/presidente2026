export type OpcoesParseCsvTse = {
	manter?: (row: Record<string, string>) => boolean;
};

export function parseCsvTse(
	texto: string,
	opcoes: OpcoesParseCsvTse = {},
): Record<string, string>[] {
	const src = texto.charCodeAt(0) === 0xfeff ? texto.slice(1) : texto;
	const { manter } = opcoes;
	const saida: Record<string, string>[] = [];
	let cabecalho: string[] | null = null;
	let linha: string[] = [];
	let campo = "";
	let aspas = false;

	const fecharLinha = () => {
		linha.push(campo);
		campo = "";
		if (!cabecalho) {
			cabecalho = linha;
			linha = [];
			return;
		}
		if (linha.every((celula) => celula === "")) {
			linha = [];
			return;
		}
		const row: Record<string, string> = {};
		for (let j = 0; j < cabecalho.length; j++) {
			row[cabecalho[j]!] = linha[j] ?? "";
		}
		linha = [];
		if (!manter || manter(row)) saida.push(row);
	};

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
			fecharLinha();
			continue;
		}
		if (c !== "\r") campo += c;
	}
	if (campo.length > 0 || linha.length > 0) {
		fecharLinha();
	}
	return saida;
}
