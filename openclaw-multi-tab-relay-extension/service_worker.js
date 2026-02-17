const BRIDGE_URL = 'ws://127.0.0.1:18793/relay';
const STATE_KEY = 'multiTabRelayStateV2';
const HEALTH_ALARM = 'relay-health';

let ws = null;
let reconnectTimer = null;
let reconnectDelayMs = 800;

// Keep SW alive via long-lived ports from attached tabs
const keepalivePorts = new Map(); // tabId -> port

let state = {
  attachedTabIds: [],
  activeTabId: null,
  connected: false,
  lastError: null,
  lastSeenAt: null
};

async function loadState() {
  const data = await chrome.storage.local.get(STATE_KEY);
  if (data[STATE_KEY]) state = { ...state, ...data[STATE_KEY] };
}

async function saveState() {
  await chrome.storage.local.set({ [STATE_KEY]: state });
  await updateBadge();
}

async function updateBadge() {
  const count = state.attachedTabIds.length;
  await chrome.action.setBadgeText({ text: count ? String(count) : '' });
  await chrome.action.setBadgeBackgroundColor({ color: state.connected ? '#16a34a' : '#b45309' });
}

function send(msg) {
  if (ws && ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(msg));
}

function hello() {
  send({
    type: 'hello',
    source: 'openclaw-multi-tab-relay-v2',
    attachedTabIds: state.attachedTabIds,
    activeTabId: state.activeTabId,
    ts: Date.now()
  });
}

function clearReconnectTimer() {
  if (reconnectTimer) {
    clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }
}

function scheduleReconnect() {
  if (reconnectTimer) return;
  reconnectTimer = setTimeout(() => {
    reconnectTimer = null;
    connectBridge();
  }, reconnectDelayMs);
  reconnectDelayMs = Math.min(reconnectDelayMs * 2, 12000);
}

function connectBridge() {
  if (ws && (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING)) return;

  try {
    ws = new WebSocket(BRIDGE_URL);

    ws.onopen = async () => {
      reconnectDelayMs = 800;
      state.connected = true;
      state.lastError = null;
      state.lastSeenAt = Date.now();
      await saveState();
      hello();
    };

    ws.onmessage = async (ev) => {
      let msg;
      try { msg = JSON.parse(ev.data); } catch { return; }
      state.lastSeenAt = Date.now();
      await handleBridgeCommand(msg);
    };

    ws.onclose = async () => {
      state.connected = false;
      await saveState();
      scheduleReconnect();
    };

    ws.onerror = async () => {
      state.connected = false;
      state.lastError = 'bridge connection error';
      await saveState();
    };
  } catch (e) {
    state.connected = false;
    state.lastError = String(e);
    saveState();
    scheduleReconnect();
  }
}

async function ensureTabIsValid(tabId) {
  try {
    await chrome.tabs.get(tabId);
    return true;
  } catch {
    await detachTab(tabId);
    return false;
  }
}

async function waitForTabComplete(tabId, timeoutMs = 10000) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    const tab = await chrome.tabs.get(tabId);
    if (tab.status === 'complete') return true;
    await new Promise((r) => setTimeout(r, 250));
  }
  return false;
}

