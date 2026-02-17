const BRIDGE_URL = 'ws://127.0.0.1:18793/relay';
const STATE_KEY = 'multiTabRelayStateV1';
const KEEPALIVE_ALARM = 'relay-keepalive';

let ws = null;
let reconnectTimer = null;
let reconnectDelayMs = 1000;

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
    source: 'openclaw-multi-tab-relay',
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
  reconnectDelayMs = Math.min(reconnectDelayMs * 2, 15000);
}

function connectBridge() {
  if (ws && (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING)) return;

  try {
    ws = new WebSocket(BRIDGE_URL);

    ws.onopen = async () => {
      reconnectDelayMs = 1000;
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
    state.attachedTabIds = state.attachedTabIds.filter((id) => id !== tabId);
    if (state.activeTabId === tabId) state.activeTabId = state.attachedTabIds[0] ?? null;
    await saveState();
    return false;
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
    if (!state.attachedTabIds.includes(tabId)) return send({ type: 'error', requestId: msg.requestId, error: 'tab not attached' });
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

  if (msg.type === 'eval') {
    const tabId = Number(msg.tabId ?? state.activeTabId);
    if (!tabId) return send({ type: 'error', requestId: msg.requestId, error: 'no active tab' });
    if (!(await ensureTabIsValid(tabId))) return send({ type: 'error', requestId: msg.requestId, error: 'tab missing' });

    try {
      const [{ result }] = await chrome.scripting.executeScript({
        target: { tabId },
        func: (source) => {
          // eslint-disable-next-line no-eval
          return eval(source);
        },
        args: [String(msg.script ?? '')]
      });
      return send({ type: 'evalResult', requestId: msg.requestId, result });
    } catch (e) {
      return send({ type: 'error', requestId: msg.requestId, error: String(e) });
    }
  }
}

async function attachTab(tabId) {
  if (!state.attachedTabIds.includes(tabId)) state.attachedTabIds.push(tabId);
  if (!state.activeTabId) state.activeTabId = tabId;
  await saveState();
  hello();
  send({ type: 'tabAttached', tabId });
}

async function detachTab(tabId) {
  state.attachedTabIds = state.attachedTabIds.filter((id) => id !== tabId);
  if (state.activeTabId === tabId) state.activeTabId = state.attachedTabIds[0] ?? null;
  await saveState();
  hello();
  send({ type: 'tabDetached', tabId });
}

async function setupKeepalive() {
  await chrome.alarms.create(KEEPALIVE_ALARM, { periodInMinutes: 0.5 });
}

chrome.runtime.onInstalled.addListener(async () => {
  await loadState();
  await updateBadge();
  await setupKeepalive();
  connectBridge();
});

chrome.runtime.onStartup.addListener(async () => {
  await loadState();
  await updateBadge();
  await setupKeepalive();
  connectBridge();
});

chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name !== KEEPALIVE_ALARM) return;
  if (!state.connected) connectBridge();
  else hello();
});

chrome.tabs.onRemoved.addListener(async (tabId) => {
  if (state.attachedTabIds.includes(tabId)) {
    await detachTab(tabId);
  }
});

chrome.tabs.onActivated.addListener(async () => {
  if (!state.connected) connectBridge();
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

(async () => {
  await loadState();
  await updateBadge();
  await setupKeepalive();
  connectBridge();
})();