/**
 * `SELF.scheduled` do `@cloudflare/vitest-pool-workers` não chama o handler
 * `scheduled` do Worker. O remendo troca o proxy para disparar o cron pelo
 * entrypoint, como em produção.
 *
 * ponytail: ceiling = depende do texto exato do pool; upgrade = remover quando o
 * pool expuser `scheduled` no SELF.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SELF_TARGET = path.join(
	ROOT,
	"node_modules/@cloudflare/vitest-pool-workers/dist/worker/lib/cloudflare/test-internal.mjs",
);
const SELF_MARKER = "async function scheduledViaEntrypoint";
const SELF_NEEDLE = [
	"const SELF = new Proxy({}, { get(_, p) {",
	"	const target = exports.default;",
	"	const value = target[p];",
	'	return typeof value === "function" ? value.bind(target) : value;',
	"} });",
].join("\n");
const SELF_REPLACEMENT = [
	"const SELF = new Proxy({}, { get(_, p) {",
	"	const target = exports.default;",
	"	if (p === \"scheduled\") return scheduledViaEntrypoint;",
	"	const value = target[p];",
	'	return typeof value === "function" ? value.bind(target) : value;',
	"} });",
	"async function scheduledViaEntrypoint(options) {",
	"	const ctx = createExecutionContext();",
	"	const Wrapper = createWorkerEntrypointWrapper(\"default\");",
	"	const entry = new Wrapper(ctx, env$1);",
	"	await entry.scheduled(createScheduledController(options));",
	"	await waitOnExecutionContext(ctx);",
	"	return { outcome: \"ok\", noRetry: false };",
	"}",
].join("\n");

function patchSelfScheduled() {
	if (!fs.existsSync(SELF_TARGET)) return;
	const source = fs.readFileSync(SELF_TARGET, "utf8");
	if (source.includes(SELF_MARKER)) return;
	if (!source.includes(SELF_NEEDLE)) {
		throw new Error(
			"[patch-vpw-self-scheduled] expected SELF proxy not found — update or remove this patch",
		);
	}
	fs.writeFileSync(SELF_TARGET, source.replace(SELF_NEEDLE, SELF_REPLACEMENT));
	console.log("[patch-vpw-self-scheduled] patched SELF.scheduled");
}

patchSelfScheduled();
