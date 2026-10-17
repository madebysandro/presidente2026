# Gráfico da vantagem

A seção `A vantagem, dia a dia` mostra a média e um botão por instituto. Sem pesquisa publicada, o texto é `Ainda não há pesquisas publicadas neste gráfico.`

## Sub-features

- `grafico-ver` mostra o título da seção.
- `grafico-vazio` mostra o texto de gráfico vazio quando não há ponto.
- `grafico-instituto` tira um instituto do gráfico pelo botão com `aria-pressed`.

## How to get to it (user POV)

- Abrir `/` e descer até `A vantagem, dia a dia`.

## Driving it with verificar

Preconditions:

- A página `/` está no ar.
- Para `grafico-instituto`, o grupo `Institutos no gráfico` tem pelo menos um botão. Com `.a-graf-vazio` visível, essa jornada falha.

- **Ver.** Run `node .cursor/skills/verify-presidente2026/verificar.mjs provar --base http://127.0.0.1:5173 --base-ref main`. `pagina.comoCalculamos` é `Como calculamos`. Se `pagina.graficoVazio` é verdadeiro, o texto `Ainda não há pesquisas publicadas neste gráfico.` está na página.
- **Tirar um instituto.** Acionar um botão dentro do grupo `Institutos no gráfico`. O `aria-pressed` desse botão troca. Sem o grupo, parar. Não tratar o parágrafo vazio como instituto desligado.
- **Prova.** As capturas de `/` mostram o título `A vantagem, dia a dia`.

## Gotchas

- O gráfico vazio é o estado honesto enquanto não houver pesquisa com número. Não inventar ponto para a captura passar.
- O botão do instituto só existe quando há série. O texto de instrução (`Toque num instituto para tirá-lo do gráfico.`) aparece nos dois estados e não prova o clique.
