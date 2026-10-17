# Página de pesquisas

A página `/` mostra o 2º turno: marca, veredito da média, contagem até a votação, calendário e a nota de como a média é calculada. A fase (`pesquisas`, `apuracao` ou `encerrada`) vem do poller local.

## Sub-features

- `pagina-abre` carrega `/` com o título e o `<main>`.
- `pagina-veredito` mostra um `h1` (média ou o vazio "Ainda não há média").
- `pagina-larguras` registra a mesma página em 390 px e 1280 px.
- `pagina-ordem` no celular começa pelo dia 25/10; no desktop, pelo dia 05/10.

## How to get to it (user POV)

- Abrir a raiz do site.

## Driving it with verificar

Preconditions:

- `doctor` ok em `http://127.0.0.1:5273/`.
- A instância é a do `launch`.

- **Abrir.** Ir à raiz. Run `node .cursor/skills/verify-presidente2026/verificar.mjs drive pagina-pesquisas`. O título é `Presidente 2026 · 2º turno`, existe um `h1` e o heading `Como calculamos`.
- **Larguras.** O mesmo comando grava `pagina-390.png` e `pagina-1280.png` na pasta `prova`.
- **Ordem dos dias.** Em 390 px o `.a-dia` mais alto tem `data-d` `2026-10-25`. Em 1280 px, `2026-10-05`.
- **Prova.** O JSON `pagina-pesquisas.json` repete título, `h1`, `data-fase` e o dia do topo.

## Gotchas

- Com média publicada existe `.a-cabo` e a vinheta `.a-intro`. Escape pula. Sem média não há cabo e a vinheta não sobe.
- `data-fase` segue o relógio e o poller. Em outubro de 2026, antes da votação, o local observado ficou em `pesquisas`. Outra fase válida não é falha de seletor; o harness aceita `pesquisas`, `apuracao` e `encerrada`.
- O dia do topo em 390 px é o primeiro `.a-dia` visível. Dias vazios ficam `display: none` abaixo de 760 px e não entram na medida. A coluna invertida coloca 25/10 no alto. Se o CSS mudar, esta prova falha de propósito.
