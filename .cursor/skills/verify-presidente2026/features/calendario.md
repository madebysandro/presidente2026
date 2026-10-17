# Calendário

O calendário lista os dias de 5 a 25 de outubro. Um dia com pesquisa publicada é um botão. O dia vazio não abre ficha.

## Sub-features

- `calendario-ver` mostra a seção com os dias da semana.
- `calendario-abrir` abre a ficha de uma pesquisa publicada.
- `calendario-vazio` deixa o dia sem botão quando não há número publicado.

## How to get to it (user POV)

- Abrir `/` e descer até a seção `Calendário das pesquisas`.

## Driving it with verificar

Preconditions:

- A página de pesquisas está aberta em `http://127.0.0.1:5173/`.
- Para `calendario-abrir`, existe um `button` com classe `a-pesq`. Sem esse botão a jornada falha.

- **Ver a seção.** Run `node .cursor/skills/verify-presidente2026/verificar.mjs provar --base http://127.0.0.1:5173 --base-ref main`. `relatorio.json` tem `pagina.calendario` começando com `Calendário das pesquisas`.
- **Abrir uma pesquisa.** No Chrome, acionar o botão cujo nome acessível começa pelo instituto. A região `section.a-det` passa a mostrar o nome do instituto. Sem `button.a-pesq`, parar e registrar a precondição. Não clicar num `div.a-dia` vazio no lugar.
- **Prova.** A captura de `/` em 390 px e 1280 px mostra a grade de dias. A ficha aberta, quando a precondição existe, fica na mesma página.

## Gotchas

- Número publicado entra pelo agente, não pelo ZIP do TSE. Com a base local só do import, `pagina.pesquisasPublicadas` fica `0` e `calendario-abrir` falha de propósito.
- O rótulo da seção inclui o intervalo de datas. Comparar pelo prefixo `Calendário das pesquisas`.
