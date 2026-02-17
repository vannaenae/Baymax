async function rpc(type) {
  return chrome.runtime.sendMessage({ type });
}

function render(state) {
  const status = document.getElementById('status');
  const tabs = document.getElementById('tabs');
  status.textContent = `Bridge: ${state.connected ? 'connected' : 'disconnected'} · Attached tabs: ${state.attachedTabIds.length} · Active: ${state.activeTabId ?? '-'}`;
  if (state.lastError) status.textContent += ` · ${state.lastError}`;
  tabs.textContent = `Attached IDs: ${state.attachedTabIds.join(', ') || 'none'}`;
}

async function refresh() {
  const res = await rpc('getState');
  if (res?.ok) render(res.state);
}

document.getElementById('attach').addEventListener('click', async () => {
  await rpc('attachCurrentTab');
  await refresh();
});

document.getElementById('detach').addEventListener('click', async () => {
  await rpc('detachCurrentTab');
  await refresh();
});

document.getElementById('setActive').addEventListener('click', async () => {
  await rpc('setActiveCurrentTab');
  await refresh();
});

document.getElementById('reconnect').addEventListener('click', async () => {
  await rpc('reconnectBridge');
  await refresh();
});

refresh();