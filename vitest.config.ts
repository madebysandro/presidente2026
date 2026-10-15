import { cloudflareTest } from "@cloudflare/vitest-pool-workers";
import { defineConfig } from "vitest/config";

export default defineConfig({
	plugins: [
		cloudflareTest({
			// Gerado por scripts/ensure-void-wrangler.mjs (vite sobrescreve .void-wrangler.jsonc).
			wrangler: { configPath: "./wrangler.vitest.jsonc" },
		}),
	],
	test: {
		setupFiles: ["./test/setup.ts"],
	},
});
