import { defineConfig } from "void/config";

/**
 * Config do Worker na Void (#27).
 * Docs: https://void.cloud/guide/
 *       https://void.cloud/integrations/cloudflare
 *       https://void.cloud/guide/durable-state
 *       https://void.cloud/guide/deployment
 * Anúncio: https://x.com/Cloudflare/status/2110741488548061546
 */
export default defineConfig({
	// staged é o padrão: tráfego só depois do readiness.
	// --atomic só num deploy com migração de classe de Durable Object.
	deploy: {
		cloudflare: {
			mode: "staged",
		},
	},
	routing: {
		notFound: "none",
		headers: {
			"/*": [
				"Content-Security-Policy: default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' https://resultados.tse.jus.br; media-src 'self'; font-src 'self'; connect-src 'self'; frame-ancestors 'none'",
				"X-Frame-Options: DENY",
				"X-Content-Type-Options: nosniff",
			],
		},
	},
	// vars, limits e compatibility_date ficam só aqui (precedência sobre cloudflare).
	worker: {
		compatibility_date: "2026-08-22",
		vars: {
			TSE_BASE: "https://resultados.tse.jus.br/oficial",
			ELEICAO_FEDERAL: "6258",
		},
		// CSV do TSE (~16,5 MB) não cabe nos 10 ms do Free. Paid: até 5 min por request.
		limits: {
			cpu_ms: 300_000,
		},
	},
	cloudflare: {
		name: "presidente2026",
		account_id: "aaec42ffcbeebcd4cda5beff4af4c439",
		workers_dev: false,
		preview_urls: false,
		routes: [
			{
				pattern: "presidente2026.win",
				custom_domain: true,
			},
		],
		assets: {
			directory: "./public",
			binding: "ASSETS",
			run_worker_first: true,
		},
		// #64: sem LIMITE_AGENTE_CHAVE / LIMITE_AGENTE_IP. O Void 1.1.11
		// não sobe rate limit com pinned secrets. O teto global fica no
		// Durable Object. Os bindings voltam quando o Void suportar isso.
		cache: { enabled: true },
		observability: {
			enabled: true,
			traces: { enabled: true },
		},
	},
});
