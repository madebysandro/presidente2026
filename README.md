[![CI](https://github.com/madebysandro/presidente2026/actions/workflows/ci.yml/badge.svg?branch=main)](https://github.com/madebysandro/presidente2026/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/github/license/madebysandro/presidente2026)](./LICENSE)
[![Site](https://img.shields.io/website?url=https%3A%2F%2Fpresidente2026.win&up_message=online&down_message=offline&label=site)](https://presidente2026.win)

[![Node](https://img.shields.io/badge/node-22.x-339933?logo=nodedotjs&logoColor=white)](https://nodejs.org/)
[![Cloudflare Workers](https://img.shields.io/badge/Cloudflare-Workers-F38020?logo=cloudflare&logoColor=white)](https://developers.cloudflare.com/workers/)
[![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Vitest](https://img.shields.io/badge/tested%20with-Vitest-6E9F18?logo=vitest&logoColor=white)](https://vitest.dev/)

# Presidente 2026 · 2º turno

Site público em **[https://presidente2026.win](https://presidente2026.win)** — pesquisas e apuração nacional do **Presidente** no 2º turno (eleição TSE `6258`).

O painel do 1º turno continua em [apuracao.madebysandro.app](https://apuracao.madebysandro.app) (outro produto/repo).

## Estado atual (#7)

- Worker `presidente2026` no domínio `presidente2026.win` (`workers_dev` desligado).
- Poller Durable Object por eleição (`ele-6258`), ciclo mínimo só Presidente `br`.
- Durable Object `Pesquisas` (SQLite) vazio, com RPC de sanidade.
- Página pública placeholder (“Em breve”) + CSP base.
- `GET /api/apuracao` e `GET /api/historico` reaproveitam o poller educado do 1º turno (ETag, escada, backoff).

## Desenvolvimento

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
| `npm test` | Vitest + `@cloudflare/vitest-pool-workers`, TSE falso via MSW |
| `npm run build` | `tsc --noEmit` |
| `npm run deploy` | `wrangler deploy` (produção; Sandro) |

## Vars

| Var | Valor | Nota |
| --- | --- | --- |
| `TSE_BASE` | `https://resultados.tse.jus.br/oficial` | CDN oficial |
| `ELEICAO_FEDERAL` | `6258` | 2º turno Presidente |

## Deploy

- Produção só a partir da `main` (Cloudflare Workers Builds).
- Sem preview de branch.
- Domínio: `presidente2026.win` (`custom_domain`). Sem `workers.dev`.

## Spec

Spec pai: [#1](https://github.com/madebysandro/presidente2026/issues/1). Esqueleto do Worker: [#7](https://github.com/madebysandro/presidente2026/issues/7). Protótipo aprovado: branch `prototipo/pesquisas`, commit `b1fe8ea` (direção A).
