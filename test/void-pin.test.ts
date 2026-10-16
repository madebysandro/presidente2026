/**
 * Aceite #29: account_id e not_found_handling sobrevivem ao materialize/vitest.
 */
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const ACCOUNT = "aaec42ffcbeebcd4cda5beff4af4c439";

describe("Pin Cloudflare do Void (#29)", () => {
	it("void.config.ts declara account_id e routing.notFound none", () => {
		const cfg = readFileSync("void.config.ts", "utf8");
		expect(cfg).toMatch(
			new RegExp(`account_id:\\s*"${ACCOUNT}"`),
		);
		expect(cfg).toMatch(/notFound:\s*"none"/);
	});

	it("wrangler.vitest.jsonc carrega account_id e not_found_handling none", () => {
		const wrangler = JSON.parse(
			readFileSync("wrangler.vitest.jsonc", "utf8"),
		) as {
			account_id?: string;
			assets?: { not_found_handling?: string };
		};
		expect(wrangler.account_id).toBe(ACCOUNT);
		expect(wrangler.assets?.not_found_handling).toBe("none");
	});
});
