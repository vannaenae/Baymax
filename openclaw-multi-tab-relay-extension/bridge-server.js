#!/usr/bin/env node
/**
 * Local bridge for OpenClaw Multi-Tab Relay extension.
 *
 * This does NOT patch OpenClaw internals by itself.
 * It provides a multi-tab websocket channel at ws://127.0.0.1:18793/relay.
 */

const http = require('http');
const { WebSocketServer } = require('ws');

const PORT = 18793;
const PATH = '/relay';

const server = http.createServer((req, res) => {
  if (req.url === '/health') {
    res.writeHead(200, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ ok: true }));
    return;
  }
  res.writeHead(404);
  res.end('not found');
});

const wss = new WebSocketServer({ server, path: PATH });

let extensionSocket = null;

wss.on('connection', (ws) => {
  extensionSocket = ws;
  console.log('[bridge] extension connected');

  ws.on('message', (buf) => {
    let msg;
    try { msg = JSON.parse(String(buf)); } catch { return; }
    console.log('[bridge <- ext]', msg.type, msg.requestId || '');
  });

  ws.on('close', () => {
    if (extensionSocket === ws) extensionSocket = null;
    console.log('[bridge] extension disconnected');
  });
});

server.listen(PORT, '127.0.0.1', () => {
  console.log(`[bridge] listening on ws://127.0.0.1:${PORT}${PATH}`);
  console.log('[bridge] health: http://127.0.0.1:18793/health');
});