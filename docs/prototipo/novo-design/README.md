# Protótipo descartável: novo design (15/10/2026)

Pergunta: que cara o site do 2º turno pode ter, em vez do painel escuro denso do 1º turno?

```bash
python3 -m http.server 8767 -d docs/prototipo/novo-design
# http://localhost:8767/?variant=A   (← → trocam a direção)
```

- **A · Três semanas**: a reta final é um calendário de 05/10 a 25/10; cada dia mostra as pesquisas divulgadas, os dias futuros mostram as registradas no TSE. Archivo.
- **B · Fiel da balança**: uma coluna calma; uma frase com a média e um único gráfico de pontos (cada pesquisa pela vantagem). Literata.
- **C · Cabo de guerra**: a tela inteira são dois campos proporcionais à média; rolando, a divisa anda de pesquisa em pesquisa. Big Shoulders Display + Instrument Sans.

Dados reais (`dados/pesquisas.json`, cópia do protótipo `segundo-turno`). Fontes do Google Fonts (OFL) servidas de `fontes/`.
