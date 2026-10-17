# Página de pesquisas

A página `/` mostra a média do 2º turno, a contagem até a votação, o calendário e o texto de como a média é calculada. Sem números publicados, o título é `Ainda não há média`.

## Sub-features

- `pagina-abrir` entrega o HTML com título, marca e `data-fase`.
- `pagina-veredito` mostra um `h1` com a média ou com `Ainda não há média`.
- `pagina-rever` volta ao topo pelo botão `Rever as três semanas` e continua em `/`.

## How to get to it (user POV)

- Abrir `http://127.0.0.1:5173/`.
- Não há outra URL para esta página.

## Driving it with verificar

Preconditions:

- O doctor em `http://127.0.0.1:5173` está ok.
- `data-fase` no `main` é `pesquisas`. Se for `ao_vivo` ou `encerrada`, esta feature não foi alcançada.

- **Abrir.** Run `node .cursor/skills/verify-presidente2026/verificar.mjs provar --base http://127.0.0.1:5173 --base-ref main`. O `relatorio.json` traz `pagina.titulo` igual a `Presidente 2026 · 2º turno` e `pagina.h1` não vazio. Esta feature só está provada se `pagina.fase` for `pesquisas`. Outra fase encerra a jornada aqui. Existem `pagina-390.png` e `pagina-1280.png`.
- **Rever.** O mesmo comando desce a página e clica em `Rever as três semanas` a 1280 px. `pagina.scrollAntes` é maior que 0, o scroll volta a 0, `pagina.h1Depois` continua não vazio e existe `acao-rever-1280.png`.
- **Prova.** As duas larguras mostram a marca `Presidente 2026, 2º turno` e o `h1`.

## Gotchas

- O primeiro acesso baixa o registro público do TSE para `.void/`. Sem rede até esse CDN a página não fica utilizável.
- A fase não é query string. Antes das 17h de 25/10/2026 em Brasília o dev local fica em `pesquisas`.
- O relógio `data-relogio` muda a cada segundo. A prova é o texto do `h1` e a marca, não um pixel do relógio.
- `prefers-reduced-motion: reduce` deixa a vinheta parada. O botão de rever ainda existe.
