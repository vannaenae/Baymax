#!/usr/bin/env bash
set -euo pipefail

DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$DIR"

if [ -f .runtime/supervisor.pid ]; then
  PID=$(cat .runtime/supervisor.pid || true)
  if [ -n "${PID:-}" ] && kill -0 "$PID" 2>/dev/null; then
    kill -9 "$PID" || true
  fi
  rm -f .runtime/supervisor.pid
fi

if pgrep -f "openclaw-multi-tab-relay-extension/scripts/bridge-supervisor.sh" >/dev/null 2>&1; then
  pgrep -f "openclaw-multi-tab-relay-extension/scripts/bridge-supervisor.sh" | xargs kill -9 || true
fi
if pgrep -f "openclaw-multi-tab-relay-extension/bridge-server.js" >/dev/null 2>&1; then
  pgrep -f "openclaw-multi-tab-relay-extension/bridge-server.js" | xargs kill -9 || true
fi

rm -f .runtime/launcher.pid

echo "🛑 Bridge stopped"
