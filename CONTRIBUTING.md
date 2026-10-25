# Contribuir

O fluxo do repositório está em [AGENTS.md](AGENTS.md): issue antes do código, PR com `Closes #N`.

```bash
npm ci
npm run typecheck
npm run knip
npm test
npm run build
```

Node.js 24.21, como no CI.

## Código sem uso

O job `ci` roda `npm run typecheck` (`noUnusedLocals`) e `npm run knip`
(`knip --no-progress`) antes do build e dos testes. Import/local sem uso e
export/arquivo morto fazem o mesmo check `ci` falhar, inclusive em PR draft.
As exceções ficam em `knip.jsonc`, com o consumidor e o motivo de o knip não
enxergá-lo. Prefira desexportar símbolos internos e remover mortos reais.

## Auditoria noturna

A auditoria que abriu os PRs [#105](https://github.com/madebysandro/presidente2026/pull/105)
e [#106](https://github.com/madebysandro/presidente2026/pull/106) roda no agente
externo **Nightly Audit Engineer**, no Cursor. Sua tarefa agendada e as
instruções que abrem PRs vivem na configuração desse agente, fora deste repo.
Os workflows em `.github/workflows/` e os scripts locais não abrem PRs de
auditoria. A API `/api/agente/auditoria` registra operações de pesquisas e
não é esse bot.

Falta aplicar a seguinte regra na tarefa do Nightly Audit Engineer, pelo dono
da automação no Cursor, antes de qualquer abertura de PR:

```bash
gh pr list --repo madebysandro/presidente2026 --state open --limit 1000 \
  --json number,title,body,headRefName,url
```

Compare título **e assunto** (issue, arquivos e correção proposta), incluindo
drafts e branches de outros agentes. #105/#106 tinham títulos diferentes e
apagavam as mesmas imagens. Se já houver PR para a mesma correção, reutilize
o PR e a branch existentes, sem abrir outro. Se a consulta falhar, pare a
abertura. Consulte de novo imediatamente antes de criar o PR; execuções
concorrentes da tarefa precisam ser serializadas na automação externa para
evitar que ambas consultem antes da primeira abertura. Até essa configuração
externa ser atualizada, a deduplicação não é executada por este repositório.
