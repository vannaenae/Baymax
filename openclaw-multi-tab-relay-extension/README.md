# OpenClaw Multi-Tab Relay Extension (Prototype)

This is a **local prototype** to allow attaching and controlling multiple tabs at once.

## What it does
- Attach multiple tabs (not just one)
- Track active tab separately
- Keep attached tab list in extension storage
- Expose websocket relay to localhost bridge (`ws://127.0.0.1:18793/relay`)

## What it does NOT do yet
- It does not automatically replace OpenClaw’s built-in single-tab relay.
- OpenClaw core would need to be pointed to this bridge/protocol for full integration.

## Install
1. Open Chrome → `chrome://extensions`
2. Enable **Developer mode**
3. Click **Load unpacked**
4. Select this folder:
   - `/Users/vanessaadetoro/clawd/openclaw-multi-tab-relay-extension`

## Use
1. Click extension icon on tab A → **Attach this tab**
2. Go tab B → **Attach this tab**
3. Go tab C → **Attach this tab**
4. Set whichever tab is execution target using **Set this tab active**

## Optional local bridge
Run:
```bash
cd /Users/vanessaadetoro/clawd/openclaw-multi-tab-relay-extension
npm init -y
npm i ws
node bridge-server.js
```

## Next integration step
If you want, next I can build an OpenClaw-compatible adapter so browser tool calls route through this multi-tab bridge.
