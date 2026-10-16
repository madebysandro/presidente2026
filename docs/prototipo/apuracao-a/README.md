# Protótipo descartável: apuração na linguagem A (#16)

Pergunta: como fica a noite de 25/10 (aguardando, ao vivo, encerrada) no visual A das pesquisas, em vez do painel escuro do 1º turno?

```bash
python3 -m http.server 8768 -d docs/prototipo
# http://localhost:8768/apuracao-a/?estado=aovivo&heroi=1
```

- `?estado=aguardando|aovivo|virada|encerrada` (setas ← → na barra rosa).
- `?heroi=1|2` (tecla H): **1 · Manchete** é o topo da A com o placar no lugar do veredito; **2 · Campo cheio** é a faixa da vinheta parada no topo, com a divisa andando.
- A barra rosa não faz parte do design.
- Números da apuração são de exemplo (`../segundo-turno/js/mock-2t.js` sobre o 1º turno real). Pesquisas e 1º turno são reais.

Reaproveita `../novo-design/css/a.css` (tokens, Archivo, cabo de guerra, rostos) e o gerador do protótipo `segundo-turno`. Nada daqui vai para `public/` sem reescrita.

## Telas

| Estado | Captura |
|---|---|
| Aguardando 17h · herói 1 | [aguardando-h1](telas/aguardando-h1.png) |
| Ao vivo · herói 1 (página inteira) | [aovivo-h1](telas/aovivo-h1.png) |
| Ao vivo com virada · herói 1 | [virada-h1](telas/virada-h1.png) |
| Ao vivo com virada · herói 2 · 390 px | [virada-h2-390](telas/virada-h2-390.png) |
| Encerrada · herói 2 | [encerrada-h2](telas/encerrada-h2.png) |
| Encerrada · herói 1 · 390 px | [encerrada-h1-390](telas/encerrada-h1-390.png) |

## Deltas em relação ao `segundo-turno/DESIGN-NOTAS.md`

**Entrou como estava:** lados fixos (22 à esquerda), selo "lidera" → "✓ Eleito", gráfico de vantagem com sinal em 0–100% apurado com a faixa "a apurar" e as viradas, análise sem "vencer no 1º turno" e trocada no fim por comparecimento, brancos/nulos e viradas, momentos da noite, cartograma em grade com ↻, por região, todas as UFs, exterior, comparecimento, 10 maiores colégios, do 1º ao 2º turno.

**Mudou:**
- Papel claro e Archivo no lugar do tema escuro `.db-*`; seções sem cartão, separadas por régua (como o detalhe da A).
- Placar ocupa o lugar do veredito da A; o contador de dias vira "% das seções apuradas".
- Cabo de guerra de 14 px com a **marca ▾ da média final das pesquisas**; no fim, a legenda diz o erro da média na vantagem.
- O gráfico ganha a linha tracejada "pesquisas".
- Faixa de status: verde "Ao vivo", cinza "Aguardando 17h", e no fim fica escura com "Resultado final · 2º turno".
- "Pesquisas × urnas" no encerrado, ranqueado pelo erro de cada instituto.
- Antes das 17h o cartograma mostra o 1º turno apagado (resposta à pergunta 4 das notas).
- "Todas as UFs" fica recolhida num `<details>`.

**Ficou de fora:** faixa de DESTAQUES, os 5 KPIs em cartão, minigráficos, barras de fluxo com pontos, "Para onde foram os votos?" (estimativa), tema escuro e alternador de tema.
