# Pós-eleição (#23)

Nota de 16/10/2026. A produção já está na Void, em `presidente2026.win`.

## Observabilidade

Import, poller e agente emitem um JSON por unidade de trabalho (`src/log.ts`, `registrar`). A Observability do Worker está ligada em `void.config.ts` (`cloudflare.observability.enabled`). O painel que confirma o evento ao vivo é o da Cloudflare: Workers & Pages → `presidente2026` → Observability. Filtros e o que não entra no log estão no README, seção Logs.

## Auditoria até 31/12/2026

As tabelas `auditoria` (import) e `auditoria_agente` só recebem `INSERT`. Não há `DELETE` nem job de rotação. A data limite no código é `fimRetencaoAuditoria()` em `src/pesquisas/retencao.ts`: 31/12/2026, 23:59:59.999 em Brasília.

Export, se o Durable Object precisar ser lido fora do site: `GET /api/agente/auditoria` com a chave do agente, paginando por `proximo` até `null`. A chave não vai no corpo. Rotação da chave do agente continua o comando já descrito no README; a chave antiga passa a levar `401`.

## Void: permanecer

Decisão: **permanecer na Void**. Migrar de volta para Worker puro (wrangler) agora trocaria o deploy que já está no ar, sem ganho para o arquivo da disputa.

O que a spec D0 apontava, e como está hoje:

| Gap da spec | Hoje |
| --- | --- |
| Rate limit binding | Fora do `void.config.ts` (#64). O Void 1.1.11 não sobe rate limit com pinned secrets, então `LIMITE_AGENTE_CHAVE` e `LIMITE_AGENTE_IP` ficam de fora. O contador no Durable Object continua sendo o limite global. Os bindings voltam quando o Void suportar rate limit com pinned secrets. |
| vitest-pool-workers | O pool 0.23 só aceita Vitest 4.1. O 5 quebrou o cache. Fica no 4.1 até o pacote novo (`@cloudflare/vitest-plugin`) entrar com teste verde. |
| Workers Builds | Produção na `main` com `npx void deploy`. Preview de branch fica ligado. `cloudflare.previews` é `{}` e o `npm run build` regrava `.wrangler/deploy/config.json`, que o `wrangler preview` segue até `dist/ssr/wrangler.json`. |

Adiar de novo não cabe: a troca já aconteceu. Reabrir a decisão só se a Void deixar de publicar a `main` ou de falar com o Durable Object.

## Dívida da corrida

| Item | Triagem | Por quê |
| --- | --- | --- |
| "Para onde foram os votos?" e o selo ESTIMATIVA na página | Descartar | O Sandro tirou na #56. A página não mostra. |
| Campo `analise.comparacao.estimativa` ainda calculado no servidor | Fazer, se o Sandro quiser o JSON interno limpo | Não muda o que o visitante vê. Não apaguei neste PR para não mexer no formato que os testes da análise já travam. |
| `statusTse` no log do poller | Descartar por agora | O erro do TSE não traz status HTTP. O campo fica de fora até existir esse número. |
| Voltar ao wrangler | Descartar | A decisão desta nota é permanecer na Void. |
| Tema escuro, enquete, governadores `6260`, MCP OAuth do Grok | Descartar | Fora de escopo da spec e desta issue. |
| Check Workers Builds vermelho em todo PR | Repor a ponte do preview | O build `875ea10b-c06d-42df-9374-282db3774733` passou no `npm run build` e falhou em `npx wrangler preview` com `missing a previews block`. O Void esconde `.wrangler/deploy/config.json`. Com `WRANGLER_CI_OVERRIDE_NAME`, o Wrangler lê config vazia. `previews: {}` no `void.config.ts` chega no `dist/ssr/wrangler.json`, e o `npm run build` regrava a ponte para o comando achar esse arquivo. |
| Aviso de rename do `vitest-pool-workers` | Fazer depois | Trocar o pacote quando o teste do pool novo passar. Não bloqueia o arquivo. |
| Plano B do import (`CHAVE_IMPORT`) | Fazer na #22 | Não é atalho de página; é o failover do CSV. |

O que só o Sandro confirma no painel: um evento `import` / `poller` / `agente` visível na Observability depois do próximo cron, e se concorda em apagar `estimativa` do JSON interno.
