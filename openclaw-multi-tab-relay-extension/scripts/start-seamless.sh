#!/usr/bin/env bash
set -euo pipefail

DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$DIR"
mkdir -p .runtime

if [ ! -f package.json ]; then
  npm init -y >/dev/null 2>&1
fi

if [ ! -d node_modules/ws ]; then
  npm i ws >/dev/null 2>&1
fi

# hard stop any stale instances
if pgrep -f "openclaw-multi-tab-relay-extension/scripts/bridge-supervisor.sh" >/dev/null 2>&1; then
  pgrep -f "openclaw-multi-tab-relay-extension/scripts/bridge-supervisor.sh" | xargs kill -9 || true
fi
if pgrep -f "openclaw-multi-tab-relay-extension/bridge-server.js" >/dev/null 2>&1; then
  pgrep -f "openclaw-multi-tab-relay-extension/bridge-server.js" | xargs kill -9 || true
fi

nohup "$DIR/scripts/bridge-supervisor.sh" >/dev/null 2>&1 &
echo $! > .runtime/launcher.pid

# wait for health
for _ in {1..20}; do
  if curl -fsS http://127.0.0.1:18793/health >/dev/null 2>&1; then
    echo "✅ Bridge running (managed): ws://127.0.0.1:18793/relay"
    exit 0
  fi
  sleep 0.25
done

echo "❌ Bridge failed to start. Check .runtime/bridge.log and .runtime/supervisor.log"
exit 1
