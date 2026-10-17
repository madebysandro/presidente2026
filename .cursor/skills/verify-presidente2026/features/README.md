# Mapa de verificação do Presidente 2026

Fonte mantida do que o usuário vê em `presidente2026.win` no 2º turno (eleição `6258`). Leia o índice e siga o arquivo da feature.

## Baseline preconditions

- Node 24.21 (`.nvmrc`) no `PATH`.
- `node .cursor/skills/verify-presidente2026/verificar.mjs launch` sobe o Vite em `http://127.0.0.1:5273/` com `VOID_REMOTE=0`.
- `node .cursor/skills/verify-presidente2026/verificar.mjs doctor` passa antes de dirigir.
- Uma instância só. O estado fica em `.void/`. Não dirija um `npm run dev` que esta verificação não iniciou.
- Sem `wrangler`, sem `npm run deploy`, sem token da Cloudflare.

## Driving conventions

- Comece do estado que o doctor acabou de ver.
- Prefira papel e nome acessível. Os alvos estáveis estão em cada feature.
- Trate cada comando como literal.
- O harness é `node .cursor/skills/verify-presidente2026/verificar.mjs`.
- A evidência fica em `artifacts/verificacao/provas/<instante>/`. O cleanup não apaga essa pasta.

## Proof and skip reporting

- Registre a ação e o estado resultante.
- Prova de UI: PNG em 390 px e 1280 px, mais o JSON com título, `h1` e fase.
- Prova de API: status e corpo.
- Caminho impossível (por exemplo, chip de instituto sem pesquisa publicada) entra em `Gotchas` com o que faltou. Não troque o caminho por outro e chame de verificado.

## Features

- [Página de pesquisas](./pagina-pesquisas.md) abre `/` e confere o veredito nas duas larguras.
- [Calendário](./calendario.md) confere os 21 dias e a ordem do dia no topo no celular e no desktop.
- [Gráfico da vantagem](./grafico-vantagem.md) confere o gráfico vazio ou os institutos.
- [APIs públicas](./apis-publicas.md) lê `/api/pesquisas` e `/api/apuracao`.
- [Prévia OG](./previa-og.md) baixa `/og.png` e confere o PNG de 1200×630.
