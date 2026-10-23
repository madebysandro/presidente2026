# Workers Builds vermelho na main (#83)

Triagem de 23/10/2026 (#108).

## O que falhou

Build `fc06d515-c805-4738-9f9c-090c30224558`, commit `2481396` (#81), check run `117425439326`, concluído em 17/10/2026 às 14:55:01 UTC. O check não traz log nem anotação: o texto do erro fica só no [log da build](https://dash.cloudflare.com/aaec42ffcbeebcd4cda5beff4af4c439/workers/services/view/presidente2026/production/builds/fc06d515-c805-4738-9f9c-090c30224558).

## Causa

Dois merges na `main` com 7 s de diferença abriram duas builds de produção do mesmo Worker ao mesmo tempo.

| PR | Commit | Merge (UTC) | Workers Builds (UTC) |
| --- | --- | --- | --- |
| #80 | `ae50f6a` | 14:53:29 | success às 14:55:18 |
| #81 | `2481396` | 14:53:36 | failure às 14:55:01 |

O `void deploy` lê o deployment ativo antes de ativar a versão nova. Se outra operação troca o deployment no meio, ele para com `deployment-changed` (`another Cloudflare operation superseded this deployment`).

O código não explica a falha:

- o `ci` do `2481396` passou às 14:54:38;
- o #81 não toca o Worker: skill `verify-presidente2026`, template de PR, `AGENTS.md`, `scripts.test` e o `exclude` do Vitest;
- a build seguinte da `main` (`615ca8b`, #89, 18/10 às 12:32) passou com a árvore do #81, e todas as builds da `main` depois dela passaram.

O texto exato do erro só está no log da build. Se o log mostrar outra coisa, reabra a #83 com a linha do erro.

## Impacto

Nenhum no site. O #81 não muda o bundle do Worker, então o código no ar era o mesmo com qualquer das duas versões.

## O que mudou

- Um merge por vez na `main`: o próximo espera o Workers Builds do anterior terminar (`AGENTS.md`, README → Deploy).
- A issue do alerta nasce atribuída ao dono do `CODEOWNERS` e com menção no corpo. A #83 ficou seis dias sem dono.
