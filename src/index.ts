import { nomePoller } from "./config/poller-nome";
import { Pesquisas } from "./pesquisas/pesquisas";
import { PollerApuracao } from "./poller/poller";

export { Pesquisas, PollerApuracao };

/** Cache curto na borda: muitos visitantes não viram uma chamada ao DO cada um. */
const CACHE_API_APURACAO =
	"public, max-age=0, s-maxage=5, must-revalidate";

/** CSP base da spec (D9). */
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

function poller(env: Env) {
	return env.POLLER.getByName(nomePoller(env.ELEICAO_FEDERAL));
}

function comCsp(resposta: Response): Response {
	const headers = new Headers(resposta.headers);
	headers.set("content-security-policy", CSP);
	headers.set("x-frame-options", "DENY");
	return new Response(resposta.body, {
		status: resposta.status,
		statusText: resposta.statusText,
		headers,
	});
}

export default {
	async fetch(request: Request, env: Env): Promise<Response> {
		const url = new URL(request.url);

		if (url.pathname === "/api/apuracao") {
			const estado = await poller(env).obterEstado();
			return Response.json(estado, {
				headers: { "cache-control": CACHE_API_APURACAO },
			});
		}

		if (url.pathname === "/api/historico") {
			const desde = Number(url.searchParams.get("desde")) || 0;
			const hist = await poller(env).obterHistorico(desde);
			return Response.json(hist, {
				headers: { "cache-control": "no-store" },
			});
		}

		if (url.pathname.startsWith("/api/")) {
			return new Response("não achei", { status: 404 });
		}

		return comCsp(await env.ASSETS.fetch(request));
	},
} satisfies ExportedHandler<Env>;
