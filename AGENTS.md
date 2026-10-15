# Agentes

- Workflow: issue antes do código; TDD; `npm test` + `npm run build`; PR com `Closes #N` e, no corpo, saída dos comandos mais o resumo do code-review.
- Produto: `presidente2026.win`, só Presidente nacional do 2º turno (eleição `6258`). O painel do 1º turno (`apuracao.madebysandro.app`) é outro repo e não muda aqui.
- Fidelidade visual (fase pesquisas): branch `prototipo/pesquisas`, commit `b1fe8ea`, direção A · Três semanas. Checklist em `docs/prototipo/README.md` quando a página entrar.
- Guardrail: barra rosa, variantes B/C do protótipo de pesquisas, Three.js, mascotes e confetti ficam de fora.
- Stack: Void (`void` + Vite). Config em `void.config.ts` / `void.lock.json`. Docs: https://void.cloud
- Deploy: produção só na `main`, via `.github/workflows/void-deploy.yml` (`void deploy --platform cloudflare`); sem preview de branch. Secret `CLOUDFLARE_API_TOKEN` (e opcionalmente `CLOUDFLARE_ACCOUNT_ID`) no repositório.
- Models: `.cursor/rules/pstack-models.mdc` (gerado por `/setup-pstack`, budget medium / high).
