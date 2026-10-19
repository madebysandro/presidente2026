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
- `POST /api/agente/resultados` só com `CHAVE_AGENTE`. Sem chave (ou chave errada): `401 {"erro":"nao_autorizado"}` e linha na auditoria. Pendentes, suspensão, instruções e auditoria estão em `GET/POST/DELETE /api/agente/*`.

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
| Chave válida | 30 a cada 60 s | contador no Durable Object |
| IP sem chave válida | 5 a cada 60 s | contador no Durable Object |

Acima do teto: `429` com `retry-after: 60`, também na auditoria. O contador do DO é o teto global e fica no mesmo lock da auditoria. `LIMITE_AGENTE_CHAVE` e `LIMITE_AGENTE_IP` voltam ao `void.config.ts` quando o Void suportar rate limit com pinned secrets (#64). No Void 1.1.11 esse upload falha, então o config fica sem esses bindings. `bindingDeixaPassar` trata o binding como opcional: sem ele, o DO decide. Toda rota em `/api/agente/*` passa por esse portão.

| Rota | Autenticação | Resposta |
| --- | --- | --- |
| `GET /api/agente` | sem chave (taxa por IP; Bearer válido entra no teto da chave) | `200` `text/markdown` — instruções em `docs/agente/instrucoes.md` |
| `GET /api/agente/pendentes` | `Bearer` | `200` `{"pendentes":[…]}`. Vazio: `{"pendentes":[]}`. Cada item: `registro`, `instituto`, `contratantes`, `campo` (`inicio`/`fim`), `liberacaoEfetiva`, `entrevistas`, `faltaMargem`, `faltaConfianca`, `jaPublicado` |
| `POST /api/agente/resultados` | `Bearer` | `201 {"status":"publicado"}` ou `200 {"status":"substituido"}`. Recusa: `422 {"motivos":[{"codigo","detalhe"}]}` |
| `POST /api/agente/suspensoes` | `Bearer` | corpo `{"registro","decisaoUrl","motivo"}`. `201` ou `200` `{"status":"suspensa"}`. `decisaoUrl` https |
| `DELETE /api/agente/suspensoes/{registro}` | `Bearer` | corpo `{"motivo"}`. `200 {"status":"reativada"}` |
| `GET /api/agente/auditoria?desde=&depois=&limite=` | `Bearer` | `200 {"entradas":[…],"proximo":"/api/agente/auditoria?…" \| null}`. Máximo 500. `entradas`: `id`, `em`, `rota`, `metodo`, `ip`, `chaveValida`, `registro`, `corpo`, `status`, `motivos` |

Sem chave (ou chave errada) nas rotas que exigem `Bearer`: `401 {"erro":"nao_autorizado"}`, com linha na auditoria. `429` é `{"erro":"limite"}` e `retry-after: 60`. Cabeçalho das rotas do agente: `cache-control: no-store`.

`GET /api/apuracao` usa `cache-control: public, max-age=0, s-maxage=5, must-revalidate`. `GET /api/historico` fica `no-store`.

## Segredo `CHAVE_AGENTE`

256 bits aleatórios, base64url. Gere na sua máquina e não cole o resultado no git, no PR nem no chat:

```bash
node --input-type=module -e 'console.log(Buffer.from(crypto.getRandomValues(new Uint8Array(32))).toString("base64url"))'
```

Gravar no Worker (o Void pede o valor no stdin; não cole o valor na linha de comando):

```bash
npx void secret put CHAVE_AGENTE
```

Rode na conta do Worker `presidente2026`. A chave está em `env.ts` (`string().optional()`): `void deploy` só exige no remoto as chaves obrigatórias, e esta ainda pode não existir em produção — sem ela o site sobe e o agente recebe `401`. O nome não entra em `void.config.ts`.

**Rotação:** o mesmo comando de novo. Em seguida troque o arquivo no computador do Grok Bot. A chave antiga passa a receber `401`, e esse `401` entra na auditoria.

No bot, a chave fica num arquivo lido pelo `curl -H @arquivo`, para não aparecer na linha de comando. Caminho: `~/.config/presidente2026/chave.txt` (modo `600`; o diretório, `700`). Uma linha:

```text
Authorization: Bearer COLE_A_CHAVE_AQUI
```

```bash
curl -sS -H @~/.config/presidente2026/chave.txt \
  https://presidente2026.win/api/agente/pendentes
```

O mesmo arquivo autentica `GET /api/agente/pendentes`, o `POST /api/agente/resultados`, a suspensão e `GET /api/agente/auditoria`. `GET /api/agente` (as instruções) não usa a chave.

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

A Routine 1 lê `GET /api/agente` (markdown, sem chave) e segue o que está em `docs/agente/instrucoes.md`. Se `GET /api/agente/pendentes` vier `{"pendentes":[]}`, não há trabalho. A Routine 2 lê a auditoria paginada: `proximo` é o caminho da página seguinte, ou `null`. O `401` sem chave continua na auditoria.

## Semeadura inicial

Cinco pesquisas do protótipo (`b1fe8ea`, `docs/prototipo/novo-design/dados/pesquisas.json`), com as URLs de fonte de lá: PoderData `BR-08134/2026`, Datafolha `BR-02949/2026`, AtlasIntel `BR-03663/2026`, PoderData `BR-01209/2026` e Quaest `BR-08729/2026` (sem válidos publicados). O teste `test/agente-operacao.api.test.ts` publica as cinco por `POST /api/agente/resultados` e confere `GET /api/pesquisas`. Não há carga automática em produção: o número só entra por essa API, com a página-fonte confirmando.

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

Ligue só se o cron in-Worker falhar: conta Free (o CSV não cabe nos 10 ms) ou `cdn.tse.jus.br` bloqueando o IP da Cloudflare. O sinal está no log `evento=import` com `resultado=erro`, ou no cron que deixa de atualizar `registroTse` em `GET /api/pesquisas`.

A Action `.github/workflows/plano-b-import.yml` roda todo dia às 09:00 UTC. Sem o segredo, ela só confere a fixture (33 nacionais) e não envia nada. Com `CHAVE_IMPORT` no repositório, baixa os dois ZIP do TSE e faz `POST /api/import`.

A chave é outra, distinta da do agente, e não vai para o Grok Bot. Grave as duas pontas com o mesmo valor:

```bash
npx void secret put CHAVE_IMPORT
```

No GitHub: Settings → Secrets and variables → Actions → `CHAVE_IMPORT`. Sem esse nome no `void.config.ts`. `env.ts` deixa a chave `.optional()`: o site sobe sem ela e a rota responde `401`.

A chave do agente leva `401` em `POST /api/import`. `CHAVE_IMPORT` leva `401` em `/api/agente/*`. O corpo é `{ "registros": [ … ] }`, só nacionais. Estadual e ambígua que já estavam no DO ficam. Nacional que sumiu do recorte fica `removido do TSE`.

Dry-run local, sem rede e sem chave:

```bash
node scripts/plano-b.mjs --fixture > /tmp/recorte.json
```

## Logs

Cloudflare → Workers & Pages → `presidente2026` → Observability. Um evento JSON por unidade de trabalho; o tipo é `EventoLog` em `src/log.ts`. Campos para filtrar:

| Campo | Valores |
| --- | --- |
| `evento` | `import`, `poller`, `agente` |
| `resultado` | import: `aplicado`, `nao_modificado`, `erro`; poller: `ok`, `erro` (os de `erro` saem em nível error) |
| `motivo` | import: `cron`, `primeiro_acesso`, `plano_b` |
| `rota` | agente: caminho do template, sem ids nem query (ex. `/api/agente/suspensoes/:registro`) |
| `status` | agente: status HTTP da resposta |

Nenhum evento carrega bearer, `CHAVE_AGENTE`, IP, query nem corpo do pedido.

A auditoria (import e agente) não tem `DELETE`: fica legível até 31/12/2026. O export é o `GET /api/agente/auditoria` paginado. A nota inteira (Void, retenção, dívida triada) está em [docs/operacao/pos-eleicao.md](docs/operacao/pos-eleicao.md).

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
| `npm test` | `void prepare` + build + Vitest no runtime local (Miniflare), TSE falso via MSW |
| `npm run build` | `void prepare` + `tsc --noEmit` + `vite build` |
| `npm run sonda:agente` | build + todas as rotas `/api/agente*` no bundle de produção (Miniflare puro, com e sem `CHAVE_AGENTE`) |
| `npm run dev` | `vite` com `voidPlugin` (dev local da Void, Miniflare) |
| `npm run prepare:void` | `void prepare` — tipos em `.void/` sem subir o dev server |
| `npm run deploy` | `void deploy --platform cloudflare` (modo `atomic`: o tráfego muda antes do readiness) |

## Vars

| Var | Valor | Nota |
| --- | --- | --- |
| `TSE_BASE` | `https://resultados.tse.jus.br/oficial` | CDN oficial |
| `ELEICAO_FEDERAL` | `6258` | 2º turno Presidente |

## Deploy

Produção só na `main`, via **Cloudflare Workers Builds** (repo conectado no painel; sem GitHub Actions de deploy).

`npm run deploy` usa `void deploy --platform cloudflare`. O Void verifica o Worker existente antes de subir a versão. No modo `atomic`, o tráfego muda antes do readiness. Se essa checagem falhar, a versão nova já está no ar, e o Void não desfaz a ativação sozinho. Se a versão que já está no ar precisar voltar, o plano B é `void project rollback` (id completo da Worker Version, ou um prefixo sem ambiguidade; restaura código e triggers; não desfaz migração de banco nem de classe de Durable Object) ou o dashboard: Workers & Pages → `presidente2026` → Deployments → versão anterior. `npx void project logs` acompanha o tail ao vivo.

O modo em `void.config.ts` é `atomic`, temporário enquanto o Cloudflare APIError 100405 não tiver correção. A mensagem é `All versions in a multi-version deployment must declare identical exports`, issue voidzero-dev/void#460. O tráfego muda antes do readiness. O modo não reescreve as migrações de Durable Object em `void.lock.json`. Uma migração de classe pendente passa. O rollback ainda não cruza a fronteira dessa migração. Rollback de banco também não desfaz migração.

Antes do deploy, na máquina já autenticada na Cloudflare (não entra no CI e não usa token no log): `npx void env check --remote`.

`routing.notFound` fica em `"none"` para o `createAssetFallback` do Void não trocar GET `/api/*` 404 por `index.html` (modo SPA padrão quando só há rotas de API).

### account_id e token (Void verify)

O `void.config.ts` fixa `cloudflare.account_id` (`aaec42ffcbeebcd4cda5beff4af4c439`). Só o lock não basta: o Void materializa a config a partir do bloco `cloudflare` e descarta `account_id` que exista só no lock. Sem pin na config, o CI não-interativo para antes do verify (seleção de account / `CLOUDFLARE_ACCOUNT_ID`).

A string `Could not verify existing Cloudflare Worker` só aparece **depois** do account resolvido: o Void chama `cf workers deployments list` / `versions get` (e, com DO migrations, ainda lê o script). Qualquer falha nessa leitura — token sem escopo, account errado, nome do Worker, rede — vira essa mensagem. Pin do `account_id` é necessário, mas não prova sozinho que o token do Builds consegue as leituras.

No Workers Builds o API token do Build Configuration autentica o deploy command como `CLOUDFLARE_API_TOKEN` (Void/`cf` leem essa var; com token presente o `whoami` é pulado). Uma build variable com o mesmo nome **substitui** o token injetado — só use se o log do Builds mostrar `deployments`/`versions` falhando com o token do painel.

Para o gate de verify, o código do Void precisa conseguir ler deployments/versions/scripts: na prática **Account → Workers Scripts → Edit**. Account Settings Read não é consultado nesse passo. O token padrão “Create new token” do Builds já traz Workers Scripts Edit (e também Account Settings Read + Zone Workers Routes Edit, úteis no publish de rota/`presidente2026.win` depois do verify). Sufficiency do token do Builds fica **não provada** até um log de build mostrar essas leituras OK + readiness; se falhar, leia o stderr do passo de deploy antes de criar token custom.

### Trigger de produção

| Setting | Valor |
| --- | --- |
| Git branch | `main` |
| Root directory | `/` |
| Build command | `npm run build` |
| Deploy command | `npx void deploy --platform cloudflare` (ou `npm run deploy`) |
| Node.js | `24.21` ([`.nvmrc`](.nvmrc)) |
| Preview builds | ligados. O bloco é `previews: {}`. A ponte é `.wrangler/deploy/config.json` |
| API token | token do Builds (Create new token se stale) |

Workers Builds instala deps do lockfile antes do build; não precisa de `npm ci` no Build command.

#### Cliques no dashboard (Sandro)

1. Cloudflare dashboard → Workers & Pages → Worker `presidente2026` → **Settings** → **Builds**.
2. Em **Build configuration** → **API token**: confirme o token ativo. Se o build falhou com auth/verify e o token parece antigo, **Create new token** (Workers Scripts Edit no padrão) e salve.
3. Em Deploy command, deixe `npx void deploy --platform cloudflare` e salve → **Retry build** se a config mudou.
4. No log desse build, confirme o verify (`deployments`/`versions`). O readiness corre depois que o tráfego já mudou.
5. Se o site no ar precisar de uma versão anterior, use **Deployments** (rollback no dashboard) ou `void project rollback`. Só então considere token custom / escopos a partir do stderr (lembre: variável `CLOUDFLARE_API_TOKEN` substitui o token do passo 2).

Preview de branch fica ligado. O comando do Workers Builds, fora da `main`, é `npx wrangler preview` (Wrangler 4.151). Esse comando, com `useConfigRedirectIfAvailable`, segue `.wrangler/deploy/config.json` até `dist/ssr/wrangler.json`. O Void 1.1.11 apaga essa ponte no fim do `vite build` e guarda a cópia em `.void/preview-deploy-config.json`. Sem a ponte, o Wrangler não acha `wrangler.json`, `wrangler.jsonc` nem `wrangler.toml` na raiz. O Builds injeta `WRANGLER_CI_OVERRIDE_NAME`, então a checagem de nome passa e o comando para em `missing a previews block`.

`previews: {}` no `cloudflare` do `void.config.ts` chega em `.void-wrangler.jsonc` e em `dist/ssr/wrangler.json`. O objeto vazio não é descartado. O `wrangler preview` só lê esse arquivo se a ponte existir. O `npm run build` regrava a ponte depois do Vite. Objeto vazio de propósito: o preview não copia binding de produção. Cada preview ganha namespace novo de Durable Object, separado do da `main`. `workers_dev` e `preview_urls` continuam `false`.

A produção da `main` segue `npx void deploy --platform cloudflare`. Esse comando apaga a ponte, refaz o `vite build` com `VOID_CLOUDFLARE_DEPLOY_BUILD=1` e publica o Worker. Não roda `wrangler preview`. O bloco `previews` não entra nos campos de tráfego que o Void trava (`routes`, `workers_dev`, `preview_urls`).

Domínio: `presidente2026.win` (`custom_domain`). Sem `workers.dev` (`workers_dev: false` e `preview_urls: false` no `void.config.ts`). O mesmo config leva `limits.cpu_ms` 300000. Os bindings de rate limit ficam de fora até o Void subir rate limit com pinned secrets (#64).

Docs Void: [Quickstart](https://void.cloud/guide/quickstart), [Cloudflare](https://void.cloud/integrations/cloudflare), [Deployment](https://void.cloud/guide/deployment), [Durable State](https://void.cloud/guide/durable-state).

## Spec

Spec pai: [#1](https://github.com/madebysandro/presidente2026/issues/1). Esqueleto: [#7](https://github.com/madebysandro/presidente2026/issues/7). Migração Void: [#27](https://github.com/madebysandro/presidente2026/issues/27). Protótipo: branch `prototipo/pesquisas`, commit `b1fe8ea` (direção A).
