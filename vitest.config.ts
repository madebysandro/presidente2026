import { readFileSync } from "node:fs";
import { cloudflareTest } from "@cloudflare/vitest-pool-workers";
import { configDefaults, defineConfig } from "vitest/config";

const miniflare = JSON.parse(readFileSync("./worker.vitest.json", "utf8"));

export default defineConfig({
	assetsInclude: ["**/*.zip"],
	plugins: [
		cloudflareTest({
			// Bundle do `vite build`. Opções gravadas por scripts/preparar-teste-void.mjs.
			main: "./dist/ssr/index.js",
			miniflare,
		}),
	],
	test: {
		setupFiles: ["./test/setup.ts"],
		exclude: [
			...configDefaults.exclude,
			"scripts/modo-deploy.test.mjs",
			"scripts/pre-deploy.test.mjs",
		],
	},
});
