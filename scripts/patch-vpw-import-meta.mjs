/**
 * Vitest 5 embeds the text `import.meta.url` inside string literals (error hints).
 * `@cloudflare/vitest-pool-workers@0.22.0` rewrites every occurrence via replaceAll,
 * which breaks those strings into `..."createRequire("file:///...")"...` and workerd
 * throws `SyntaxError: Unexpected identifier 'file'`.
 *
 * Official Vitest 5 support is still unreleased (cloudflare/workers-sdk#15500).
 * Until then, rewrite only outside of string/template literals.
 *
 * ponytail: ceiling = string-scanner ignores regex literals / comments; upgrade =
 * drop this script when @cloudflare/vitest-plugin ships Vitest 5 support.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const TARGET = path.join(
	ROOT,
	"node_modules/@cloudflare/vitest-pool-workers/dist/pool/index.mjs",
);

const NEEDLE = [
	"function withImportMetaUrl(contents, url$2) {",
	'\treturn contents.replaceAll("import.meta.url", JSON.stringify(url$2.toString()));',
	"}",
].join("\n");

const MARKER = "/* patched: string-aware import.meta.url rewrite for vitest 5 */";

// Body evaluated by self-check and written into node_modules. Escape carefully:
// in this template literal, \\\\ becomes \\ in the generated JS source (= one backslash).
const BODY = `
${MARKER}
const replacement = JSON.stringify(url$2.toString());
let out = "";
let i = 0;
let quote = null;
let escaped = false;
while (i < contents.length) {
	const ch = contents[i];
	if (quote) {
		out += ch;
		if (escaped) escaped = false;
		else if (ch === "\\\\") escaped = true;
		else if (ch === quote) quote = null;
		i++;
		continue;
	}
	if (ch === '"' || ch === "'" || ch === "\`") {
		quote = ch;
		out += ch;
		i++;
		continue;
	}
	if (contents.startsWith("import.meta.url", i)) {
		out += replacement;
		i += "import.meta.url".length;
		continue;
	}
	out += ch;
	i++;
}
return out;
`.trim();

const REPLACEMENT = `function withImportMetaUrl(contents, url$2) {\n\t${BODY.replaceAll("\n", "\n\t")}\n}`;

function selfCheck() {
	// Evaluate the same body we patch in, so the assert can't drift from the install patch.
	const fn = new Function("contents", "url$2", BODY);
	const sample =
		'const a = import.meta.url; const msg = "createRequire(import.meta.url)";';
	const got = fn(sample, "file:///tmp/x.js");
	const want =
		'const a = "file:///tmp/x.js"; const msg = "createRequire(import.meta.url)";';
	if (got !== want) {
		throw new Error(
			`patch-vpw-import-meta self-check failed:\n got: ${got}\nwant: ${want}`,
		);
	}
}

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
			"[patch-vpw-import-meta] expected SELF proxy not found — update or remove this patch",
		);
	}
	fs.writeFileSync(SELF_TARGET, source.replace(SELF_NEEDLE, SELF_REPLACEMENT));
	console.log("[patch-vpw-import-meta] patched SELF.scheduled");
}

function main() {
	selfCheck();
	patchSelfScheduled();

	if (!fs.existsSync(TARGET)) {
		console.warn(
			`[patch-vpw-import-meta] skip: ${TARGET} not found (optional install?)`,
		);
		return;
	}

	const source = fs.readFileSync(TARGET, "utf8");
	if (source.includes(MARKER)) return;

	if (!source.includes(NEEDLE)) {
		throw new Error(
			"[patch-vpw-import-meta] expected withImportMetaUrl body not found — " +
				"@cloudflare/vitest-pool-workers may have changed; update or remove this patch",
		);
	}

	fs.writeFileSync(TARGET, source.replace(NEEDLE, REPLACEMENT));
	console.log("[patch-vpw-import-meta] patched withImportMetaUrl for vitest 5");
}

main();
