# API de pesquisas

`GET /api/pesquisas` devolve a média, o calendário e a ficha no JSON que a página também usa.

## Sub-features

- `api-pesquisas-ok` responde 200 com `fase` e `hoje`.
- `api-pesquisas-media` traz `media` nula ou um objeto com os votos válidos, sem HTML.

## How to get to it (user POV)

- Pedir `http://127.0.0.1:5173/api/pesquisas`.
- A página `/` não é esta feature.

## Driving it with verificar

Preconditions:

- O mesmo servidor do doctor está no ar.

- **Ler.** Run `curl -fsS -D - http://127.0.0.1:5173/api/pesquisas -o /tmp/verify-api-pesquisas.json`. O status é `200`, o `content-type` contém `application/json` e o corpo tem `fase`, `hoje` e `media`.
- **Prova.** Guardar o status e as chaves no relatório da prova. Não substituir esta chamada por um import interno do módulo.

## Gotchas

- O cache de borda (`s-maxage=30`) não se aplica ao Miniflare local. Ainda assim o corpo precisa ser JSON, não a página HTML.
- `media: null` é válido enquanto não houver número publicado.
