# presidente2026 verification map

Maintained recipes for driving the Worker the way a visitor (or agent) does. Read this index, then the feature file.

## Baseline preconditions

- Launch with `scripts/launch.sh` (`RUN_ID` set). Default URL `http://127.0.0.1:8787`.
- `scripts/doctor.sh` passes.
- Never drive an instance you did not start.

## Driving conventions

- Prefer page text (`Presidente 2026`, `Em breve`) and route paths over brittle CSS.
- HTTP proofs use `curl`; browser proofs use Playwright MCP or `npx playwright screenshot`.
- Keep evidence under `/tmp/presidente2026-verify-$RUN_ID/evidence/`.

## Features

- [Placeholder page](./placeholder-page.md) — public shell + CSP
- [Apuração API](./api-apuracao.md) — `GET /api/apuracao` Presidente-only
- [Unknown API](./api-unknown.md) — short 404 for `/api/*` leftover routes
