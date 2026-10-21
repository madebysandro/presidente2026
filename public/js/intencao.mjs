function arred2(n) {
	return Math.round((n + Number.EPSILON) * 100) / 100;
}

function arred1(n) {
	return Math.round((n + Number.EPSILON) * 10) / 10;
}

function somarDias(iso, dias) {
	const [ano, mes, dia] = iso.split("-").map(Number);
	const utc = new Date(Date.UTC(ano, mes - 1, dia + dias));
	const y = utc.getUTCFullYear();
	const m = String(utc.getUTCMonth() + 1).padStart(2, "0");
	const d = String(utc.getUTCDate()).padStart(2, "0");
	return `${y}-${m}-${d}`;
}

function mediaNoDia(pesquisas, data) {
	const desde = somarDias(data, -14);
	const ult = new Map();
	const ordenadas = [...pesquisas].sort(
		(a, b) => a.campoFim.localeCompare(b.campoFim) || a.registro.localeCompare(b.registro),
	);
	for (const pesquisa of ordenadas) {
		if (pesquisa.campoFim > data || pesquisa.campoFim <= desde) continue;
		const base = pesquisa.flavio + pesquisa.lula;
		if (!(base > 0)) continue;
		ult.set(pesquisa.cnpj, { pesquisa, vf: (pesquisa.flavio / base) * 100 });
	}
	const lista = [...ult.values()].sort(
		(a, b) =>
			a.pesquisa.campoFim.localeCompare(b.pesquisa.campoFim) ||
			a.pesquisa.registro.localeCompare(b.pesquisa.registro),
	);
	if (!lista.length) return null;
	const vfRaw = lista.reduce((soma, item) => soma + item.vf, 0) / lista.length;
	const margem = arred1(lista.reduce((soma, item) => soma + item.pesquisa.margem, 0) / lista.length);
	return {
		data,
		vf: arred2(vfRaw),
		vl: arred2(100 - vfRaw),
		margem,
		n: lista.length,
	};
}

export function serieIntencao(pesquisas, dataRef) {
	if (!pesquisas.length) return [];
	let inicio = pesquisas[0].campoFim;
	for (const pesquisa of pesquisas) {
		if (pesquisa.campoFim < inicio) inicio = pesquisa.campoFim;
	}
	if (inicio > dataRef) return [];
	const pontos = [];
	for (let data = inicio; data <= dataRef; data = somarDias(data, 1)) {
		const media = mediaNoDia(pesquisas, data);
		if (!media) continue;
		pontos.push(media);
	}
	return pontos;
}
