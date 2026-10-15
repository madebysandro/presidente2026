---
name: verify-presidente2026
description: "Drive the presidente2026 Cloudflare Worker locally (wrangler dev + HTTP + headless browser). Use to prove placeholder page and /api/* after a change, or when asked to verify the site the way a user would."
---

# verify-presidente2026

Project-local verification for **presidente2026.win** (Cloudflare Worker + Static Assets). Primary surface: public web page + JSON APIs. Secondary: Durable Object RPCs (covered only via HTTP seams that touch them).

Evidence root (survives cleanup): `/tmp/presidente2026-verify-<RUN_ID>/evidence/`  
Scratch / PID / logs: `/tmp/presidente2026-verify-<RUN_ID>/scratch/`

Default local URL: `http://127.0.0.1:8787`

## Launch

From the repo root (after `npm ci`):

```bash
export RUN_ID="${RUN_ID:-$(date +%s)}"
export VERIFY_ROOT="/tmp/presidente2026-verify-$RUN_ID"
export VERIFY_URL="${VERIFY_URL:-http://127.0.0.1:8787}"
mkdir -p "$VERIFY_ROOT/evidence" "$VERIFY_ROOT/scratch"
bash .cursor/skills/verify-presidente2026/scripts/launch.sh
```

Ready signal: log line containing `Ready on http://127.0.0.1:8787` (or the port in `VERIFY_URL`), **and** `doctor.sh` exit 0.

Teardown: `bash .cursor/skills/verify-presidente2026/scripts/cleanup.sh` (kills only the PID recorded by launch; never `pkill wrangler`).

Isolation: one instance per `RUN_ID`. Do not drive a shared/dev server you did not start. Concurrent runs need different ports (`VERIFY_URL=http://127.0.0.1:8788` + `PORT=8788`).

## Doctor

```bash
bash .cursor/skills/verify-presidente2026/scripts/doctor.sh
```

Checks: PID file alive, `GET $VERIFY_URL/` returns 200 with body containing `Presidente 2026`, `GET $VERIFY_URL/api/apuracao` returns JSON with `cargos`, CSP header present on `/`.

## Drive

### HTTP (curl)

```bash
curl -sS -D - "$VERIFY_URL/" -o "$VERIFY_ROOT/evidence/home.html"
curl -sS "$VERIFY_URL/api/apuracao" | tee "$VERIFY_ROOT/evidence/apuracao.json"
curl -sS "$VERIFY_URL/api/historico" | tee "$VERIFY_ROOT/evidence/historico.json"
curl -sS -o /dev/null -w "%{http_code}\n" "$VERIFY_URL/api/tela2"
```

### Browser (Playwright MCP or CLI)

Prefer the Playwright MCP (`browser_navigate`, `browser_snapshot`, `browser_take_screenshot`). CLI fallback:

```bash
# once per machine: npx playwright install chromium
npx --yes playwright screenshot "$VERIFY_URL/" \
  "$VERIFY_ROOT/evidence/home.png" --viewport-size=1280,720
```

Stable handles on the placeholder: heading text `Em breve`, paragraph class `.marca` with `Presidente 2026`.

Feature recipes: [features/README.md](features/README.md).

## Evidence

For a proof, capture at least:

1. doctor stdout (`evidence/doctor.txt`)
2. HTML of `/` (`evidence/home.html`) showing brand + Em breve
3. screenshot of `/` (`evidence/home.png`)
4. `/api/apuracao` JSON (`evidence/apuracao.json`) with only `presidente` under `cargos` when TSE is unreachable or empty (local may show empty cargos until first poll completes — assert **no** `governador`/`senador`/`depfed`/`depest` keys if present)
5. unknown `/api/*` → 404 body `não achei`

Proof standards: real HTTP path and real browser render; no mocking of the Worker. External TSE may fail in local net — that is OK for #7 placeholder proof if APIs still respond 200/JSON and the page renders.

## Cleanup

```bash
bash .cursor/skills/verify-presidente2026/scripts/cleanup.sh
```

Removes the wrangler process started by `launch.sh` and scratch PID/log files. **Does not** delete `$VERIFY_ROOT/evidence/`.

## Helpers

| Script | Role |
| --- | --- |
| `scripts/launch.sh` | start `wrangler dev` in background, wait for ready |
| `scripts/doctor.sh` | read-only health |
| `scripts/cleanup.sh` | tear down this RUN_ID's process |
| `scripts/prove-once.sh` | launch → doctor → drive placeholder + apuracao → cleanup; prints evidence paths |

Maintenance: `/maintain-verification-skill` when routes or copy change.
