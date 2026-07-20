/* Team admin UI — uses /api/v1/* (separate from personal /api/*) */
const RANGE_PRESETS = [
  { id: '7d', label: '7d' },
  { id: '30d', label: '30d' },
  { id: '90d', label: '90d' },
  { id: 'all', label: 'All' },
];

let teams = [];
let teamId = localStorage.getItem('team-id') || '';
let dateRange = { from: '', to: '', all: true };
let adminToken = sessionStorage.getItem('team-admin-token') || '';

function localDayKey(d = new Date()) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function shiftLocalDay(daysBack) {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - daysBack);
  return localDayKey(d);
}

function rangeFromPreset(id) {
  const today = localDayKey();
  if (id === '7d') return { from: shiftLocalDay(6), to: today, all: false };
  if (id === '30d') return { from: shiftLocalDay(29), to: today, all: false };
  if (id === '90d') return { from: shiftLocalDay(89), to: today, all: false };
  return { from: '', to: '', all: true };
}

async function api(path, opts = {}) {
  const headers = { ...(opts.headers || {}) };
  if (adminToken && !headers.Authorization) {
    headers.Authorization = `Bearer ${adminToken}`;
  }
  const res = await fetch(path, { credentials: 'include', ...opts, headers });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
  return data;
}

function setLoginError(msg) {
  const errEl = document.getElementById('login-error');
  if (!errEl) return;
  errEl.textContent = msg;
  errEl.hidden = !msg;
}

function setAppError(msg) {
  const el = document.getElementById('app-error');
  if (!el) return;
  el.textContent = msg;
  el.hidden = !msg;
}

function setLoading(on) {
  const loading = document.getElementById('app-loading');
  const content = document.getElementById('app-content');
  if (loading) loading.hidden = !on;
  if (content) content.hidden = on;
}

function setLoginBusy(on) {
  const btn = document.getElementById('login-submit');
  if (!btn) return;
  btn.disabled = on;
  btn.textContent = on ? 'Signing in…' : 'Sign in';
}

function showLogin() {
  document.getElementById('login-screen').hidden = false;
  document.getElementById('app').hidden = true;
  setLoading(false);
}

function showDashboard() {
  document.getElementById('login-screen').hidden = true;
  document.getElementById('app').hidden = false;
  setLoading(false);
}

function fmt(n) {
  if (n == null) return '—';
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return String(n);
}

function fmtCost(n) {
  if (n == null || !Number(n)) return '—';
  return `$${Number(n).toFixed(2)}`;
}

function fmtDate(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleString();
}

function renderPresets() {
  const el = document.getElementById('range-presets');
  if (!el) return;
  el.innerHTML = '';
  for (const p of RANGE_PRESETS) {
    const btn = document.createElement('button');
    btn.textContent = p.label;
    btn.type = 'button';
    const active = p.id === 'all' ? dateRange.all : (!dateRange.all && rangeFromPreset(p.id).from === dateRange.from && rangeFromPreset(p.id).to === dateRange.to);
    if (active) btn.classList.add('active');
    btn.onclick = () => {
      dateRange = rangeFromPreset(p.id);
      document.getElementById('range-from').value = dateRange.from;
      document.getElementById('range-to').value = dateRange.to;
      renderPresets();
      loadStats().catch((err) => setAppError(formatError(err.message)));
    };
    el.appendChild(btn);
  }
}

function statsQuery() {
  const params = new URLSearchParams({ teamId });
  if (!dateRange.all && dateRange.from) params.set('from', dateRange.from);
  if (!dateRange.all && dateRange.to) params.set('to', dateRange.to);
  return params.toString();
}

function renderBars(containerId, rows, labelKey, valueKey) {
  const el = document.getElementById(containerId);
  if (!el) return;
  if (!rows?.length) { el.innerHTML = '<p class="muted">No data</p>'; return; }
  const max = Math.max(...rows.map((r) => r[valueKey]), 1);
  el.innerHTML = rows.map((r) => `
    <div class="bar-row">
      <span class="name">${r[labelKey]}</span>
      <div class="track"><div class="fill" style="width:${Math.round((r[valueKey] / max) * 100)}%"></div></div>
      <span class="val">${fmt(r[valueKey])}</span>
    </div>`).join('');
}

function renderTotals(t) {
  const el = document.getElementById('totals');
  if (!el || !t) return;
  el.innerHTML = [
    ['Sessions', fmt(t.sessions)],
    ['Edits', fmt(t.edits)],
    ['Changed lines', fmt(t.changedLines)],
    ['Tool calls', fmt(t.toolCalls)],
    ['API cost', fmtCost(t.apiCost)],
  ].map(([label, value]) => `<div class="card"><div class="label">${label}</div><div class="value">${value}</div></div>`).join('');
}

function renderLeaderboard(rows) {
  const el = document.getElementById('leaderboard');
  if (!el) return;
  if (!rows?.length) { el.innerHTML = '<p class="muted">No members yet</p>'; return; }
  el.innerHTML = `<table><thead><tr>
    <th>Member</th><th>Sessions</th><th>Edits</th><th>Lines</th><th>Tools</th><th>Cost</th>
  </tr></thead><tbody>${rows.map((r) => `<tr>
    <td>${r.display_name}</td>
    <td>${fmt(r.sessions)}</td>
    <td>${fmt(r.edits)}</td>
    <td>${fmt(r.changed_lines)}</td>
    <td>${fmt(r.tool_calls)}</td>
    <td>${fmtCost(r.api_cost)}</td>
  </tr>`).join('')}</tbody></table>`;
}

