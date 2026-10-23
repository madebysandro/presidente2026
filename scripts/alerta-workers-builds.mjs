#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

export const TITULO = "Workers Builds falhou na main";

const NOME_CHECK = "Workers Builds: presidente2026";

const CODEOWNERS = join(dirname(fileURLToPath(import.meta.url)), "..", ".github", "CODEOWNERS");

export function decidirAlerta(check, issuesAbertas, dono) {
	if (!falhaNaMain(check)) return { acao: "ignorar" };
	const corpo = montarCorpo(check, dono);
	const aberta = escolherIssueAberta(issuesAbertas);
	if (aberta) return { acao: "comentar", numero: aberta.number, corpo, dono };
	return { acao: "abrir", titulo: TITULO, corpo, dono };
}

export function donoDoRepo(codeowners, repo) {
	let dono = null;
	for (const linha of String(codeowners ?? "").split("\n")) {
		const [padrao, ...donos] = linha.replace(/#.*/, "").trim().split(/\s+/);
		if (padrao !== "*") continue;
		const usuario = donos.find((item) => /^@[^/]+$/.test(item));
		if (usuario) dono = usuario.slice(1);
	}
	if (dono) return dono;
	const doRepo = String(repo ?? "").split("/")[0];
	return doRepo || null;
}

function falhaNaMain(check) {
	return (
		check?.name === NOME_CHECK &&
		check?.conclusion === "failure" &&
		check?.check_suite?.head_branch === "main"
	);
}

function escolherIssueAberta(issuesAbertas) {
	const lista = Array.isArray(issuesAbertas) ? issuesAbertas : [];
	const abertas = lista.filter((issue) => {
		if (!issue || issue.title !== TITULO) return false;
		if (issue.state == null) return true;
		return String(issue.state).toLowerCase() === "open";
	});
	abertas.sort((a, b) => Number(a.number) - Number(b.number));
	return abertas[0];
}

function montarCorpo(check, dono) {
	const sha = check.head_sha ?? check.check_suite?.head_sha ?? "";
	const linhas = [`${TITULO}.`, ""];
	if (dono) {
		linhas.push(`@${dono}, a issue é sua até a triagem. Registre a causa ao fechar.`, "");
	}
	linhas.push(
		`conclusion: ${check.conclusion ?? ""}`,
		`head_sha: ${sha}`,
		`html_url: ${check.html_url ?? ""}`,
		`details_url: ${check.details_url ?? ""}`,
		"",
		"output.summary:",
		valorTexto(check.output?.summary),
	);
	const texto = check.output?.text;
	if (typeof texto === "string" && texto.length > 0) {
		linhas.push("", "output.text:", texto);
	}
	linhas.push(
		"",
		"O log completo da build fica no dashboard da Cloudflare. O resumo do check não inclui esse log.",
	);
	const mensagens = mensagensDeAnotacao(check.anotacoes);
	if (mensagens.length > 0) {
		linhas.push("", "Anotações:");
		for (const mensagem of mensagens) linhas.push(`- ${mensagem}`);
	}
	return linhas.join("\n");
}

function valorTexto(valor) {
	if (typeof valor === "string") return valor;
	if (valor == null) return "";
	return String(valor);
}

function mensagensDeAnotacao(anotacoes) {
	if (!Array.isArray(anotacoes)) return [];
	const mensagens = [];
	for (const item of anotacoes) {
		if (typeof item === "string" && item.length > 0) {
			mensagens.push(item);
			continue;
		}
		if (item && typeof item.message === "string" && item.message.length > 0) {
			mensagens.push(item.message);
		}
	}
	return mensagens;
}

function executarGh(args) {
	return spawnSync("gh", args, {
		encoding: "utf8",
		maxBuffer: 10 * 1024 * 1024,
	});
}

function despejarErro(resultado) {
	const stderr = resultado.stderr?.trim();
	const stdout = resultado.stdout?.trim();
	if (stderr) console.error(stderr);
	if (stdout) console.error(stdout);
	if (resultado.error) console.error(resultado.error.message);
}

function listarIssues(repo) {
	const resultado = executarGh([
		"issue",
		"list",
		"--repo",
		repo,
		"--state",
		"open",
		"--search",
		`${TITULO} in:title`,
		"--json",
		"number,title,state",
		"--limit",
		"20",
	]);
	if (resultado.status !== 0) {
		despejarErro(resultado);
		return null;
	}
	try {
		const lista = JSON.parse(resultado.stdout);
		if (!Array.isArray(lista)) {
			console.error("gh issue list não devolveu uma lista");
			return null;
		}
		return lista;
	} catch {
		console.error("gh issue list devolveu JSON inválido");
		return null;
	}
}

function buscarAnotacoes(repo, id) {
	if (id == null || id === "") return [];
	const resultado = executarGh([
		"api",
		"--paginate",
		`repos/${repo}/check-runs/${id}/annotations`,
	]);
	if (resultado.status !== 0) {
		console.error("anotações indisponíveis");
		return [];
	}
	try {
		const parsed = JSON.parse(resultado.stdout || "[]");
		return Array.isArray(parsed) ? parsed : [];
	} catch {
		return [];
	}
}

function emitir(args, corpo) {
	const dir = mkdtempSync(join(tmpdir(), "alerta-workers-builds-"));
	const arquivo = join(dir, "corpo.txt");
	try {
		writeFileSync(arquivo, corpo, "utf8");
		const resultado = executarGh([...args, "--body-file", arquivo]);
		if (resultado.status !== 0) {
			despejarErro(resultado);
			return false;
		}
		if (resultado.stdout) process.stdout.write(resultado.stdout);
		return true;
	} finally {
		rmSync(dir, { recursive: true, force: true });
	}
}

function atribuir(repo, numero, dono) {
	const resultado = executarGh([
		"issue",
		"edit",
		String(numero),
		"--repo",
		repo,
		"--add-assignee",
		dono,
	]);
	if (resultado.status !== 0) {
		despejarErro(resultado);
		return false;
	}
	return true;
}

function aplicar(repo, decisao) {
	const responsavel = decisao.dono ? ["--assignee", decisao.dono] : [];
	if (decisao.acao === "abrir") {
		return emitir(
			["issue", "create", "--repo", repo, "--title", decisao.titulo, ...responsavel],
			decisao.corpo,
		);
	}
	if (decisao.acao === "comentar") {
		const comentou = emitir(
			["issue", "comment", String(decisao.numero), "--repo", repo],
			decisao.corpo,
		);
		if (!comentou) return false;
		return decisao.dono ? atribuir(repo, decisao.numero, decisao.dono) : true;
	}
	return true;
}

function lerCodeowners(caminho) {
	try {
		return readFileSync(caminho, "utf8");
	} catch {
		return null;
	}
}

function lerCheck(caminho) {
	let bruto;
	try {
		bruto = readFileSync(caminho, "utf8");
	} catch (erro) {
		console.error(erro instanceof Error ? erro.message : String(erro));
		return null;
	}
	try {
		const valor = JSON.parse(bruto);
		if (!valor || typeof valor !== "object" || Array.isArray(valor)) {
			console.error("payload inválido");
			return null;
		}
		return valor;
	} catch {
		console.error("payload inválido");
		return null;
	}
}

function main() {
	const caminho = process.env.CHECK_RUN_PATH;
	if (!caminho) {
		console.log("CHECK_RUN_PATH ausente");
		process.exit(0);
	}
	const check = lerCheck(caminho);
	if (!check) process.exit(1);
	const repo = process.env.GITHUB_REPOSITORY;
	if (!repo) {
		console.error("GITHUB_REPOSITORY ausente");
		process.exit(1);
	}
	const issues = listarIssues(repo);
	if (!issues) process.exit(1);
	check.anotacoes = buscarAnotacoes(repo, check.id);
	const dono = donoDoRepo(lerCodeowners(process.env.CODEOWNERS_PATH || CODEOWNERS), repo);
	const decisao = decidirAlerta(check, issues, dono);
	console.log(decisao.acao);
	if (decisao.acao === "ignorar") process.exit(0);
	if (!aplicar(repo, decisao)) process.exit(1);
}

function executadoDireto() {
	const entrada = process.argv[1];
	if (!entrada) return false;
	try {
		return realpathSync(fileURLToPath(import.meta.url)) === realpathSync(entrada);
	} catch {
		return false;
	}
}

if (executadoDireto()) main();
