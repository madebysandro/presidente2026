import brZerado from "../fixtures/tse-6258-zerado/br.json" with { type: "json" };
import { corpoDoPasso, PASSOS_VIRADA } from "../src/apuracao/noite-sintetica";

/** Corpos que o TSE falso do ensaio serve. O gerador é o da noite sintética já existente. */
export function montarCorpos() {
	return {
		zerado: brZerado,
		viradas: PASSOS_VIRADA.map((passo) => corpoDoPasso(passo)),
		encerrada: corpoDoPasso({
			apurado: 100,
			votos22: 10_000_000,
			votos13: 8_000_000,
			tf: "s",
			pcn: "78,0",
			hora: "22:10:00",
		}),
	};
}