function renderMembers(rows) {
  const el = document.getElementById('members');
  if (!el) return;
  if (!rows?.length) { el.innerHTML = '<p class="muted">No members</p>'; return; }
  el.innerHTML = `<table><thead><tr><th>Name</th><th>Role</th><th>Last sync</th></tr></thead><tbody>
    ${rows.map((m) => `<tr><td>${m.display_name}</td><td>${m.role}</td><td>${fmtDate(m.last_sync_at)}</td></tr>`).join('')}
  </tbody></table>`;
}

async function loadStats() {
  if (!teamId) return;
  const stats = await api(`/api/v1/team/stats?${statsQuery()}`);
  renderTotals(stats.totals);
  renderLeaderboard(stats.leaderboard);
  renderBars('by-source', stats.bySource, 'source', 'edits');
  renderBars('by-day', stats.byDay, 'date', 'edits');
  renderBars('top-tools', stats.topTools, 'name', 'count');
  renderBars('top-files', stats.topFiles?.map((f) => ({ name: f.path, val: f.changed_lines })), 'name', 'val');
}

async function loadMembers() {
  if (!teamId) return;
  const { members } = await api(`/api/v1/team/members?teamId=${teamId}`);
  renderMembers(members);
}

async function loadTeams() {
  const { teams: list } = await api('/api/v1/teams');
  teams = list;
  const sel = document.getElementById('team-select');
  if (!sel) return;
  sel.innerHTML = teams.map((t) => `<option value="${t.id}">${t.name}</option>`).join('');
  if (teamId && teams.some((t) => t.id === teamId)) sel.value = teamId;
  else if (teams[0]) {
    teamId = teams[0].id;
    sel.value = teamId;
    localStorage.setItem('team-id', teamId);
  }
}

async function loadDashboardData() {
  renderPresets();
  await loadTeams();
  await Promise.all([loadStats(), loadMembers()]);
}

async function showApp() {
  setAppError('');
  showDashboard();
  setLoading(true);
  try {
    await loadDashboardData();
    setLoading(false);
  } catch (err) {
    showLogin();
    setLoginError(formatError(err.message));
    throw err;
  }
}

function formatError(msg) {
  if (msg === 'unauthorized') return 'Session expired — please sign in again.';
  if (msg === 'not found') return 'API route not found — restart team:dev or redeploy.';
  if (msg === 'invalid credentials') return 'Wrong password.';
  return msg;
}

document.getElementById('login-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  setLoginError('');
  setLoginBusy(true);
  try {
    const data = await api('/api/v1/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: document.getElementById('login-password').value }),
    });
    if (data.token) {
      adminToken = data.token;
      sessionStorage.setItem('team-admin-token', data.token);
    }
    await showApp();
  } catch (err) {
    showLogin();
    setLoginError(formatError(err.message));
  } finally {
    setLoginBusy(false);
  }
});

document.getElementById('team-select').addEventListener('change', (e) => {
  teamId = e.target.value;
  localStorage.setItem('team-id', teamId);
  loadStats().catch((err) => setAppError(formatError(err.message)));
  loadMembers().catch((err) => setAppError(formatError(err.message)));
});

document.getElementById('range-from').addEventListener('change', (e) => {
  dateRange.from = e.target.value;
  dateRange.all = !dateRange.from && !dateRange.to;
  renderPresets();
  loadStats().catch((err) => setAppError(formatError(err.message)));
});

document.getElementById('range-to').addEventListener('change', (e) => {
  dateRange.to = e.target.value;
  dateRange.all = !dateRange.from && !dateRange.to;
  renderPresets();
  loadStats().catch((err) => setAppError(formatError(err.message)));
});

document.getElementById('refresh').addEventListener('click', () => {
  setAppError('');
  Promise.all([loadStats(), loadMembers()]).catch((err) => setAppError(formatError(err.message)));
});

document.getElementById('add-member-btn').addEventListener('click', () => {
  document.getElementById('add-member-dialog').showModal();
});

document.getElementById('cancel-member').addEventListener('click', () => {
  document.getElementById('add-member-dialog').close();
});

document.getElementById('add-member-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const name = document.getElementById('member-name').value.trim();
  if (!name || !teamId) return;
  try {
    const { member, apiKey } = await api('/api/v1/team/members', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ teamId, displayName: name }),
    });
    document.getElementById('add-member-dialog').close();
    document.getElementById('member-name').value = '';
    const banner = document.getElementById('new-key');
    banner.hidden = false;
    banner.textContent = `API key for ${member.display_name} (copy now — shown once): ${apiKey}`;
    loadMembers();
  } catch (err) {
    alert(formatError(err.message));
  }
});

// Restore session from stored token
if (adminToken) {
  showApp().catch(() => {
    adminToken = '';
    sessionStorage.removeItem('team-admin-token');
    showLogin();
  });
} else {
  showLogin();
}