async function xPostViaDebugger(tabId, text) {
  const target = { tabId };
  const version = '1.3';

  const sendCommand = (method, params = {}) =>
    new Promise((resolve, reject) => {
      chrome.debugger.sendCommand(target, method, params, () => {
        const err = chrome.runtime.lastError;
        if (err) reject(new Error(err.message));
        else resolve();
      });
    });

  await new Promise((resolve, reject) => {
    chrome.debugger.attach(target, version, () => {
      const err = chrome.runtime.lastError;
      if (err) reject(new Error(err.message));
      else resolve();
    });
  });

  try {
    await sendCommand('Runtime.enable');
    await sendCommand('Page.bringToFront');

    await sendCommand('Runtime.evaluate', {
      expression: `(() => {
        const openComposer = () => {
          const btn = document.querySelector('[data-testid="SideNav_NewTweet_Button"]') ||
                      document.querySelector('a[href="/compose/post"]');
          if (btn) btn.click();
        };
        openComposer();
        return true;
      })();`,
      awaitPromise: true
    });

    await new Promise((r) => setTimeout(r, 700));

    await sendCommand('Runtime.evaluate', {
      expression: `(() => {
        const box = document.querySelector('div[role="dialog"] div[role="textbox"][contenteditable="true"]') ||
                    document.querySelector('[data-testid="tweetTextarea_0"]') ||
                    document.querySelector('div[role="textbox"][contenteditable="true"]');
        if (!box) return false;
        box.focus();
        const sel = window.getSelection();
        const range = document.createRange();
        range.selectNodeContents(box);
        range.collapse(false);
        sel.removeAllRanges();
        sel.addRange(range);
        return true;
      })();`,
      awaitPromise: true
    });

    await sendCommand('Input.insertText', { text });
    await new Promise((r) => setTimeout(r, 400));

    await sendCommand('Runtime.evaluate', {
      expression: `(() => {
        const btn = document.querySelector('div[role="dialog"] [data-testid="tweetButton"]') ||
                    document.querySelector('[data-testid="tweetButton"]') ||
                    document.querySelector('[data-testid="tweetButtonInline"]');
        if (!btn) return { ok:false, reason:'button-not-found' };
        const disabled = btn.disabled || btn.getAttribute('aria-disabled') === 'true';
        if (disabled) return { ok:false, reason:'button-disabled' };
        btn.click();
        return { ok:true };
      })();`,
      awaitPromise: true
    });

    return { posted: true, detail: 'clicked-post' };
  } finally {
    await new Promise((resolve) => {
      chrome.debugger.detach(target, () => resolve());
    });
  }
}

async function handleBridgeCommand(msg) {
  if (!msg || !msg.type) return;

  if (msg.type === 'listTabs') {
    const tabs = [];
    for (const id of state.attachedTabIds) {
      try {
        const t = await chrome.tabs.get(id);
        tabs.push({ id: t.id, url: t.url, title: t.title, active: id === state.activeTabId });
      } catch {}
    }
    return send({ type: 'listTabsResult', requestId: msg.requestId, tabs });
  }

  if (msg.type === 'setActiveTab') {
    const tabId = Number(msg.tabId);
    if (!state.attachedTabIds.includes(tabId)) {
      return send({ type: 'error', requestId: msg.requestId, error: 'tab not attached' });
    }
    state.activeTabId = tabId;
    await saveState();
    return send({ type: 'ok', requestId: msg.requestId });
  }

  if (msg.type === 'navigate') {
    const tabId = Number(msg.tabId ?? state.activeTabId);
    if (!tabId) return send({ type: 'error', requestId: msg.requestId, error: 'no active tab' });
    if (!(await ensureTabIsValid(tabId))) return send({ type: 'error', requestId: msg.requestId, error: 'tab missing' });
    await chrome.tabs.update(tabId, { url: String(msg.url) });
    return send({ type: 'ok', requestId: msg.requestId });
  }

  if (msg.type === 'xPost') {
    const tabId = Number(msg.tabId ?? state.activeTabId);
    if (!tabId) return send({ type: 'error', requestId: msg.requestId, error: 'no active tab' });
    if (!(await ensureTabIsValid(tabId))) return send({ type: 'error', requestId: msg.requestId, error: 'tab missing' });

    try {
      const tab = await chrome.tabs.get(tabId);
      const url = String(tab.url || '');
      if (!url.includes('x.com')) {
        await chrome.tabs.update(tabId, { url: 'https://x.com/home' });
        await waitForTabComplete(tabId, 12000);
      }

      const result = await xPostViaDebugger(tabId, String(msg.text || ''));
      return send({ type: 'xPostResult', requestId: msg.requestId, posted: !!result.posted, detail: result.detail || null });
    } catch (e) {
      return send({ type: 'error', requestId: msg.requestId, error: String(e) });
    }
  }

  if (msg.type === 'eval') {
    const tabId = Number(msg.tabId ?? state.activeTabId);
    if (!tabId) return send({ type: 'error', requestId: msg.requestId, error: 'no active tab' });
    if (!(await ensureTabIsValid(tabId))) return send({ type: 'error', requestId: msg.requestId, error: 'tab missing' });

    try {
      const [{ result }] = await chrome.scripting.executeScript({
        target: { tabId },
        func: (source) => {
          const code = String(source ?? '');
          try {
            return (new Function(`return (${code});`))();
          } catch {}
          return (new Function(code))();
        },
        args: [String(msg.script ?? '')]
      });
      return send({ type: 'evalResult', requestId: msg.requestId, result });
    } catch (e) {
      return send({ type: 'error', requestId: msg.requestId, error: String(e) });
    }
  }
}

