#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../../../.." && pwd)"
export RUN_ID="${RUN_ID:-$(date +%s)}"
export VERIFY_ROOT="${VERIFY_ROOT:-/tmp/presidente2026-verify-$RUN_ID}"
export VERIFY_URL="${VERIFY_URL:-http://127.0.0.1:8787}"
SCRIPTS="$(cd "$(dirname "$0")" && pwd)"
EVIDENCE="$VERIFY_ROOT/evidence"
mkdir -p "$EVIDENCE"

cleanup() { bash "$SCRIPTS/cleanup.sh" || true; }
trap cleanup EXIT

bash "$SCRIPTS/launch.sh"
bash "$SCRIPTS/doctor.sh" "$EVIDENCE/doctor.txt"

curl -sS -D "$EVIDENCE/home.headers.txt" "$VERIFY_URL/" -o "$EVIDENCE/home.html"
curl -sS "$VERIFY_URL/api/apuracao" | tee "$EVIDENCE/apuracao.json" >/dev/null
curl -sS "$VERIFY_URL/api/historico" | tee "$EVIDENCE/historico.json" >/dev/null
curl -sS -o "$EVIDENCE/api404.txt" -w "%{http_code}" "$VERIFY_URL/api/tela2" | tee "$EVIDENCE/api404.code.txt" >/dev/null

# Headless page check (install once: npx playwright install chromium)
npx --yes playwright screenshot "$VERIFY_URL/" "$EVIDENCE/home.png" --viewport-size=1280,720

# Assert page copy
grep -q "Presidente 2026" "$EVIDENCE/home.html"
grep -q "Em breve" "$EVIDENCE/home.html"
grep -qi "content-security-policy" "$EVIDENCE/home.headers.txt"
test -s "$EVIDENCE/home.png"

python3 - <<PY
import json, pathlib
root = pathlib.Path("$EVIDENCE")
apuracao = json.loads((root / "apuracao.json").read_text())
cargos = apuracao.get("cargos") or {}
for banned in ("governador", "senador", "depfed", "depest"):
    assert banned not in cargos, banned
assert (root / "api404.txt").read_text() == "não achei"
assert (root / "api404.code.txt").read_text().strip() == "404"
print("prove-once assertions OK")
PY

echo "PROOF_OK RUN_ID=$RUN_ID"
echo "EVIDENCE=$EVIDENCE"
ls -la "$EVIDENCE"
