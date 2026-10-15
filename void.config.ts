import { defineConfig } from "void/config";

/**
 * Migrado do wrangler.jsonc (#27).
 * Docs: https://void.cloud/guide/
 *       https://void.cloud/integrations/cloudflare
 *       https://void.cloud/guide/durable-state
 *       https://void.cloud/guide/deployment
 * Anúncio: https://x.com/Cloudflare/status/2110741488548061546
 */
export default defineConfig({
	deploy: {
		cloudflare: {
			mode: "atomic",
		},
	},
	routing: {
		headers: {
			"/*": [
				"Content-Security-Policy: default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' https://resultados.tse.jus.br; media-src 'self'; font-src 'self'; connect-src 'self'; frame-ancestors 'none'",
				"X-Frame-Options: DENY",
			],
		},
	},
	worker: {
		compatibility_date: "2026-08-22",
		vars: {
			TSE_BASE: "https://resultados.tse.jus.br/oficial",
			ELEICAO_FEDERAL: "6258",
		},
	},
	cloudflare: {
		name: "presidente2026",
		compatibility_date: "2026-08-22",
		workers_dev: false,
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
		vars: {
			TSE_BASE: "https://resultados.tse.jus.br/oficial",
			ELEICAO_FEDERAL: "6258",
		},
		cache: { enabled: true },
		observability: {
			enabled: true,
			traces: { enabled: true },
		},
	},
});
