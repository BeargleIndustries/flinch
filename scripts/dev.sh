#!/usr/bin/env bash
# Browser dev mode (brief 12.6): the sidecar on 8000 and `vite dev` on 5173,
# which proxies the API to the sidecar. Ctrl+C stops both.
#
# Keys come from `.env` through the sidecar, so the sidecar never waits on the
# desktop shell's stdin handoff (--no-stdin-keys).
#
# Usage: scripts/dev.sh   (set PYTHON to pick an interpreter; default python)
set -euo pipefail

cd "$(dirname "$0")/.."

PYTHON="${PYTHON:-python}"
SIDECAR_PID=""

stop_sidecar() {
  if [ -n "$SIDECAR_PID" ] && kill -0 "$SIDECAR_PID" 2>/dev/null; then
    kill "$SIDECAR_PID" 2>/dev/null || true
    wait "$SIDECAR_PID" 2>/dev/null || true
  fi
}
trap stop_sidecar EXIT
trap 'exit 130' INT TERM

"$PYTHON" -m flinch.app --port 8000 --no-stdin-keys &
SIDECAR_PID=$!

echo "Open http://127.0.0.1:5173"
# In the foreground, so Ctrl+C reaches vite; the EXIT trap then stops the sidecar.
npm --prefix ui run dev
