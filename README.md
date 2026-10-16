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

- Página **Três semanas** (tema claro) no Worker `presidente2026`, domínio `presidente2026.win`. `workers_dev` e `preview_urls` ficam desligados: a API do agente não tem segundo endereço público.
- Poller Durable Object `ele-6258`: Presidente nacional (`br`), 27 UFs, exterior (`zz`) e os 10 maiores colégios. ETag, escada e backoff.
- Import do registro do TSE no Durable Object `Pesquisas`: cron às 06h, 12h e 18h de Brasília, e no primeiro acesso se o banco ainda estiver vazio.
- `GET /api/pesquisas` e `GET /api/apuracao` públicos, com cache na borda.
- `POST /api/agente/resultados` só com `CHAVE_AGENTE`. Sem chave (ou chave errada): `401 {"erro":"nao_autorizado"}` e linha na auditoria. A lista de pendentes, a suspensão e o `GET /api/agente/auditoria` são a [#14](https://github.com/madebysandro/presidente2026/issues/14).

## Poller

Eleição `6258`, só Presidente. O Durable Object de produção chama-se `ele-6258` (`getByName`). Antes das 17h de 25/10 (Brasília) a espera nunca passa do tempo que falta para as 17h; depois das 17h, com apurado em zero, a espera máxima é 60 s.

`GET /api/apuracao` e `GET /api/historico?desde=` leem esse poller. O painel do 1º turno não muda.

## Pesquisas

O cron `crons/import-pesquisas-tse.ts` baixa o ZIP do CDN do TSE, classifica o que é pesquisa nacional de 2º turno e grava o esqueleto legal (sem números). Os números entram só pelo agente, depois da liberação e com fonte em domínio aceito.

`GET /api/pesquisas` devolve a média, o calendário e a ficha. Cabeçalho: `cache-control: public, max-age=0, s-maxage=30`.

CPU do Worker: `limits.cpu_ms` = `300000` (5 min). O plano Free corta em 10 ms e o CSV (~16,5 MB descompactado) não cabe. No Paid, o cron com intervalo de 6 h já tem teto próprio de 15 min; o `cpu_ms` sobe o teto do request HTTP (o import do primeiro acesso) até 5 min. Conta Free recusa esse valor no deploy.

## Agente

Único escritor: `Authorization: Bearer <chave>`. A comparação é em tempo constante. A chave não vai no corpo da auditoria.

| Quem chama | Teto | Onde |
| --- | --- | --- |
| Chave válida | 30 a cada 60 s | binding `LIMITE_AGENTE_CHAVE` (`namespace_id` `625801`) e contador no DO |
| IP sem chave válida | 5 a cada 60 s | binding `LIMITE_AGENTE_IP` (`namespace_id` `625802`) e contador no DO |

Acima do teto: `429` com `retry-after: 60`, também na auditoria. O binding é por localização da Cloudflare; o contador do DO é o teto global e fica no mesmo lock da auditoria. Nos testes o binding não entra (não zera entre casos); a produção leva os dois em `dist/ssr/wrangler.json`. Hoje a única rota do agente é `POST /api/agente/resultados`, e é ela que consulta o binding. As rotas da #14 (`GET /api/agente`, `/pendentes`, suspensão, auditoria) têm de passar pelo mesmo `bindingDeixaPassar` quando entrarem.

`GET /api/apuracao` usa `cache-control: public, max-age=0, s-maxage=5, must-revalidate`. `GET /api/historico` fica `no-store`.

## Segredo `CHAVE_AGENTE`

256 bits aleatórios, base64url. Gere na sua máquina e não cole o resultado no git, no PR nem no chat:

```bash
node --input-type=module -e 'console.log(Buffer.from(crypto.getRandomValues(new Uint8Array(32))).toString("base64url"))'
```

Gravar no Worker (o Wrangler pede o valor no stdin; não há flag de valor):

```bash
npx wrangler secret put CHAVE_AGENTE
```

Rode na conta do Worker `presidente2026`. O nome do segredo não entra em `void.config.ts`.

**Rotação:** o mesmo comando de novo. Em seguida troque o arquivo no computador do Grok Bot. A chave antiga passa a receber `401`, e esse `401` entra na auditoria.

No bot, a chave fica num arquivo lido pelo `curl -H @arquivo`, para não aparecer na linha de comando. Caminho: `~/.config/presidente2026/chave.txt` (modo `600`; o diretório, `700`). Uma linha:

```text
Authorization: Bearer COLE_A_CHAVE_AQUI
```

```bash
curl -sS -H @~/.config/presidente2026/chave.txt \
  https://presidente2026.win/api/agente/pendentes
```

`/pendentes` só existe depois da #14. Até lá, o mesmo arquivo autentica o `POST /api/agente/resultados`.

## Routines do Grok Bot

Horário de Brasília. A chave é a do arquivo acima; a Routine não repete a chave.

**Routine 1** — a cada 2 horas, das 8h às 23h. Se `/api/agente/pendentes` vier vazio, termine.

```text
Leia https://presidente2026.win/api/agente e siga as instruções.
```

**Routine 2** — todo dia às 9h. `<ontem>` é o instante ISO de 24 h atrás.

```text
Leia https://presidente2026.win/api/agente/auditoria?desde=<ontem> e me mande um resumo: publicados, substituídos, recusados por motivo e tentativas sem chave por IP.
```

As duas URLs (`GET /api/agente` e `GET /api/agente/auditoria`) são a #14. O texto está pronto para colar; as rotas entram com aquela issue. O `POST /api/agente/resultados` já recusa quem não tem a chave e audita a tentativa.

## Bot Fight Mode

O Grok Bot sai de IP de datacenter. Bot Fight Mode na zona inteira desafia `/api/agente/*` e a Routine quebra. A página e as APIs públicas podem continuar com a proteção da zona.

No dashboard da zona `presidente2026.win` (não nas settings do Worker):

1. **Security** → **Bots**: veja se Bot Fight Mode está ligado.
2. **Rules** → **Overview** → **Configuration Rules** → **Create rule**.
3. Nome: `agente sem bot fight`.
4. Quando: URI Path **starts with** `/api/agente`.
5. Então: **Bot Fight Mode** = **Off**.
6. Salve e confira um `GET /api/pesquisas` ainda cacheado (não deve passar por essa regra).

Se o plano não mostrar Bot Fight Mode dentro da Configuration Rule, use uma custom rule de WAF com ação **Skip** só para Bot Fight Mode, na mesma expressão de caminho.

## Checklist móvel (tema claro)

No Safari do iPhone, tema claro, sem zoom:

- A página não rola para o lado.
- Não aparece `undefined` nem `NaN`.
- Os dois vídeos da vinheta estão `muted` e `playsinline` (e `webkit-playsinline`) e tocam na própria página. Com Reduzir Movimento, a página abre no fim e o vídeo não é obrigatório para ler o conteúdo.

O smoke local cobre 1440 e 390, tema claro, com e sem reduzir movimento, inclusive esses atributos:

```bash
node scripts/smoke-vinheta.mjs
```

O passe no aparelho, em https://presidente2026.win, é manual e só depois do deploy da `main`.

## Plano B do import

Se no primeiro deploy real o log do cron (ou do primeiro `GET /api/pesquisas`) mostrar que `cdn.tse.jus.br` bloqueou o IP da Cloudflare, a [#22](https://github.com/madebysandro/presidente2026/issues/22) vira o bloqueio operacional: Action diária e `CHAVE_IMPORT`, chave distinta da do agente. Não ligue isso antes de ver o bloqueio.

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

Sem preview de branch. Domínio: `presidente2026.win` (`custom_domain`). Sem `workers.dev` (`workers_dev: false` e `preview_urls: false` no `void.config.ts`; o `dist/ssr/wrangler.json` do build repete os dois). O mesmo arquivo leva `limits.cpu_ms` 300000 e os bindings `LIMITE_AGENTE_CHAVE` / `LIMITE_AGENTE_IP`.

Docs Void: [Quickstart](https://void.cloud/guide/quickstart), [Cloudflare](https://void.cloud/integrations/cloudflare), [Deployment](https://void.cloud/guide/deployment), [Durable State](https://void.cloud/guide/durable-state).

## Spec

Spec pai: [#1](https://github.com/madebysandro/presidente2026/issues/1). Esqueleto: [#7](https://github.com/madebysandro/presidente2026/issues/7). Migração Void: [#27](https://github.com/madebysandro/presidente2026/issues/27). Protótipo: branch `prototipo/pesquisas`, commit `b1fe8ea` (direção A).
