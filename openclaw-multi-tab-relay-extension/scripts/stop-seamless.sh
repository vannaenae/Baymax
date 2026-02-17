#!/usr/bin/env bash
set -euo pipefail

DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$DIR"

if [ -f .runtime/bridge.pid ]; then
  PID=$(cat .runtime/bridge.pid || true)
  if [ -n "${PID:-}" ] && kill -0 "$PID" 2>/dev/null; then
    kill "$PID" || true
  fi
  rm -f .runtime/bridge.pid
fi

if pgrep -f "bridge-server.js" >/dev/null 2>&1; then
  pgrep -f "bridge-server.js" | xargs kill -9 || true
fi

echo "🛑 Bridge stopped"
