#!/usr/bin/env bash
set -euo pipefail
RUN_ID="${RUN_ID:?set RUN_ID}"
VERIFY_ROOT="${VERIFY_ROOT:-/tmp/presidente2026-verify-$RUN_ID}"
VERIFY_URL="${VERIFY_URL:-http://127.0.0.1:8787}"
SCRATCH="$VERIFY_ROOT/scratch"
PIDFILE="$SCRATCH/wrangler.pid"
OUT="${1:-/dev/stdout}"

{
	echo "VERIFY_URL=$VERIFY_URL"
	if [[ ! -f "$PIDFILE" ]] || ! kill -0 "$(cat "$PIDFILE")" 2>/dev/null; then
		echo "doctor: wrangler pid missing/dead" >&2
		exit 1
	fi
	echo "pid=$(cat "$PIDFILE") alive"

	HOME_BODY="$(curl -sS -D "$SCRATCH/home.hdr" "$VERIFY_URL/")"
	echo "$HOME_BODY" | grep -q "Presidente 2026"
	echo "$HOME_BODY" | grep -q "Em breve"
	grep -qi "content-security-policy" "$SCRATCH/home.hdr"
	echo "GET / ok + CSP"

	curl -sS -o "$SCRATCH/apuracao.json" -w "apuracao_http=%{http_code}\n" "$VERIFY_URL/api/apuracao" | tee /dev/stderr | grep -q 'apuracao_http=200'
	VERIFY_ROOT="$VERIFY_ROOT" python3 - <<'PY'
import json, pathlib, os
p = pathlib.Path(os.environ["VERIFY_ROOT"]) / "scratch" / "apuracao.json"
data = json.loads(p.read_text())
assert isinstance(data, dict), data
cargos = data.get("cargos") or {}
for banned in ("governador", "senador", "depfed", "depest"):
    assert banned not in cargos, banned
print("apuracao json ok; no Pará/proporcional cargos")
PY

	CODE="$(curl -sS -o "$SCRATCH/api404.txt" -w "%{http_code}" "$VERIFY_URL/api/tela2")"
	test "$CODE" = "404"
	grep -qx "não achei" "$SCRATCH/api404.txt"
	echo "GET /api/tela2 → 404 não achei"
	echo "doctor: PASS"
} | tee "$OUT"
