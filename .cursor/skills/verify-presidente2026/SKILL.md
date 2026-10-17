---
name: verify-presidente2026
description: "Prova o site presidente2026 no navegador. Sobe o servidor local com npm run dev (Vite e Void/Miniflare), confere as páginas alteradas em 390 px e 1280 px e roda os testes do repositório. Use em todo PR e quando um agente precisar dirigir o site como um visitante."
---

# Verificar o presidente2026

O visitante vê uma página HTML em `/` (pesquisas, noite ou resultado, conforme o relógio e o poller) e a imagem `/og.png`. O restante são rotas HTTP. Todo PR roda esta skill e cola a evidência no corpo. A evidência não entra no git.

O servidor é o `npm run dev` do `package.json` (`vite` com `voidPlugin`). Isso sobe o Worker no Miniflare local. Não usar `wrangler`, `npm run deploy`, `void deploy` nem qualquer comando que fale com a conta Cloudflare.

## Launch

Na raiz do repositório, com Node `>= 24.21` e dependências instaladas (`npm ci`):

```bash
node .cursor/skills/verify-presidente2026/verificar.mjs launch --port 5173
```

O helper executa `npm run dev -- --host 127.0.0.1 --port 5173 --strictPort`, grava o pid em `/tmp/verify-presidente2026.pid` e espera duas coisas: a linha `Local:` no log e um `GET /` utilizável (HTML com o título `Presidente 2026 · 2º turno`, `data-fase` e a marca `Presidente 2026, 2º turno`). O primeiro `GET /` baixa o registro público do TSE para o estado local em `.void/`. Pronto significa essa página, não só a porta aberta. O teto é 180 s.

O estado local mora em `.void/` e é compartilhado. Uma segunda instância no mesmo diretório não é suportada. Se a porta já responde, o launch falha e não mata o processo que está lá. Outra prova em paralelo precisa de uma cópia do repositório com outro `.void/`, não de um segundo `vite` nesta árvore.

O log do Vite fica em `/tmp/verify-presidente2026-server.log`. Ele pode conter o gatilho local do Void. Não copiar esse arquivo para a evidência, para o git nem para o PR.

## Doctor

```bash
node .cursor/skills/verify-presidente2026/verificar.mjs doctor --base http://127.0.0.1:5173
```

Só leitura. Confere Node `>= 24.21`, o Chrome em `CHROME_PATH` ou `/usr/bin/google-chrome`, e o `GET /` acima. Sai com código 1 se a instância não vale a pena dirigir. Rodar de novo sempre que a página não parecer a deste repositório.

## Drive

O mapa em `features/` é a fonte. Uma prova que só abre um atalho não cobre os outros entry points.

Para o PR, o helper escolhe as URLs pelo diff contra `main` (commits, stage, trabalho sujo e untracked). A tabela é `paginasDoDiff` em `paginas.mjs`, coberta por `paginas.test.mjs`. As URLs são `/` e `/og.png`. Diff sem página nenhuma ainda abre `/`, com motivo `sem-pagina-no-diff`.

```bash
node .cursor/skills/verify-presidente2026/verificar.mjs provar --base http://127.0.0.1:5173 --base-ref main
```

Cada URL sai em 390×900 e 1280×900, página inteira, `prefers-reduced-motion: reduce`, Chrome do sistema. Em `/` o helper exige `h1`, o título, `main.a[data-fase]` e a marca, e clica em `Rever as três semanas` a 1280 px. O clique que não deixa a página em `/` reprova. Não há endpoint de teste: a prova é o HTML que o visitante recebe.

As fases da noite não têm rota própria. Antes das 17h de 25/10/2026 em Brasília o `npm run dev` mostra pesquisas. Se o diff mexe em `src/pagina/ao-vivo.ts`, `encerrada.ts` ou `geografia.ts` e `data-fase` continua `pesquisas`, `tudo` grava `noite: "nao-exercitada"` e sai com código 1. Não trocar o relógio por um atalho para fazer a captura passar.

## Evidence

A prova completa (sobe, doctor, capturas, testes, desce):

```bash
node .cursor/skills/verify-presidente2026/verificar.mjs tudo --port 5173 --base-ref main
```

Os arquivos ficam em `artifacts/verify-presidente2026/<run-id>/`:

- `doctor.json`
- `relatorio.json` com as URLs, o motivo (`diff` ou `sem-pagina-no-diff`), a fase, o texto do `h1` e o resultado do clique
- `pagina-390.png`, `pagina-1280.png` e `acao-rever-1280.png`
- `og-390.png` e `og-1280.png` quando `/og.png` entra no diff
- `npm-test.log` com a saída de `npm test`

`npm test` é o conjunto que o repositório já roda. A skill não substitui esse comando por um smoke menor. Colar no PR o caminho da pasta, o `relatorio.json` e as capturas. Não colar o log do Vite.

Mocks não entram. O import inicial fala com o CDN público do TSE, que é o mesmo caminho do `npm run dev`. Isso não é a conta Cloudflare. Observar `data-fase` e o `h1` no HTML. Não confiar no nome do script.

## Cleanup

```bash
node .cursor/skills/verify-presidente2026/verificar.mjs cleanup
```

Mata o grupo de processos do pid gravado no launch. Não usa `killall` nem o nome `node` ou `vite`. Apaga o pid e o log em `/tmp`. Não apaga `artifacts/verify-presidente2026/`. `tudo` já chama este cleanup no fim, inclusive quando a prova falha.

## Helpers

O script é executável. Da raiz:

```bash
node .cursor/skills/verify-presidente2026/verificar.mjs tudo --port 5173 --base-ref main
node .cursor/skills/verify-presidente2026/verificar.mjs launch --port 5173
node .cursor/skills/verify-presidente2026/verificar.mjs doctor --base http://127.0.0.1:5173
node .cursor/skills/verify-presidente2026/verificar.mjs provar --base http://127.0.0.1:5173 --base-ref main
node .cursor/skills/verify-presidente2026/verificar.mjs testes
node .cursor/skills/verify-presidente2026/verificar.mjs cleanup
```

`paginas.mjs` exporta `LARGURAS`, `paginasDoDiff` e `alvosDaProva`. O teste `.cursor/skills/verify-presidente2026/paginas.test.mjs` entra no `npm test`.

Quando o app mudar, atualizar o mapa com `/maintain-verification-skill`.
