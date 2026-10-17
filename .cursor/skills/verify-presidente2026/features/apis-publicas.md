# APIs públicas

`GET /api/pesquisas` devolve a média, o calendário e a ficha. `GET /api/apuracao` devolve o estado do poller local. As duas respondem sem chave.

## Sub-features

- `api-pesquisas` lê o JSON público das pesquisas.
- `api-apuracao` lê o JSON público da apuração.

## How to get to it (user POV)

- Pedir `GET /api/pesquisas`.
- Pedir `GET /api/apuracao`.

## Driving it with verificar

Preconditions:

- `doctor` ok em `http://127.0.0.1:5273/`.

- **Pesquisas e apuração.** Run `node .cursor/skills/verify-presidente2026/verificar.mjs drive apis-publicas`. As duas rotas respondem 200 e JSON. `/api/pesquisas` tem `fase`. Os corpos ficam em `api-pesquisas.json` e `api-apuracao.json`.

## Gotchas

- `/api/agente/*` exige `CHAVE_AGENTE`. Esta feature não chama essas rotas.
- `/api/historico` existe e não entra neste comando. Um PR que mude essa rota usa `paginas --path /api/historico`.
