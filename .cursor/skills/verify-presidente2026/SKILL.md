---
name: verify-presidente2026
description: "Sobe o presidente2026.win local (Vite + Void/Miniflare, nunca Wrangler na conta) e prova a página do 2º turno, as APIs públicas e o og.png com capturas em 390 px e 1280 px, mais o npm test. Use em todo PR e quando precisar mostrar que a mudança aparece no app."
---

# Verificar o Presidente 2026

Superfície principal: a página web em `/` (pesquisas, calendário e, quando a fase muda, apuração). Superfícies secundárias: `GET /api/pesquisas`, `GET /api/apuracao`, `GET /api/historico` e `GET /og.png`. O agente autenticado em `/api/agente/*` fica de fora: a prova não lê nem grava `CHAVE_AGENTE`.

O servidor é o mesmo de `npm run dev` em `package.json`: `vite` com `voidPlugin()` (Miniflare local, estado em `.void/`). A porta padrão do Vite é 5173. Esta verificação usa a porta 5273 com `--strictPort` para não se acoplar a um `npm run dev` que já esteja aberto.

## Launch

Node 24.21, o valor de `.nvmrc`. Com esse `node` no `PATH`, na raiz do repo:

```bash
node .cursor/skills/verify-presidente2026/verificar.mjs launch
```

Outra porta: `node .cursor/skills/verify-presidente2026/verificar.mjs launch --port 5274`.

Pronto quando o log contém `ready` e `Local:   http://127.0.0.1:5273/`. O comando imprime JSON com `pronto`, `pid` e `prova`. O primeiro `GET /` pode baixar o registro público do TSE; isso é o import inicial do app, não um deploy.

Recuse uma segunda instância. O estado local mora em `.void/` e é compartilhado. Não apague `.void/` no cleanup.

Não use `npx wrangler`, `wrangler dev`, `wrangler preview`, `npm run deploy` nem `VOID_REMOTE=1`. Não procure token da Cloudflare. O plano de lançamento força `VOID_REMOTE=0` e chama só o binário do Vite.

## Doctor

```bash
node .cursor/skills/verify-presidente2026/verificar.mjs doctor
```

Confere o pid que o launch gravou, a linha de comando (Vite, sem wrangler), `VOID_REMOTE=0`, a porta e um `GET /` 200 com o título `Presidente 2026` e o `<main class="a">`. Rode de novo depois de qualquer falha de drive. Não dirija uma instância que este comando recuse.

## Drive

Harness: `verificar.mjs`. Seletores estáveis da página: `main.a`, `h1`, a região `Calendário das pesquisas, de 5 a 25 de outubro`, o botão `Rever as três semanas`, o heading `Como calculamos`.

Uma feature:

```bash
node .cursor/skills/verify-presidente2026/verificar.mjs drive pagina-pesquisas
node .cursor/skills/verify-presidente2026/verificar.mjs drive calendario
node .cursor/skills/verify-presidente2026/verificar.mjs drive grafico-vantagem
node .cursor/skills/verify-presidente2026/verificar.mjs drive apis-publicas
node .cursor/skills/verify-presidente2026/verificar.mjs drive previa-og
```

Páginas alteradas no PR, uma rota por `--path` (`/`, `/og.png` ou um `/api/...`):

```bash
node .cursor/skills/verify-presidente2026/verificar.mjs drive pagina-pesquisas
node .cursor/skills/verify-presidente2026/verificar.mjs paginas --path /
```

Mapeamento do diff para rota: `routes/index.ts`, `src/pagina/**` e `public/**` abrem `/`. `routes/og.png.ts` e `src/pagina/previa*.ts` abrem `/og.png`. Um arquivo em `routes/api/**` abre o caminho daquela rota. Diff só de skill, doc ou teste ainda roda `drive pagina-pesquisas`.

A vinheta (`.a-intro`) só sobe quando existe `.a-cabo`. Escape é o atalho real de pular. O harness faz isso e espera o overlay sair.

## Evidence

A pasta `prova` impressa no launch fica em `artifacts/verificacao/provas/<instante>/` (gitignored por `artifacts/`). Cada largura gera um PNG de página inteira (`pagina-390.png`, `pagina-1280.png`). O JSON ao lado guarda título, `h1`, `data-fase` e o `data-d` do dia no topo. APIs e o `og.png` gravam o corpo. `doctor.txt` guarda só as linhas `ready` e `Local:`.

A prova exercita o servidor local, não um setter interno. Captura a ida à rota e o estado que a página mostra. O import do TSE é rede de verdade do app. Não há modo dry-run.

Testes existentes, no mesmo Node:

```bash
node .cursor/skills/verify-presidente2026/verificar.mjs testes
```

Isso é `npm test` (build local e Vitest no Miniflare). A saída vai para `npm-test.log` dentro da mesma `prova`.

## Cleanup

```bash
node .cursor/skills/verify-presidente2026/verificar.mjs cleanup
```

Envia `SIGTERM` ao grupo do pid gravado. Não mata por nome. Apaga `artifacts/verificacao/atual.json` e deixa a pasta `prova`. Não apaga `.void/`.

## Helpers

`node .cursor/skills/verify-presidente2026/verificar.mjs` sem comando lista os modos. `plano-lancamento` imprime o argv do Vite e falha se ele citar wrangler ou se `VOID_REMOTE` não for `0`. O arquivo é executável.

## Pull request

Todo PR roda launch, doctor, `drive pagina-pesquisas`, `paginas` para cada rota do diff, `testes` e cleanup. O corpo do PR leva as capturas de 390 px e 1280 px, o trecho do `doctor.txt` e o final de `npm-test.log` com o exit code. Não anexe `servidor.log`.

Para manter o mapa quando a página mudar, use `/maintain-verification-skill`.