async function injectKeepalive(tabId) {
  try {
    await chrome.scripting.executeScript({
      target: { tabId },
      func: () => {
        if (window.__openclawKeepaliveInjected) return;
        window.__openclawKeepaliveInjected = true;

        let port = null;
        const connect = () => {
          try {
            port = chrome.runtime.connect({ name: 'openclaw-keepalive' });
            port.postMessage({ type: 'hello', ts: Date.now() });
            const interval = setInterval(() => {
              try { port?.postMessage({ type: 'ping', ts: Date.now() }); } catch {}
            }, 10000);
            port.onDisconnect.addListener(() => {
              clearInterval(interval);
              setTimeout(connect, 1500);
            });
          } catch {
            setTimeout(connect, 1500);
          }
        };

        connect();
      }
    });
  } catch {
    // ignore (tab may not allow injection like chrome://)
  }
}

async function attachTab(tabId) {
  if (!state.attachedTabIds.includes(tabId)) state.attachedTabIds.push(tabId);
  if (!state.activeTabId) state.activeTabId = tabId;
  await saveState();
  await injectKeepalive(tabId);
  hello();
  send({ type: 'tabAttached', tabId });
}

async function detachTab(tabId) {
  state.attachedTabIds = state.attachedTabIds.filter((id) => id !== tabId);
  if (state.activeTabId === tabId) state.activeTabId = state.attachedTabIds[0] ?? null;
  keepalivePorts.delete(tabId);
  await saveState();
  hello();
  send({ type: 'tabDetached', tabId });
}

async function bootstrap() {
  await loadState();
  await updateBadge();
  await chrome.alarms.create(HEALTH_ALARM, { periodInMinutes: 0.5 });
  connectBridge();

  // Re-inject keepalive into previously attached tabs
  for (const tabId of state.attachedTabIds) {
    await injectKeepalive(tabId);
  }
}

chrome.runtime.onInstalled.addListener(async () => {
  await bootstrap();
});

chrome.runtime.onStartup.addListener(async () => {
  await bootstrap();
});

chrome.runtime.onConnect.addListener((port) => {
  if (port.name !== 'openclaw-keepalive') return;

  let tabId = null;
  try { tabId = port.sender?.tab?.id ?? null; } catch {}
  if (tabId != null) keepalivePorts.set(tabId, port);

  port.onMessage.addListener(async () => {
    if (!state.connected) connectBridge();
  });

  port.onDisconnect.addListener(() => {
    if (tabId != null) keepalivePorts.delete(tabId);
  });
});

chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name !== HEALTH_ALARM) return;
  if (!state.connected) connectBridge();
  else hello();

  for (const tabId of state.attachedTabIds) {
    if (!keepalivePorts.has(tabId)) {
      await injectKeepalive(tabId);
    }
  }
});

chrome.tabs.onRemoved.addListener(async (tabId) => {
  if (state.attachedTabIds.includes(tabId)) await detachTab(tabId);
});

chrome.tabs.onUpdated.addListener(async (tabId, changeInfo) => {
  if (!state.attachedTabIds.includes(tabId)) return;
  if (changeInfo.status === 'complete') {
    await injectKeepalive(tabId);
    if (!state.connected) connectBridge();
  }
});

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  (async () => {
    if (msg.type === 'getState') {
      await loadState();
      sendResponse({ ok: true, state });
      return;
    }

    if (msg.type === 'attachCurrentTab') {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!tab?.id) return sendResponse({ ok: false, error: 'no active tab' });
      await attachTab(tab.id);
      return sendResponse({ ok: true, state });
    }

    if (msg.type === 'detachCurrentTab') {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!tab?.id) return sendResponse({ ok: false, error: 'no active tab' });
      await detachTab(tab.id);
      return sendResponse({ ok: true, state });
    }

    if (msg.type === 'setActiveCurrentTab') {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!tab?.id) return sendResponse({ ok: false, error: 'no active tab' });
      if (!state.attachedTabIds.includes(tab.id)) await attachTab(tab.id);
      state.activeTabId = tab.id;
      await saveState();
      hello();
      send({ type: 'activeTabChanged', tabId: tab.id });
      return sendResponse({ ok: true, state });
    }

    if (msg.type === 'reconnectBridge') {
      clearReconnectTimer();
      connectBridge();
      return sendResponse({ ok: true });
    }

    sendResponse({ ok: false, error: 'unknown message' });
  })();

  return true;
});

bootstrap();