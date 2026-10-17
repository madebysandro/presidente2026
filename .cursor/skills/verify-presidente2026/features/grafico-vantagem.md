# Gráfico da vantagem

A seção "A vantagem, dia a dia" desenha a média e um botão por instituto. Sem pesquisa publicada, a seção diz que o gráfico está vazio.

## Sub-features

- `graf-vazio` mostra a frase de gráfico vazio.
- `graf-instituto` mostra o grupo "Institutos no gráfico" quando há pesquisa publicada.

## How to get to it (user POV)

- Abrir `/` e ir até "A vantagem, dia a dia".
- Quando houver institutos, tocar num botão para tirá-lo da linha.

## Driving it with verificar

Preconditions:

- `doctor` ok em `http://127.0.0.1:5273/`.

- **Estado do gráfico.** Ler o HTML da raiz. Run `node .cursor/skills/verify-presidente2026/verificar.mjs drive grafico-vantagem`. O corpo tem `Ainda não há pesquisas publicadas neste gráfico.` ou `aria-label="Institutos no gráfico"`.
- **Prova.** `grafico.txt` na pasta `prova` diz `vazio` ou `com institutos`.

## Gotchas

- Os números não vêm do ZIP do TSE. Entram pelo agente. Num `.void/` sem publicações o gráfico fica vazio. Não cadastre número só para a prova.
- O toque que desliga um instituto só existe com o grupo de chips. Com gráfico vazio, reporte que o clique não tem pré-condição. Não marque esse clique como verificado.
