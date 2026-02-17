# Beginner Setup Guide (Step-by-Step)

If you are non-technical, follow this exact checklist.

## What you are installing
This extension lets you attach multiple Chrome tabs and control them through a local relay.

---

## 1) Install the extension in Chrome

1. Open Chrome.
2. In the address bar, type: `chrome://extensions`
3. Turn on **Developer mode** (top-right).
4. Click **Load unpacked**.
5. Select this folder:
   - `openclaw-multi-tab-relay-extension`

You should now see: **OpenClaw Multi-Tab Relay 0.1.0**.

---

## 2) Start the local bridge (one command)

Open Terminal and run:

```bash
cd ~/clawd/openclaw-multi-tab-relay-extension
./scripts/start-seamless.sh
```

Expected success message:

`✅ Bridge running: ws://127.0.0.1:18793/relay`

---

## 3) Attach your tabs

For each tab you want to control:

1. Open the tab (example: X, Reddit).
2. Click the extension icon.
3. Click **Attach this tab**.

Repeat for all tabs.

---

## 4) Choose active tab

On the tab you want to control now:

1. Click extension icon.
2. Click **Set this tab active**.

---

## 5) Check bridge status anytime

```bash
./scripts/status-seamless.sh
```

If running, you’ll see:

`✅ Bridge healthy`

---

## 6) Stop bridge when done

```bash
./scripts/stop-seamless.sh
```

---

## Common issues

### "Bridge not running"
Run:

```bash
./scripts/start-seamless.sh
```

### "No tabs attached"
Open each tab → extension popup → **Attach this tab**.

### "Wrong tab is being controlled"
Go to the correct tab → **Set this tab active**.

### Extension seems frozen
In popup, click **Reconnect bridge**.

---

## Quick reset (safe)

```bash
./scripts/stop-seamless.sh
./scripts/start-seamless.sh
```

Then re-attach tabs.

---

## You are done
Once bridge is healthy and tabs are attached, you’re fully operational.
