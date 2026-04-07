#!/usr/bin/env bash
set -euo pipefail

APP_DIR="${APP_DIR:-$(cd "$(dirname "$0")/.." && pwd)}"
BACKEND_PORT="${BACKEND_PORT:-8080}"
VITE_PORT="${VITE_PORT:-5173}"
HOST="${HOST:-0.0.0.0}"

PID_DIR="/tmp"
VITE_PID="$PID_DIR/politikum-vite.pid"
VITE_LOG="$PID_DIR/politikum-vite.log"

say() { echo "[politikum-ui] $*"; }

kill_pidfile() {
  local pidfile="$1"
  if [[ -f "$pidfile" ]]; then
    local pid
    pid="$(cat "$pidfile" 2>/dev/null || true)"
    if [[ -n "${pid:-}" ]] && kill -0 "$pid" 2>/dev/null; then
      kill "$pid" 2>/dev/null || true
      sleep 0.3
      kill -9 "$pid" 2>/dev/null || true
    fi
    rm -f "$pidfile"
  fi
}

start_vite() {
  cd "$APP_DIR"
  say "starting vite on :$VITE_PORT (proxy -> backend :$BACKEND_PORT)"
  nohup env VITE_API_SERVER="http://localhost:$BACKEND_PORT" npm run dev -- --host "$HOST" --port "$VITE_PORT" >"$VITE_LOG" 2>&1 &
  echo $! >"$VITE_PID"
}

cmd="${1:-start}"
case "$cmd" in
  start)
    kill_pidfile "$VITE_PID"
    start_vite
    say "UI:  http://localhost:$VITE_PORT/"
    say "API: http://localhost:$BACKEND_PORT/"
    ;;
  stop)
    kill_pidfile "$VITE_PID"
    ;;
  status)
    say "vite pid: $(cat "$VITE_PID" 2>/dev/null || echo '-')"
    ;;
  logs)
    tail -n 80 "$VITE_LOG" 2>/dev/null || true
    ;;
  *)
    echo "Usage: $0 {start|stop|status|logs}"
    exit 2
    ;;
esac
