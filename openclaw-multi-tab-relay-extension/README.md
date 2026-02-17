# OpenClaw Multi-Tab Relay Extension

A Chrome extension prototype that lets you attach **multiple tabs** for OpenClaw workflows.

> Status: Prototype (public, usable, not yet wired into OpenClaw core browser routing by default)

## Why this exists
OpenClaw’s current Chrome relay flow is effectively single-active-tab for reliable control.
This project adds a practical multi-tab control layer so you can:
- attach several tabs
- switch active control tab quickly
- keep tab context during longer workflows

## Features
- Attach / detach current tab
- Track multiple attached tab IDs
- Set active tab for command targeting
- Local websocket bridge support (`ws://127.0.0.1:18793/relay`)
- Persistent state in extension storage

## Folder structure
- `manifest.json` – extension config (MV3)
- `service_worker.js` – core relay state + bridge handling
- `popup.html` / `popup.js` – tab controls UI
- `bridge-server.js` – local websocket bridge prototype

## Install (Chrome)
1. Open `chrome://extensions`
2. Enable **Developer mode**
3. Click **Load unpacked**
4. Select this folder:
   - `openclaw-multi-tab-relay-extension`

## Quick usage
1. Open tab A → extension popup → **Attach this tab**
2. Open tab B → **Attach this tab**
3. Open tab C → **Attach this tab**
4. Use **Set this tab active** on whichever tab should receive next commands

## Optional local bridge
```bash
cd openclaw-multi-tab-relay-extension
npm init -y
npm i ws
node bridge-server.js
```

Health check:
- `http://127.0.0.1:18793/health`

## Limitations
- This does **not** automatically replace OpenClaw’s built-in extension relay.
- An adapter is needed to route OpenClaw browser tool calls through this bridge by default.

## Roadmap
- [ ] OpenClaw-compatible adapter layer
- [ ] Better auth/token handshake for bridge messages
- [ ] Stable tab aliases (human names)
- [ ] UI for attached tab list + quick switching
- [ ] Packaging + store-ready metadata

## License
MIT
