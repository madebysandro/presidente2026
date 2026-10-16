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
		ratelimits: [
			{
				name: "LIMITE_AGENTE_CHAVE",
				namespace_id: "625801",
				simple: { limit: 30, period: 60 },
			},
			{
				name: "LIMITE_AGENTE_IP",
				namespace_id: "625802",
				simple: { limit: 5, period: 60 },
			},
		],
		cache: { enabled: true },
		observability: {
			enabled: true,
			traces: { enabled: true },
		},
	},
});
