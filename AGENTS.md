# Agentes

- Workflow: crie ou use uma issue antes de código; siga `/implement` (TDD, typecheck, testes, code-review); abra o PR com `Closes #N` e, no corpo, a saída de `npm test` e `npm run build` mais o resumo do code-review.
- Produto: `presidente2026.win`, só Presidente nacional do 2º turno (eleição `6258`). O painel do 1º turno (`apuracao.madebysandro.app`) é outro repo e não muda aqui.
- Fidelidade visual (fase pesquisas): branch `prototipo/pesquisas`, commit `b1fe8ea`, direção A · Três semanas. Checklist em `docs/prototipo/README.md` quando a página entrar.
- Guardrail: barra rosa, variantes B/C do protótipo de pesquisas, Three.js, mascotes e confetti ficam de fora.
- Deploy: produção só na `main`, pela Cloudflare Workers Builds; sem preview de branch.
- Rules: modelos pstack em `.cursor/rules/pstack-models.mdc` (sempre aplicado).
