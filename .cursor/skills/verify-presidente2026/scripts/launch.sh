#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../../../.." && pwd)"
RUN_ID="${RUN_ID:?set RUN_ID}"
VERIFY_ROOT="${VERIFY_ROOT:-/tmp/presidente2026-verify-$RUN_ID}"
VERIFY_URL="${VERIFY_URL:-http://127.0.0.1:8787}"
PORT="$(printf '%s' "$VERIFY_URL" | sed -E 's#.*:([0-9]+)/?$#\1#')"
SCRATCH="$VERIFY_ROOT/scratch"
mkdir -p "$SCRATCH" "$VERIFY_ROOT/evidence"
PIDFILE="$SCRATCH/wrangler.pid"
LOG="$SCRATCH/wrangler.log"

if [[ -f "$PIDFILE" ]] && kill -0 "$(cat "$PIDFILE")" 2>/dev/null; then
	echo "already running pid=$(cat "$PIDFILE") url=$VERIFY_URL"
	exit 0
fi

cd "$ROOT"
# Local bind even when workers_dev is false in wrangler.jsonc.
npx wrangler dev --ip 127.0.0.1 --port "$PORT" >"$LOG" 2>&1 &
echo $! >"$PIDFILE"

for _ in $(seq 1 60); do
	if grep -qE "Ready on http://127.0.0.1:${PORT}|Local: +http://127.0.0.1:${PORT}" "$LOG" 2>/dev/null; then
		# Ready for HTTP, not only process up.
		if curl -sf -o /dev/null "$VERIFY_URL/"; then
			echo "ready $VERIFY_URL pid=$(cat "$PIDFILE")"
			exit 0
		fi
	fi
	sleep 1
done

echo "launch failed; last log:" >&2
tail -n 80 "$LOG" >&2 || true
exit 1
