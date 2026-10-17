# API de apuração

`GET /api/apuracao` devolve o estado do poller do 2º turno: fase, cargos e o erro, se houver.

## Sub-features

- `api-apuracao-ok` responde 200 com `fase`.
- `api-apuracao-fase` usa a mesma fase que `main[data-fase]` na página.

## How to get to it (user POV)

- Pedir `http://127.0.0.1:5173/api/apuracao`.

## Driving it with verificar

Preconditions:

- O mesmo servidor do doctor está no ar.
- A página `/` já foi lida, para comparar a fase.

- **Ler.** Run `curl -fsS -D - http://127.0.0.1:5173/api/apuracao -o /tmp/verify-api-apuracao.json`. O status é `200`, o `content-type` contém `application/json` e o corpo tem `fase`.
- **Cruzar.** O `fase` do JSON é o mesmo `pagina.fase` do `relatorio.json`.
- **Prova.** Status, `content-type` e `fase` ficam no relatório. A página HTML não substitui esta chamada.

## Gotchas

- Antes da noite, `fase` vem `pesquisas` nos dois lugares. Isso não prova o placar ao vivo.
- A rota não aceita uma fase na query. Não acrescentar parâmetro para forçar `ao_vivo`.
