# Apuração API

`GET /api/apuracao` returns the poller state for election **6258**, scoped to Presidente Brasil (no Pará cargos).

## Sub-features

- `apuracao-200` returns JSON 200 with cache headers.
- `apuracao-presidente-only` never includes governador/senador/depfed/depest keys.
- `apuracao-poller` is backed by DO name `ele-6258` (not the old singleton).

## How to get to it (user POV)

- A page (or agent) fetches `/api/apuracao`.
- `curl "$VERIFY_URL/api/apuracao"`.

## Driving it with curl

Preconditions:

- Worker healthy at `$VERIFY_URL`.

- **Fetch.** `curl -sS "$VERIFY_URL/api/apuracao" | tee evidence/apuracao.json`. HTTP 200; body is JSON with `cargos` object.
- **Scope.** Assert keys `governador`, `senador`, `depfed`, `depest` are absent. If `presidente` is present, `titulo` is `Presidente` and `local` is `Brasil` when the TSE responded.
- **Proof.** Save the JSON artifact. Optional: after waiting for first poll, `presidente` appears; empty `cargos` right after boot can happen before the DO finishes — re-fetch once.

## Gotchas

- Local TSE may be blocked or slow; a 200 with empty `cargos` still proves the route. Do not require live TSE numbers for a placeholder proof.
- Do not call Durable Object RPC from this feature; the HTTP seam is the contract.
