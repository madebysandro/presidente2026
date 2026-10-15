# Unknown API routes

Leftover first-turn paths such as `/api/tela2` must not exist. Unknown `/api/*` returns a short 404.

## Sub-features

- `api-404` returns status 404 and body `não achei`.

## How to get to it (user POV)

- Request any unknown `/api/...` path.

## Driving it with curl

Preconditions:

- Worker healthy at `$VERIFY_URL`.

- **Hit ghost route.** `curl -sS -o evidence/api404.txt -w "%{http_code}" "$VERIFY_URL/api/tela2"`. Expect `404` and body exactly `não achei`.
- **Proof.** Save status code and body files.

## Gotchas

- Only `/api/*` is handled by the Worker first; other paths fall through to Static Assets (may 404 HTML). Use an `/api/` prefix for this check.
