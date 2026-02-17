#!/usr/bin/env bash
set -euo pipefail

DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$DIR"
mkdir -p .runtime

echo $$ > .runtime/supervisor.pid

echo "[$(date -u +%FT%TZ)] supervisor:start" >> .runtime/supervisor.log

while true; do
  echo "[$(date -u +%FT%TZ)] bridge:start" >> .runtime/supervisor.log
  node bridge-server.js >> .runtime/bridge.log 2>&1 || true
  echo "[$(date -u +%FT%TZ)] bridge:exit -> restart in 1s" >> .runtime/supervisor.log
  sleep 1
done
