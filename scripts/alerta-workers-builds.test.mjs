import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { chmodSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { decidirAlerta, TITULO } from "./alerta-workers-builds.mjs";

const SHA = "0123456789abcdef0123456789abcdef01234567";
const HTML = "https://github.com/madebysandro/presidente2026/runs/4242";
const DASHBOARD = "https://dash.cloudflare.com/accounts/abc/workers/builds/42";
const RESUMO = "Build ID: 9f3c";
const SCRIPT = fileURLToPath(new URL("./alerta-workers-builds.mjs", import.meta.url));

function checkMain(overrides = {}) {
	return {
		id: 4242,
		name: "Workers Builds: presidente2026",
		conclusion: "failure",
		head_sha: SHA,
		html_url: HTML,
		details_url: DASHBOARD,
		output: { summary: RESUMO, text: null },
		check_suite: { head_branch: "main", head_sha: SHA },
		anotacoes: [],
		...overrides,
	};
}

test("ignora branch de pull request", () => {
	const decisao = decidirAlerta(
		checkMain({ check_suite: { head_branch: "cursor/exemplo", head_sha: SHA } }),
		[],
	);
	assert.equal(decisao.acao, "ignorar");
});

test("ignora success na main", () => {
	const decisao = decidirAlerta(checkMain({ conclusion: "success" }), []);
	assert.equal(decisao.acao, "ignorar");
});

test("ignora outro check na main", () => {
	const decisao = decidirAlerta(checkMain({ name: "CI" }), []);
	assert.equal(decisao.acao, "ignorar");
});

test("abre quando nenhuma issue com o titulo esta aberta", () => {
	const decisao = decidirAlerta(checkMain(), [
		{ number: 3, title: "Outro alerta", state: "OPEN" },
		{ number: 4, title: TITULO, state: "CLOSED" },
	]);
	assert.equal(decisao.acao, "abrir");
	assert.equal(decisao.titulo, TITULO);
	assert.ok(decisao.corpo.includes(DASHBOARD));
	assert.ok(decisao.corpo.includes(RESUMO));
	assert.ok(decisao.corpo.includes("failure"));
	assert.ok(decisao.corpo.includes(SHA));
	assert.ok(decisao.corpo.includes(HTML));
	assert.ok(decisao.corpo.includes("O log completo da build fica no dashboard da Cloudflare."));
	assert.ok(decisao.corpo.includes("O resumo do check não inclui esse log."));
	assert.equal(decisao.corpo.includes("\u2014"), false);
	assert.equal(decisao.corpo.includes("\u2013"), false);
});

test("comenta quando uma issue aberta tem o titulo", () => {
	for (const state of ["open", "OPEN"]) {
		const decisao = decidirAlerta(checkMain(), [
			{ number: 80, title: TITULO, state: "CLOSED" },
			{ number: 70, title: TITULO, state },
		]);
		assert.equal(decisao.acao, "comentar");
		assert.equal(decisao.numero, 70);
		assert.ok(decisao.corpo.includes(DASHBOARD));
		assert.ok(decisao.corpo.includes(RESUMO));
	}
	const duas = decidirAlerta(checkMain(), [
		{ number: 90, title: TITULO, state: "OPEN" },
		{ number: 70, title: TITULO, state: "OPEN" },
	]);
	assert.equal(duas.acao, "comentar");
	assert.equal(duas.numero, 70);
});

test("inclui output.text quando e texto e as mensagens de anotacao", () => {
	const decisao = decidirAlerta(
		checkMain({
			output: { summary: RESUMO, text: "linha do text" },
			anotacoes: [{ message: "exit 1 no deploy" }, { message: "" }, "texto solto"],
		}),
		[],
	);
	assert.equal(decisao.acao, "abrir");
	assert.ok(decisao.corpo.includes("linha do text"));
	assert.ok(decisao.corpo.includes("exit 1 no deploy"));
	assert.ok(decisao.corpo.includes("texto solto"));
});

test("omite output.text vazio e anotacoes que nao sao lista", () => {
	const decisao = decidirAlerta(
		checkMain({
			output: { summary: RESUMO, text: "" },
			anotacoes: { message: "mensagem-fora-da-lista" },
		}),
		[],
	);
	assert.equal(decisao.corpo.includes("output.text:"), false);
	assert.equal(decisao.corpo.includes("mensagem-fora-da-lista"), false);
});

function prepararGh(script) {
	const dir = mkdtempSync(join(tmpdir(), "alerta-gh-"));
	const bin = join(dir, "bin");
	mkdirSync(bin);
	const gh = join(bin, "gh");
	const log = join(dir, "gh.log");
	writeFileSync(gh, script);
	chmodSync(gh, 0o755);
	return { dir, bin, log };
}

const GH_FALSO = `#!/bin/sh
printf '%s\\n' "$*" >> "$GH_LOG"
prev=""
for arg in "$@"; do
  if [ "$prev" = "--body-file" ]; then
    printf '%s\\n' "BODY<<" >> "$GH_LOG"
    cat "$arg" >> "$GH_LOG"
    printf '\\n>>BODY\\n' >> "$GH_LOG"
  fi
  prev="$arg"
done
if [ "$1" = "api" ]; then
  if [ "$GH_API_FAIL" = "1" ]; then
    echo "api down" >&2
    exit 1
  fi
  echo '[{"message":"anotacao do deploy"}]'
  exit 0
fi
if [ "$1" = "issue" ] && [ "$2" = "list" ]; then
  printf '%s' "$GH_ISSUES"
  exit 0
fi
if [ "$1" = "issue" ] && [ "$2" = "create" ]; then
  if [ "$GH_WRITE_FAIL" = "1" ]; then
    echo "create falhou" >&2
    exit 1
  fi
  echo "https://github.com/madebysandro/presidente2026/issues/71"
  exit 0
fi
if [ "$1" = "issue" ] && [ "$2" = "comment" ]; then
  echo "https://github.com/madebysandro/presidente2026/issues/70#issuecomment-1"
  exit 0
fi
echo "comando inesperado: $*" >&2
exit 1
`;

function rodarCli({ check, env = {} }) {
	const falso = prepararGh(GH_FALSO);
	const ambiente = {
		...process.env,
		PATH: `${falso.bin}:/usr/bin:/bin`,
		GH_LOG: falso.log,
		GITHUB_REPOSITORY: "madebysandro/presidente2026",
		GH_ISSUES: "[]",
		GH_API_FAIL: "",
		GH_WRITE_FAIL: "",
		...env,
	};
	if (!Object.prototype.hasOwnProperty.call(env, "CHECK_RUN_PATH")) {
		if (check === undefined) {
			delete ambiente.CHECK_RUN_PATH;
		} else {
			const arquivo = join(falso.dir, "check.json");
			writeFileSync(arquivo, typeof check === "string" ? check : JSON.stringify(check));
			ambiente.CHECK_RUN_PATH = arquivo;
		}
	}
	const resultado = spawnSync(process.execPath, [SCRIPT], {
		env: ambiente,
		encoding: "utf8",
	});
	let log = "";
	try {
		log = readFileSync(falso.log, "utf8");
	} catch {
		log = "";
	} finally {
		rmSync(falso.dir, { recursive: true, force: true });
	}
	return { ...resultado, log };
}

test("nao chama gh sem CHECK_RUN_PATH", async () => {
	const resultado = await rodarCli({ check: undefined });
	assert.equal(resultado.status, 0);
	assert.match(resultado.stdout, /CHECK_RUN_PATH ausente/);
	assert.equal(resultado.log, "");
});

test("payload invalido sai 1 sem chamar gh", async () => {
	const resultado = await rodarCli({ check: "{nao e json" });
	assert.equal(resultado.status, 1);
	assert.match(resultado.stderr, /payload inválido/);
	assert.equal(resultado.log, "");
});

test("cli abre issue e leva o summary e a anotacao", async () => {
	const resultado = await rodarCli({ check: checkMain() });
	assert.equal(resultado.status, 0);
	assert.match(resultado.stdout, /^abrir\n/);
	assert.match(resultado.log, /Workers Builds falhou na main in:title/);
	assert.match(resultado.log, /repos\/madebysandro\/presidente2026\/check-runs\/4242\/annotations/);
	assert.match(resultado.log, /issue create/);
	assert.match(resultado.log, new RegExp(DASHBOARD.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
	assert.match(resultado.log, /Build ID: 9f3c/);
	assert.match(resultado.log, /anotacao do deploy/);
});

test("cli comenta na issue aberta", async () => {
	const resultado = await rodarCli({
		check: checkMain(),
		env: {
			GH_ISSUES: JSON.stringify([{ number: 70, title: TITULO, state: "OPEN" }]),
		},
	});
	assert.equal(resultado.status, 0);
	assert.match(resultado.stdout, /^comentar\n/);
	assert.match(resultado.log, /issue comment 70/);
	assert.doesNotMatch(resultado.log, /issue create/);
});

test("cli segue sem anotacoes quando a api falha", async () => {
	const resultado = await rodarCli({
		check: checkMain(),
		env: { GH_API_FAIL: "1" },
	});
	assert.equal(resultado.status, 0);
	assert.match(resultado.stdout, /^abrir\n/);
	assert.match(resultado.stderr, /anotações indisponíveis/);
	assert.match(resultado.log, /issue create/);
});

test("cli sai 1 quando o gh nao consegue abrir a issue", async () => {
	const resultado = await rodarCli({
		check: checkMain(),
		env: { GH_WRITE_FAIL: "1" },
	});
	assert.equal(resultado.status, 1);
	assert.match(resultado.stdout, /^abrir\n/);
});

test("cli ignora success e branch de pull request sem escrever issue", async () => {
	const success = await rodarCli({ check: checkMain({ conclusion: "success" }) });
	assert.equal(success.status, 0);
	assert.match(success.stdout, /^ignorar\n/);
	assert.doesNotMatch(success.log, /issue create/);
	assert.doesNotMatch(success.log, /issue comment/);

	const pr = await rodarCli({
		check: checkMain({ check_suite: { head_branch: "cursor/exemplo", head_sha: SHA } }),
	});
	assert.equal(pr.status, 0);
	assert.match(pr.stdout, /^ignorar\n/);
	assert.doesNotMatch(pr.log, /issue create/);
	assert.doesNotMatch(pr.log, /issue comment/);
});
