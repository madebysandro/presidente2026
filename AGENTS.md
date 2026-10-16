# Agentes

- Workflow: issue antes do código; TDD; `npm test` + `npm run build`; PR com `Closes #N` e, no corpo, saída dos comandos mais o resumo do code-review.
- Produto: `presidente2026.win`, só Presidente nacional do 2º turno (eleição `6258`). O painel do 1º turno (`apuracao.madebysandro.app`) é outro repo e não muda aqui.
- Fidelidade visual (fase pesquisas): branch `prototipo/pesquisas`, commit `b1fe8ea`, direção A · Três semanas. Checklist em `docs/prototipo/README.md` quando a página entrar.
- Guardrail: barra rosa, variantes B/C do protótipo de pesquisas, Three.js, mascotes e confetti ficam de fora.
- Stack: Void (`void` + Vite). Config em `void.config.ts` / `void.lock.json`. Docs: https://void.cloud
- Deploy: produção só na `main`, via Cloudflare Workers Builds (sem workflow de deploy no GitHub). Build `npm run build`; deploy `npx void deploy --platform cloudflare` (`cloudflare.account_id` no `void.config.ts`; token do Builds = `CLOUDFLARE_API_TOKEN`). Plano B se a versão no ar precisar voltar: `void project rollback` (código e triggers; não desfaz migração de banco nem de classe de DO) ou o dashboard da Cloudflare (Deployments da Worker). `void project logs` é o tail ao vivo. Root `/`; Node `24.21` (`.nvmrc`). Sem preview de branch. Detalhe dos cliques: README → Deploy.
- Models: `.cursor/rules/pstack-models.mdc` (gerado por `/setup-pstack`, budget medium / high).
