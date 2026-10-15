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
| `npm run deploy` | `void deploy --platform cloudflare` |

## Vars

| Var | Valor | Nota |
| --- | --- | --- |
| `TSE_BASE` | `https://resultados.tse.jus.br/oficial` | CDN oficial |
| `ELEICAO_FEDERAL` | `6258` | 2º turno Presidente |

## Deploy

- Produção só a partir da `main`, workflow [void-deploy.yml](.github/workflows/void-deploy.yml).
- Secret do repositório: `CLOUDFLARE_API_TOKEN` (Workers Scripts: Edit + recursos ligados). Opcional: `CLOUDFLARE_ACCOUNT_ID`.
- Sem preview de branch.
- Domínio: `presidente2026.win` (`custom_domain`). Sem `workers.dev`.

Docs Void: [Quickstart](https://void.cloud/guide/quickstart), [Cloudflare](https://void.cloud/integrations/cloudflare), [Deployment](https://void.cloud/guide/deployment), [Durable State](https://void.cloud/guide/durable-state).

## Spec

Spec pai: [#1](https://github.com/madebysandro/presidente2026/issues/1). Esqueleto: [#7](https://github.com/madebysandro/presidente2026/issues/7). Migração Void: [#27](https://github.com/madebysandro/presidente2026/issues/27). Protótipo: branch `prototipo/pesquisas`, commit `b1fe8ea` (direção A).
