# Agentes

- Fluxo: issue, depois branch `cursor/...`, depois PR com `Closes #N`. TDD. `npm test` e `npm run build`. No corpo, a saída dos comandos e o resumo do code-review.
- Merge só com o `ci` verde e o Workers Builds verde. Depois do merge, conferir o Workers Builds da `main` e o site no ar.
- Código: `/to-spec`, `/to-tickets`, `/implement`, `/implement-spec` ou prototype seguem essas skills, sem `/poteto-mode`. Nas demais, `/poteto-mode`. Em todas, `/interrogate` antes do merge.
- Modelo dos agentes de código: `grok-4.7` sem fast, effort conforme a complexidade.
- Produto: `presidente2026.win`, só Presidente nacional do 2º turno (eleição `6258`). O painel do 1º turno (`apuracao.madebysandro.app`) é outro repo.
- Fidelidade visual (fase pesquisas): branch `prototipo/pesquisas`, commit `b1fe8ea`, direção A · Três semanas. Checklist em `docs/prototipo/README.md`.
- Guardrail: barra rosa, variantes B/C do protótipo de pesquisas, Three.js, mascotes e confetti ficam de fora.
- Stack: Void (`void` + Vite). Config em `void.config.ts` / `void.lock.json`. Docs: https://void.cloud. Node `24.21`. Root `/`.
- Deploy: só o Void no Workers Builds da `main`, modo `atomic`. Sem deploy manual, sem `wrangler deploy` e sem preview. O Void 1.1.11 não desliga o build de branch no `void.config.ts`. Não adicionar bloco `previews`. O interruptor é `previews_enabled` no Workers Builds. Build `npm run build`. Plano B e cliques: README → Deploy.
- Secrets: só `npx void secret put`. Nunca a CLI `cf` ou `wrangler`, e nunca imprimir valores.
- Rate limit: não repor bindings enquanto voidzero-dev/void#462 estiver aberta.
