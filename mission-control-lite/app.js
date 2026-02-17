(() => {
  // --- Mocked State ---
  const state = {
    activePage: 'Mission Control',
    agent: {
      name: 'Baymax',
      mode: 'WATCH', // WATCH | ASSIST | AUTO
      status: 'Online',
      task: 'Monitoring X + Reddit outreach',
      lastAction: 'READ timeline tweet context',
      errorCount: 0,
      paused: false,
      currentUrl: 'https://x.com/home',
      screenshotLabel: 'Viewport Mirror Placeholder'
    },
    intents: [
      { id: crypto.randomUUID(), ts: now(), verb: 'READ', target: 'x.com/home timeline', why: 'Find relevant thread for value-add reply', state: 'active' },
      { id: crypto.randomUUID(), ts: now(), verb: 'CLICK', target: 'Compose button', why: 'Open post composer', state: 'normal' },
      { id: crypto.randomUUID(), ts: now(), verb: 'TYPE', target: 'Post textarea', why: 'Draft concise execution-focused post', state: 'normal' }
    ],
    memoryTasks: [
      {
        id: 'M-102',
        status: 'RUNNING',
        tag: 'Navigation',
        summary: { goal: 'Post on X every 15m', result: 'In progress', duration: '17m' },
        raw: {
          events: ['navigate x.com/home', 'open composer', 'inject copy', 'post click'],
          blockers: [],
          retries: 1
        }
      },
      {
        id: 'M-099',
        status: 'FAILED',
        tag: 'Failures',
        summary: { goal: 'Reply on Reddit thread', result: 'Captcha wall', duration: '2m' },
        raw: {
          error: 'human verification required',
          action: 'paused for manual solve'
        }
      },
      {
        id: 'M-091',
        status: 'DONE',
        tag: 'Navigation',
        summary: { goal: 'Attach X tab relay', result: 'Connected', duration: '1m' },
        raw: {
          attachedTabs: [451918401, 451918403],
          activeTab: 451918401
        }
      },
      {
        id: 'M-088',
        status: 'DONE',
        tag: 'Purchases',
        summary: { goal: 'Payments safeguard', result: 'Disabled by policy', duration: '30s' },
        raw: {
          payments: false,
          spendCap: 0
        }
      }
    ],
    memoryFilter: 'All',
    selectedMemoryId: 'M-102',
    cortex: {
      webBrowse: true,
      clickType: true,
      fileAccess: true,
      payments: false,
      maxRetries: 3,
      cautionLevel: 7,
      maxSpend: 0
    },
    terminal: {
      log: [
        '[system] Mission Control initialised (local mode).',
        '[hint] Type "help" for available commands.'
      ]
    },
    focusDot: { x: 30, y: 30 },
    editModalOpen: false
  };

  const tabs = ['Mission Control', 'Strategic Memory', 'Cortex Config', 'Direct Command'];
  const verbs = ['READ', 'CLICK', 'TYPE'];
  const targets = ['timeline card', 'compose modal', 'post button', 'search input', 'profile tab', 'thread permalink'];
  const whys = [
    'Validate context before action',
    'Advance posting workflow',
    'Collect signal for next decision',
    'Reduce error chance on next step'
  ];

  // --- DOM refs ---
  const topTabs = document.getElementById('topTabs');
  const pageRoot = document.getElementById('pageRoot');
  const terminalOverlay = document.getElementById('terminalOverlay');
  const overlayLog = document.getElementById('overlayLog');
  const overlayForm = document.getElementById('overlayForm');
  const overlayInput = document.getElementById('overlayInput');
  const closeOverlay = document.getElementById('closeOverlay');

  const editModal = document.getElementById('editModal');
  const closeEditModal = document.getElementById('closeEditModal');
  const saveEdit = document.getElementById('saveEdit');
  const editVerb = document.getElementById('editVerb');
  const editTarget = document.getElementById('editTarget');
  const editWhy = document.getElementById('editWhy');

  let editIntentId = null;

  function now() {
    return new Date().toLocaleTimeString('en-GB', { hour12: false });
  }

  function cls(...c) { return c.filter(Boolean).join(' '); }

  // --- Render ---
  function renderTabs() {
    topTabs.innerHTML = tabs.map(tab => `
      <button data-tab="${tab}" class="px-3 py-1.5 text-sm rounded-lg border ${
        state.activePage === tab
          ? 'bg-neon text-black border-neon shadow-neon font-semibold'
          : 'bg-zinc-900/80 border-white/10 text-zinc-300 hover:border-violet-400/40'
      }">${tab}</button>
    `).join('');

    topTabs.querySelectorAll('button').forEach(btn => {
      btn.onclick = () => {
        state.activePage = btn.dataset.tab;
        render();
      };
    });
  }

  function badgeByIntentState(s) {
    if (s === 'active') return 'border-neon text-neon shadow-neon';
    if (s === 'warning') return 'border-amber-400 text-amber-300';
    if (s === 'error') return 'border-pink-400 text-pink-300';
    return 'border-violet-400/30 text-zinc-300';
  }

  function renderMissionControl() {
    const modeBadge = state.agent.mode === 'WATCH'
      ? 'bg-violet-500/20 text-violet-200'
      : state.agent.mode === 'ASSIST'
      ? 'bg-neon text-black'
      : 'bg-emerald-500/20 text-emerald-200';

    const newest = state.intents[0];

    pageRoot.innerHTML = `
      <section class="grid grid-cols-1 xl:grid-cols-10 gap-4 min-h-[75vh]">
        <!-- Left 20% -->
        <aside class="glass rounded-2xl p-4 xl:col-span-2 space-y-4">
          <div>
            <h2 class="text-sm uppercase tracking-wider text-zinc-400">Agent Status</h2>
            <p class="text-xl font-semibold mt-1">${state.agent.name}</p>
          </div>

          <label class="block text-sm text-zinc-300">Mode
            <select id="modeSelector" class="mt-1 w-full bg-zinc-900 border border-white/10 rounded px-2 py-1.5">
              <option ${state.agent.mode==='WATCH'?'selected':''}>WATCH</option>
              <option ${state.agent.mode==='ASSIST'?'selected':''}>ASSIST</option>
              <option ${state.agent.mode==='AUTO'?'selected':''}>AUTO</option>
            </select>
          </label>

          <div class="inline-flex px-2 py-1 rounded-full text-xs font-semibold ${modeBadge}">${state.agent.mode}</div>

          <div class="grid gap-2 text-sm">
            ${metricCard('Status', state.agent.paused ? 'Paused' : state.agent.status)}
            ${metricCard('Task', state.agent.task)}
            ${metricCard('Last Action', state.agent.lastAction)}
            ${metricCard('Error Count', String(state.agent.errorCount))}
          </div>

          <div class="grid grid-cols-2 gap-2">
            <button id="togglePause" class="px-3 py-2 rounded-lg border border-white/10 bg-zinc-900 hover:bg-zinc-800 text-sm">
              ${state.agent.paused ? 'Resume' : 'Pause'}
            </button>
            <button id="simulateWarning" class="px-3 py-2 rounded-lg border border-amber-400/30 bg-amber-500/10 text-amber-300 text-sm hover:bg-amber-500/20">
              Simulate Warning
            </button>
          </div>
        </aside>

        <!-- Center 50% -->
        <section class="glass rounded-2xl p-4 xl:col-span-5 space-y-3">
          <div class="flex items-center justify-between">
            <h2 class="text-sm uppercase tracking-wider text-zinc-400">Viewport Mirror</h2>
            <span class="text-xs text-zinc-400">${state.agent.currentUrl}</span>
          </div>

          <div class="relative h-[520px] rounded-xl border border-violet-400/20 bg-gradient-to-b from-zinc-900 to-[#0b0718] overflow-hidden">
            <div class="absolute inset-0 opacity-20" style="background-image: linear-gradient(to right, rgba(138,100,255,.18) 1px, transparent 1px), linear-gradient(to bottom, rgba(138,100,255,.18) 1px, transparent 1px); background-size: 28px 28px;"></div>
            <div class="absolute top-3 left-3 text-xs text-zinc-400">${state.agent.screenshotLabel}</div>
            <div id="focusDot" class="absolute w-3 h-3 rounded-full bg-neon shadow-neon transition-all duration-700" style="left:${state.focusDot.x}%; top:${state.focusDot.y}%;"></div>
          </div>
        </section>

        <!-- Right 30% -->
        <aside class="glass rounded-2xl p-4 xl:col-span-3 flex flex-col min-h-[620px]">
          <div class="flex items-center justify-between mb-3">
            <h2 class="text-sm uppercase tracking-wider text-zinc-400">Intent Feed</h2>
            <span class="text-xs text-zinc-500">Live</span>
          </div>

          <div class="flex-1 overflow-auto scrollbar-thin space-y-2 pr-1">
            ${state.intents.map((it, idx) => `
              <div class="rounded-xl border p-3 bg-zinc-900/70 ${badgeByIntentState(it.state)}">
                <div class="flex items-center justify-between text-xs mb-1">
                  <span>${it.ts}</span>
                  <span class="font-semibold">${it.verb}</span>
                </div>
                <p class="text-sm font-medium">${escapeHtml(it.target)}</p>
                <p class="text-xs text-zinc-400 mt-1">${escapeHtml(it.why)}</p>
                ${idx===0 && state.agent.mode==='ASSIST' ? `<button data-edit-id="${it.id}" class="mt-2 text-xs px-2 py-1 rounded bg-neon text-black font-semibold">Edit next step</button>` : ''}
              </div>
            `).join('')}
          </div>
        </aside>
      </section>
    `;

    document.getElementById('modeSelector').onchange = (e) => {
      state.agent.mode = e.target.value;
      render();
    };

    document.getElementById('togglePause').onclick = () => {
      state.agent.paused = !state.agent.paused;
      state.agent.status = state.agent.paused ? 'Paused' : 'Online';
      state.agent.lastAction = state.agent.paused ? 'Execution paused by operator' : 'Execution resumed';
      render();
    };

    document.getElementById('simulateWarning').onclick = () => {
      pushIntent({ verb: 'READ', target: 'checkout / pricing edge case', why: 'Potential risky action detected', state: 'warning' });
      state.agent.errorCount += 1;
      state.agent.lastAction = 'Injected warning event';
      render();
    };

    pageRoot.querySelectorAll('[data-edit-id]').forEach(btn => {
      btn.onclick = () => openEditModal(btn.dataset.editId);
    });
  }

  function metricCard(label, value) {
    return `<div class="rounded-lg border border-white/10 bg-zinc-900/70 p-2.5"><p class="text-[11px] uppercase tracking-wide text-zinc-500">${label}</p><p class="text-sm mt-1">${escapeHtml(value)}</p></div>`;
  }

  function renderStrategicMemory() {
    const tabs = ['All', 'Failures', 'Purchases', 'Navigation'];
    const filtered = state.memoryFilter === 'All'
      ? state.memoryTasks
      : state.memoryTasks.filter(t => t.tag === state.memoryFilter || t.status === state.memoryFilter.toUpperCase());

    const selected = state.memoryTasks.find(t => t.id === state.selectedMemoryId) || filtered[0];

    pageRoot.innerHTML = `
      <section class="glass rounded-2xl p-4 space-y-4">
        <div class="flex items-center justify-between flex-wrap gap-2">
          <h2 class="text-sm uppercase tracking-wider text-zinc-400">Strategic Memory</h2>
          <div class="flex gap-2 flex-wrap">
            ${tabs.map(f => `<button data-filter="${f}" class="px-3 py-1.5 rounded-lg border text-xs ${state.memoryFilter===f?'bg-neon text-black border-neon':'bg-zinc-900 border-white/10 text-zinc-300'}">${f}</button>`).join('')}
          </div>
        </div>

        <div class="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <aside class="lg:col-span-1 glass rounded-xl p-3 max-h-[68vh] overflow-auto scrollbar-thin space-y-2">
            ${filtered.map(t => `
              <button data-task-id="${t.id}" class="w-full text-left rounded-lg p-2 border ${state.selectedMemoryId===t.id?'border-neon bg-neon/10':'border-white/10 bg-zinc-900/70'}">
                <div class="flex items-center justify-between text-xs">
                  <span class="font-semibold">${t.id}</span>
                  <span class="px-2 py-0.5 rounded ${statusBadge(t.status)}">${t.status}</span>
                </div>
                <p class="text-xs text-zinc-400 mt-1">${t.summary.goal}</p>
              </button>
            `).join('') || '<p class="text-sm text-zinc-500">No items in this filter.</p>'}
          </aside>

          <section class="lg:col-span-2 glass rounded-xl p-4 space-y-3">
            ${selected ? `
              <div>
                <h3 class="font-semibold text-lg">${selected.id} Summary</h3>
                <div class="grid grid-cols-1 md:grid-cols-3 gap-2 mt-2 text-sm">
                  <div class="rounded border border-white/10 bg-zinc-900/70 p-2"><p class="text-zinc-500 text-xs">Goal</p><p>${escapeHtml(selected.summary.goal)}</p></div>
                  <div class="rounded border border-white/10 bg-zinc-900/70 p-2"><p class="text-zinc-500 text-xs">Result</p><p>${escapeHtml(selected.summary.result)}</p></div>
                  <div class="rounded border border-white/10 bg-zinc-900/70 p-2"><p class="text-zinc-500 text-xs">Duration</p><p>${escapeHtml(selected.summary.duration)}</p></div>
                </div>
              </div>

              <details class="rounded border border-white/10 bg-zinc-900/70 p-3">
                <summary class="cursor-pointer text-sm text-neon">Raw log JSON</summary>
                <pre class="mt-2 text-xs overflow-auto scrollbar-thin">${escapeHtml(JSON.stringify(selected.raw, null, 2))}</pre>
              </details>
            ` : '<p class="text-sm text-zinc-500">Select a task to inspect details.</p>'}
          </section>
        </div>
      </section>
    `;

    pageRoot.querySelectorAll('[data-filter]').forEach(btn => btn.onclick = () => {
      state.memoryFilter = btn.dataset.filter;
      render();
    });

    pageRoot.querySelectorAll('[data-task-id]').forEach(btn => btn.onclick = () => {
      state.selectedMemoryId = btn.dataset.taskId;
      render();
    });
  }

  function statusBadge(status) {
    if (status === 'DONE') return 'bg-emerald-500/20 text-emerald-200';
    if (status === 'FAILED') return 'bg-pink-500/20 text-pink-200';
    if (status === 'RUNNING') return 'bg-neon text-black';
    return 'bg-violet-500/20 text-violet-200';
  }

  function renderCortexConfig() {
    pageRoot.innerHTML = `
      <section class="glass rounded-2xl p-4 space-y-4">
        <h2 class="text-sm uppercase tracking-wider text-zinc-400">Cortex Config</h2>

        <div>
          <p class="text-xs text-zinc-500 mb-2">Tool Authorisation</p>
          <div class="flex flex-wrap gap-2">
            ${chip('webBrowse', 'Web Browse')}
            ${chip('clickType', 'Click/Type')}
            ${chip('fileAccess', 'File Access')}
            ${chip('payments', 'Payments')}
          </div>
        </div>

        <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
          ${slider('maxRetries','Max Retries',0,10,state.cortex.maxRetries,false)}
          ${slider('cautionLevel','Caution Level',1,10,state.cortex.cautionLevel,false)}
          ${slider('maxSpend','Max Spend',0,500,state.cortex.maxSpend,!state.cortex.payments)}
        </div>
      </section>
    `;

    pageRoot.querySelectorAll('[data-chip]').forEach(btn => {
      btn.onclick = () => {
        const key = btn.dataset.chip;
        state.cortex[key] = !state.cortex[key];
        if (key === 'payments' && !state.cortex.payments) state.cortex.maxSpend = 0;
        render();
      };
    });

    pageRoot.querySelectorAll('[data-slider]').forEach(input => {
      input.oninput = () => {
        const key = input.dataset.slider;
        state.cortex[key] = Number(input.value);
        const out = document.querySelector(`[data-out="${key}"]`);
        if (out) out.textContent = input.value;
      };
    });
  }

  function chip(key, label) {
    const on = !!state.cortex[key];
    return `<button data-chip="${key}" class="px-3 py-1.5 rounded-full border text-sm ${on ? 'bg-neon text-black border-neon shadow-neon font-semibold' : 'bg-zinc-900 border-white/10 text-zinc-300'}">${label}</button>`;
  }

  function slider(key, label, min, max, value, disabled) {
    return `
      <label class="glass rounded-xl p-3 block ${disabled ? 'opacity-50' : ''}">
        <div class="flex items-center justify-between text-sm mb-2">
          <span>${label}</span>
          <span data-out="${key}" class="text-neon">${value}</span>
        </div>
        <input data-slider="${key}" type="range" min="${min}" max="${max}" value="${value}" ${disabled?'disabled':''} class="w-full accent-[rgb(57,255,20)]" />
      </label>
    `;
  }

  function renderDirectCommand() {
    pageRoot.innerHTML = `
      <section class="glass rounded-2xl p-4 h-[76vh] flex flex-col">
        <h2 class="text-sm uppercase tracking-wider text-zinc-400 mb-3">Direct Command</h2>
        <div id="terminalLog" class="flex-1 bg-black/35 border border-white/10 rounded-xl p-3 overflow-auto scrollbar-thin font-mono text-sm space-y-1"></div>
        <form id="terminalForm" class="mt-3 flex items-center gap-2">
          <span class="text-neon drop-shadow-[0_0_6px_rgba(57,255,20,.45)]">baymax@mc:~$</span>
          <input id="terminalInput" autocomplete="off" class="flex-1 bg-transparent outline-none text-zinc-100 placeholder:text-zinc-600" placeholder="help" />
        </form>
      </section>
    `;

    const terminalLog = document.getElementById('terminalLog');
    const terminalForm = document.getElementById('terminalForm');
    const terminalInput = document.getElementById('terminalInput');
    drawTerminalLog(terminalLog);

    terminalForm.onsubmit = (e) => {
      e.preventDefault();
      runCommand(terminalInput.value.trim(), terminalLog);
      terminalInput.value = '';
    };
  }

  function drawTerminalLog(node) {
    node.innerHTML = state.terminal.log.map(l => `<div>${escapeHtml(l)}</div>`).join('');
    node.scrollTop = node.scrollHeight;
  }

  function runCommand(input, logNode) {
    if (!input) return;
    state.terminal.log.push(`$ ${input}`);

    if (input === 'help') {
      state.terminal.log.push('Commands: help, clear, status');
    } else if (input === 'clear') {
      state.terminal.log = [];
    } else if (input === 'status') {
      state.terminal.log.push(`[status] mode=${state.agent.mode} paused=${state.agent.paused} errors=${state.agent.errorCount}`);
      state.terminal.log.push(`[status] intents=${state.intents.length} activePage=${state.activePage}`);
    } else {
      state.terminal.log.push(`[error] unknown command: ${input}`);
    }

    if (logNode) drawTerminalLog(logNode);
    drawTerminalLog(overlayLog);
  }

  function render() {
    renderTabs();

    if (state.activePage === 'Mission Control') renderMissionControl();
    else if (state.activePage === 'Strategic Memory') renderStrategicMemory();
    else if (state.activePage === 'Cortex Config') renderCortexConfig();
    else renderDirectCommand();
  }

  function pushIntent({ verb, target, why, state: intentState = 'normal' }) {
    state.intents.unshift({
      id: crypto.randomUUID(),
      ts: now(),
      verb,
      target,
      why,
      state: intentState
    });
    if (state.intents.length > 40) state.intents.pop();

    state.agent.lastAction = `${verb} ${target}`;
    state.agent.task = why;
  }

  function randomIntent() {
    const verb = verbs[Math.floor(Math.random() * verbs.length)];
    const target = targets[Math.floor(Math.random() * targets.length)];
    const why = whys[Math.floor(Math.random() * whys.length)];
    const roll = Math.random();
    const intentState = roll < 0.08 ? 'error' : roll < 0.2 ? 'warning' : roll < 0.45 ? 'active' : 'normal';

    if (intentState === 'error') state.agent.errorCount += 1;
    pushIntent({ verb, target, why, state: intentState });
    if (state.activePage === 'Mission Control') renderMissionControl();
  }

  function moveFocusDot() {
    state.focusDot = {
      x: Math.floor(Math.random() * 85) + 5,
      y: Math.floor(Math.random() * 80) + 8
    };
    if (state.activePage === 'Mission Control') {
      const dot = document.getElementById('focusDot');
      if (dot) {
        dot.style.left = `${state.focusDot.x}%`;
        dot.style.top = `${state.focusDot.y}%`;
      }
    }
  }

  function openEditModal(intentId) {
    editIntentId = intentId;
    const intent = state.intents.find(i => i.id === intentId);
    if (!intent) return;
    editVerb.value = intent.verb;
    editTarget.value = intent.target;
    editWhy.value = intent.why;
    editModal.classList.remove('hidden');
    state.editModalOpen = true;
  }

  function closeModal() {
    editModal.classList.add('hidden');
    state.editModalOpen = false;
    editIntentId = null;
  }

  closeEditModal.onclick = closeModal;
  saveEdit.onclick = () => {
    if (!editIntentId) return closeModal();
    const it = state.intents.find(x => x.id === editIntentId);
    if (!it) return closeModal();
    it.verb = editVerb.value;
    it.target = editTarget.value;
    it.why = editWhy.value;
    state.agent.lastAction = `Edited next step: ${it.verb} ${it.target}`;
    closeModal();
    render();
  };

  // Terminal overlay wiring
  closeOverlay.onclick = () => toggleOverlay(false);
  overlayForm.onsubmit = (e) => {
    e.preventDefault();
    runCommand(overlayInput.value.trim(), null);
    overlayInput.value = '';
  };

  function toggleOverlay(force) {
    const show = typeof force === 'boolean' ? force : terminalOverlay.classList.contains('hidden');
    terminalOverlay.classList.toggle('hidden', !show);
    if (show) {
      drawTerminalLog(overlayLog);
      setTimeout(() => overlayInput.focus(), 30);
    }
  }

  document.addEventListener('keydown', (e) => {
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
      e.preventDefault();
      toggleOverlay();
    }
    if (e.key === 'Escape' && state.editModalOpen) closeModal();
  });

  function escapeHtml(s) {
    return String(s)
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#39;');
  }

  // Timers
  setInterval(randomIntent, 3000);
  setInterval(moveFocusDot, 2000);

  // Initial render
  drawTerminalLog(overlayLog);
  render();
})();
