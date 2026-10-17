# Página de pesquisas

A página `/` mostra o 2º turno: marca, veredito da média, contagem até a votação, calendário e a nota de como a média é calculada. A fase (`pesquisas`, `ao_vivo` ou `encerrada`) vem do poller local.

## Sub-features

- `pagina-abre` carrega `/` com o título e o `<main>`.
- `pagina-veredito` mostra um `h1` (média ou o vazio "Ainda não há média").
- `pagina-larguras` registra a mesma página em 390 px e 1280 px.
- `pagina-ordem` no celular começa pelo dia 25/10. No desktop, pelo dia 05/10 em `pesquisas` e pelo dia 19/10 nas outras fases.

## How to get to it (user POV)

- Abrir a raiz do site.

## Driving it with verificar

Preconditions:

- `doctor` ok em `http://127.0.0.1:5273/`.
- A instância é a do `launch`.

- **Abrir.** Ir à raiz. Run `node .cursor/skills/verify-presidente2026/verificar.mjs drive pagina-pesquisas`. O título é `Presidente 2026 · 2º turno`, existe um `h1` e o heading `Como calculamos`.
- **Larguras.** O mesmo comando grava `pagina-390.png` e `pagina-1280.png` na pasta `prova`.
- **Ordem dos dias.** Em 390 px o `.a-dia` visível mais alto tem `data-d` `2026-10-25`. Em 1280 px, `2026-10-05` na fase `pesquisas` e `2026-10-19` em `ao_vivo` ou `encerrada`.
- **Prova.** O JSON `pagina-pesquisas.json` repete título, `h1`, `data-fase` e o dia do topo.

## Gotchas

- Com média publicada existe `.a-cabo` e a vinheta `.a-intro`. Escape pula. Sem média não há cabo e a vinheta não sobe.
- `data-fase` é `pesquisas`, `ao_vivo` ou `encerrada`. Em outubro de 2026, antes das 17h de 25/10, o local observado ficou em `pesquisas`.
- Em `pesquisas`, o dia visível no topo é 25/10 em 390 px e 05/10 em 1280 px. Em `ao_vivo` e `encerrada` o calendário encolhe para 19/10–25/10, então o topo em 1280 px é 19/10. Dias vazios ficam `display: none` abaixo de 760 px e não entram na medida.
