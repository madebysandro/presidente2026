#!/usr/bin/env bash
set -euo pipefail
RUN_ID="${RUN_ID:?set RUN_ID}"
VERIFY_ROOT="${VERIFY_ROOT:-/tmp/presidente2026-verify-$RUN_ID}"
VERIFY_URL="${VERIFY_URL:-http://127.0.0.1:8787}"
PORT="$(printf '%s' "$VERIFY_URL" | sed -E 's#.*:([0-9]+)/?$#\1#')"
PIDFILE="$VERIFY_ROOT/scratch/wrangler.pid"

stop_pid() {
	local pid="$1"
	[[ -n "$pid" ]] || return 0
	if kill -0 "$pid" 2>/dev/null; then
		# Kill descendants first (workerd), then the shell/node parent.
		pkill -P "$pid" 2>/dev/null || true
		kill "$pid" 2>/dev/null || true
		sleep 1
		pkill -9 -P "$pid" 2>/dev/null || true
		kill -9 "$pid" 2>/dev/null || true
		echo "stopped pid=$pid"
	fi
}

if [[ -f "$PIDFILE" ]]; then
	stop_pid "$(cat "$PIDFILE")"
	rm -f "$PIDFILE"
fi

# Safety net scoped to this verify port (matches launch flags, not bare "wrangler").
pkill -f "wrangler dev --ip 127.0.0.1 --port ${PORT}" 2>/dev/null || true
pkill -f "socket-addr=entry=127.0.0.1:${PORT}" 2>/dev/null || true
if command -v lsof >/dev/null; then
	for p in $(lsof -t -iTCP:"$PORT" -sTCP:LISTEN 2>/dev/null || true); do
		stop_pid "$p"
	done
fi
sleep 1

echo "cleanup done; evidence at $VERIFY_ROOT/evidence"
