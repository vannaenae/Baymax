#!/usr/bin/env node
/**
 * Independent bridge for OpenClaw Multi-Tab Relay extension.
 *
 * - Extension connects via WS: ws://127.0.0.1:18793/relay
 * - Local control API via HTTP:
 *   GET  /health
 *   GET  /api/state
 *   POST /api/listTabs
 *   POST /api/setActiveTab   { tabId }
 *   POST /api/navigate       { tabId?, url }
 *   POST /api/eval           { tabId?, script }
 *   POST /api/xPost          { tabId?, text }
 */

const http = require('http');
const { WebSocketServer } = require('ws');

const PORT = 18793;
const PATH = '/relay';

let extensionSocket = null;
let extensionState = {
  attachedTabIds: [],
  activeTabId: null,
  connected: false,
  lastHelloAt: null
};

const pending = new Map();

function json(res, status, body) {
  res.writeHead(status, { 'content-type': 'application/json' });
  res.end(JSON.stringify(body));
}

function readJson(req) {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', (c) => { data += c; });
    req.on('end', () => {
      if (!data) return resolve({});
      try { resolve(JSON.parse(data)); } catch (e) { reject(e); }
    });
    req.on('error', reject);
  });
}

function makeRequestId() {
  return `req_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

function sendToExtension(msg) {
  if (!extensionSocket || extensionSocket.readyState !== 1) {
    throw new Error('extension not connected');
  }
  extensionSocket.send(JSON.stringify(msg));
}

function requestExtension(type, payload = {}, timeoutMs = 5000) {
  const requestId = makeRequestId();
  const message = { type, requestId, ...payload };

  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      pending.delete(requestId);
      reject(new Error(`${type} timeout`));
    }, timeoutMs);

    pending.set(requestId, { resolve, reject, timer });

    try {
      sendToExtension(message);
    } catch (e) {
      clearTimeout(timer);
      pending.delete(requestId);
      reject(e);
    }
  });
}

function settlePending(requestId, ok, payload) {
  const p = pending.get(requestId);
  if (!p) return;
  clearTimeout(p.timer);
  pending.delete(requestId);
  if (ok) p.resolve(payload);
  else p.reject(new Error(payload?.error || 'request failed'));
}

const server = http.createServer(async (req, res) => {
  try {
    if (req.method === 'GET' && req.url === '/health') {
      return json(res, 200, { ok: true, extensionConnected: extensionState.connected });
    }

    if (req.method === 'GET' && req.url === '/api/state') {
      return json(res, 200, { ok: true, state: extensionState });
    }

    if (req.method === 'POST' && req.url === '/api/listTabs') {
      const out = await requestExtension('listTabs');
      return json(res, 200, { ok: true, ...out });
    }

    if (req.method === 'POST' && req.url === '/api/setActiveTab') {
      const body = await readJson(req);
      const tabId = Number(body.tabId);
      if (!Number.isFinite(tabId)) return json(res, 400, { ok: false, error: 'tabId required' });
      await requestExtension('setActiveTab', { tabId });
      extensionState.activeTabId = tabId;
      return json(res, 200, { ok: true, tabId });
    }

    if (req.method === 'POST' && req.url === '/api/navigate') {
      const body = await readJson(req);
      const url = String(body.url || '');
      if (!url) return json(res, 400, { ok: false, error: 'url required' });
      const tabId = body.tabId != null ? Number(body.tabId) : undefined;
      await requestExtension('navigate', { tabId, url });
      return json(res, 200, { ok: true, tabId: tabId ?? extensionState.activeTabId, url });
    }

    if (req.method === 'POST' && req.url === '/api/eval') {
      const body = await readJson(req);
      const script = String(body.script || '');
      if (!script) return json(res, 400, { ok: false, error: 'script required' });
      const tabId = body.tabId != null ? Number(body.tabId) : undefined;
      const out = await requestExtension('eval', { tabId, script }, 10000);
      return json(res, 200, { ok: true, ...out });
    }

    if (req.method === 'POST' && req.url === '/api/xPost') {
      const body = await readJson(req);
      const text = String(body.text || '');
      if (!text) return json(res, 400, { ok: false, error: 'text required' });
      const tabId = body.tabId != null ? Number(body.tabId) : undefined;
      const out = await requestExtension('xPost', { tabId, text }, 20000);
      return json(res, 200, { ok: true, ...out });
    }

    return json(res, 404, { ok: false, error: 'not found' });
  } catch (e) {
    return json(res, 500, { ok: false, error: String(e.message || e) });
  }
});

const wss = new WebSocketServer({ server, path: PATH });

wss.on('connection', (ws) => {
  extensionSocket = ws;
  extensionState.connected = true;
  extensionState.lastHelloAt = Date.now();
  console.log('[bridge] extension connected');

  ws.on('message', (buf) => {
    let msg;
    try { msg = JSON.parse(String(buf)); } catch { return; }

    if (msg.type === 'hello') {
      extensionState.attachedTabIds = Array.isArray(msg.attachedTabIds) ? msg.attachedTabIds : [];
      extensionState.activeTabId = msg.activeTabId ?? null;
      extensionState.lastHelloAt = Date.now();
      return;
    }

    if (msg.type === 'tabAttached') {
      if (!extensionState.attachedTabIds.includes(msg.tabId)) extensionState.attachedTabIds.push(msg.tabId);
      return;
    }

    if (msg.type === 'tabDetached') {
      extensionState.attachedTabIds = extensionState.attachedTabIds.filter((id) => id !== msg.tabId);
      if (extensionState.activeTabId === msg.tabId) extensionState.activeTabId = extensionState.attachedTabIds[0] ?? null;
      return;
    }

    if (msg.type === 'activeTabChanged') {
      extensionState.activeTabId = msg.tabId ?? null;
      return;
    }

    if (msg.requestId) {
      if (msg.type === 'error') return settlePending(msg.requestId, false, { error: msg.error || 'unknown error' });
      if (msg.type === 'listTabsResult') return settlePending(msg.requestId, true, { tabs: msg.tabs || [] });
      if (msg.type === 'evalResult') return settlePending(msg.requestId, true, { result: msg.result });
      if (msg.type === 'xPostResult') return settlePending(msg.requestId, true, { posted: !!msg.posted, detail: msg.detail || null });
      if (msg.type === 'ok') return settlePending(msg.requestId, true, { ok: true });
    }
  });

  ws.on('close', () => {
    if (extensionSocket === ws) extensionSocket = null;
    extensionState.connected = false;
    console.log('[bridge] extension disconnected');

    for (const [id, p] of pending.entries()) {
      clearTimeout(p.timer);
      p.reject(new Error('extension disconnected'));
      pending.delete(id);
    }
  });
});

server.listen(PORT, '127.0.0.1', () => {
  console.log(`[bridge] listening on ws://127.0.0.1:${PORT}${PATH}`);
  console.log('[bridge] health: http://127.0.0.1:18793/health');
});