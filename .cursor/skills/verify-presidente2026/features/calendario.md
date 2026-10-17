# Calendário

O calendário da reta final lista um dia de 5 a 25 de outubro. No celular a coluna começa pelo dia mais recente. O botão "Rever as três semanas" volta ao topo e, se houver cabo, repete a vinheta.

## Sub-features

- `cal-dias` mostra 21 dias na região do calendário.
- `cal-rever` aciona "Rever as três semanas".
- `cal-ordem` é a ordem do dia no topo, medida em `pagina-pesquisas`.

## How to get to it (user POV)

- Abrir `/` e descer até o calendário.
- Escolher "Rever as três semanas" na legenda.

## Driving it with verificar

Preconditions:

- `doctor` ok em `http://127.0.0.1:5273/`.
- A fase da página inclui o calendário de 5 a 25 de outubro (fase `pesquisas`). Na apuração o calendário encolhe para a última semana e esta receita não se aplica.

- **Região.** Achar o calendário. Run `node .cursor/skills/verify-presidente2026/verificar.mjs drive calendario`. A região se chama `Calendário das pesquisas, de 5 a 25 de outubro` e há 21 `.a-dia`.
- **Rever.** O mesmo comando escolhe `Rever as três semanas` e grava `calendario-390.png`.
- **Ordem.** A ordem do topo está em `drive pagina-pesquisas`, não neste comando.

## Gotchas

- Pesquisa com número é um botão `.a-pesq`. Sem número publicado o dia mostra o texto "sem números ainda" ou o item futuro, e não há botão para abrir ficha. Não invente um clique numa pesquisa que o TSE local não publicou.
- "Rever as três semanas" com `.a-cabo` e movimento ligado dispara a vinheta de novo. Sem cabo, só volta ao topo.
- Fase `ao_vivo` ou `encerrada` troca o rótulo para a última semana. Reporte o pré-requisito em vez de aceitar a região errada.
