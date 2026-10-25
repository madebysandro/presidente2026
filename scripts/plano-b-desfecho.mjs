/** 409 `apuracao_encerrada` é o fim esperado do plano B (#86), não falha. */
export function desfechoDoPost(status, texto) {
	const linha = `${status} ${texto.slice(0, 300)}`;
	if (status >= 200 && status < 300) return { ok: true, mensagem: linha };
	if (status === 409 && erroDoCorpo(texto) === "apuracao_encerrada") {
		return {
			ok: true,
			mensagem: `${linha}\napuração encerrada: o arquivo do 2º turno está congelado, nada a importar`,
		};
	}
	return { ok: false, mensagem: linha };
}

function erroDoCorpo(texto) {
	try {
		return JSON.parse(texto)?.erro;
	} catch {
		return undefined;
	}
}
