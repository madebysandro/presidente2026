[![CI](https://github.com/madebysandro/presidente2026/actions/workflows/ci.yml/badge.svg?branch=main)](https://github.com/madebysandro/presidente2026/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/github/license/madebysandro/presidente2026)](./LICENSE)
[![Site](https://img.shields.io/website?url=https%3A%2F%2Fpresidente2026.win&up_message=online&down_message=offline&label=site)](https://presidente2026.win)

[![Node](https://img.shields.io/badge/node-24.x-339933?logo=nodedotjs&logoColor=white)](https://nodejs.org/)
[![Void](https://img.shields.io/badge/Void-Cloudflare-F38020?logo=cloudflare&logoColor=white)](https://void.cloud)
[![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Vitest](https://img.shields.io/badge/tested%20with-Vitest-6E9F18?logo=vitest&logoColor=white)](https://vitest.dev/)

# Presidente 2026 · 2º turno

Site público em **[https://presidente2026.win](https://presidente2026.win)** — pesquisas e apuração nacional do **Presidente** no 2º turno (eleição TSE `6258`).

O painel do 1º turno continua em [apuracao.madebysandro.app](https://apuracao.madebysandro.app) (outro produto/repo).

Base em **[Void](https://void.cloud)** (Vite + Workers). Config: `void.config.ts` + `void.lock.json`.

## Estado atual

- Worker `presidente2026` no domínio `presidente2026.win` (`workers_dev` desligado).
- Poller Durable Object por eleição (`ele-6258`), ciclo mínimo só Presidente `br`.
- Durable Object `Pesquisas` (SQLite) vazio, com RPC de sanidade.
- Página pública placeholder (“Em breve”) + CSP base.
- `GET /api/apuracao` e `GET /api/historico` reaproveitam o poller educado (ETag, escada, backoff).

## Desenvolvimento

Requer **Node.js 24.x** (Void 1.1.11).

```bash
git clone https://github.com/madebysandro/presidente2026.git
cd presidente2026
npm ci
npm test
npm run build
npm run dev
```

| Script | O que faz |
| --- | --- |
| `npm test` | Gera `.void-wrangler.jsonc` + Vitest (`vitest-pool-workers`), TSE falso via MSW |
| `npm run build` | `tsc --noEmit` + `vite build` (Void) |
| `npm run dev` | `vite` com `voidPlugin` |
| `npm run deploy` | `void deploy --platform cloudflare` (readiness + rollback do Void) |
| `npm run deploy:wrangler` | Fallback: `wrangler deploy -c dist/ssr/wrangler.json` (após `npm run build`) |

## Vars

| Var | Valor | Nota |
| --- | --- | --- |
| `TSE_BASE` | `https://resultados.tse.jus.br/oficial` | CDN oficial |
| `ELEICAO_FEDERAL` | `6258` | 2º turno Presidente |

## Deploy

Produção só na `main`, via **Cloudflare Workers Builds** (repo conectado no painel; sem GitHub Actions de deploy).

`npm run deploy` usa `void deploy --platform cloudflare` porque o Void faz verify do Worker existente, readiness check e rollback se a ativação falhar. O fallback seguro (sem readiness do Void) é `npm run deploy:wrangler` após `npm run build`, ou seja `npx wrangler deploy -c dist/ssr/wrangler.json`.

`routing.notFound` fica em `"none"` para o `createAssetFallback` do Void não trocar GET `/api/*` 404 por `index.html` (modo SPA padrão quando só há rotas de API).

### account_id e token (Void verify)

O `void.config.ts` fixa `cloudflare.account_id` (`aaec42ffcbeebcd4cda5beff4af4c439`). Só o lock não basta: o Void materializa a config a partir do bloco `cloudflare` e descarta `account_id` que exista só no lock. Sem pin na config, o CI não-interativo para antes do verify (seleção de account / `CLOUDFLARE_ACCOUNT_ID`).

A string `Could not verify existing Cloudflare Worker` só aparece **depois** do account resolvido: o Void chama `cf workers deployments list` / `versions get` (e, com DO migrations, ainda lê o script). Qualquer falha nessa leitura — token sem escopo, account errado, nome do Worker, rede — vira essa mensagem. Pin do `account_id` é necessário, mas não prova sozinho que o token do Builds consegue as leituras.

No Workers Builds o API token do Build Configuration autentica o deploy command como `CLOUDFLARE_API_TOKEN` (Void/`cf` leem essa var; com token presente o `whoami` é pulado). Uma build variable com o mesmo nome **substitui** o token injetado — só use se o log do Builds mostrar `deployments`/`versions` falhando com o token do painel.

Para o gate de verify, o código do Void precisa conseguir ler deployments/versions/scripts: na prática **Account → Workers Scripts → Edit**. Account Settings Read não é consultado nesse passo. O token padrão “Create new token” do Builds já traz Workers Scripts Edit (e também Account Settings Read + Zone Workers Routes Edit, úteis no publish de rota/`presidente2026.win` depois do verify). Sufficiency do token do Builds fica **não provada** até um log de build mostrar essas leituras OK + readiness; se falhar, leia o stderr do passo de deploy antes de criar token custom.

### Trigger de produção

| Setting | Agora (wrangler, site no ar) | Alvo a provar no próximo Retry |
| --- | --- | --- |
| Git branch | `main` | `main` |
| Root directory | `/` | `/` |
| Build command | `npm run build` | `npm run build` |
| Deploy command | `npx wrangler deploy -c dist/ssr/wrangler.json` | `npx void deploy --platform cloudflare` (ou `npm run deploy`) |
| Node.js | `24.21` ([`.nvmrc`](.nvmrc)) | igual |
| Preview builds | desligado | desligado |
| API token | token do Builds | igual (Create new token se stale) |

Workers Builds instala deps do lockfile antes do build; não precisa de `npm ci` no Build command.

Não dá para ter log verde de `void deploy` com o Deploy command ainda em wrangler: o flip do comando **é** o experimento. Em falha, volte ao wrangler e Retry (site volta pelo deploy wrangler).

#### Cliques no dashboard (Sandro)

1. Cloudflare dashboard → Workers & Pages → Worker `presidente2026` → **Settings** → **Builds**.
2. Em **Build configuration** → **API token**: confirme o token ativo. Se o build falhou com auth/verify e o token parece antigo, **Create new token** (Workers Scripts Edit no padrão) e salve.
3. Em Deploy command, troque `npx wrangler deploy -c dist/ssr/wrangler.json` por `npx void deploy --platform cloudflare` e salve → **Retry build** (trigger `0eac68b6-…`).
4. No log desse build: confirme verify (`deployments`/`versions`) + readiness. Se OK, mantenha o comando alvo.
5. Se falhar: coloque de volta `npx wrangler deploy -c dist/ssr/wrangler.json`, **Retry build**, e só então considere token custom / escopos a partir do stderr (lembre: variável `CLOUDFLARE_API_TOKEN` substitui o token do passo 2).

Sem preview de branch. Domínio: `presidente2026.win` (`custom_domain`). Sem `workers.dev`.

Docs Void: [Quickstart](https://void.cloud/guide/quickstart), [Cloudflare](https://void.cloud/integrations/cloudflare), [Deployment](https://void.cloud/guide/deployment), [Durable State](https://void.cloud/guide/durable-state).

## Spec

Spec pai: [#1](https://github.com/madebysandro/presidente2026/issues/1). Esqueleto: [#7](https://github.com/madebysandro/presidente2026/issues/7). Migração Void: [#27](https://github.com/madebysandro/presidente2026/issues/27). Protótipo: branch `prototipo/pesquisas`, commit `b1fe8ea` (direção A).
