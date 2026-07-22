/* Team admin UI — deep analytics for members, projects, tokens, model pricing, and files */
const RANGE_PRESETS = [
  { id: 'today', label: 'Today' },
  { id: '7d', label: '7d' },
  { id: '30d', label: '30d' },
  { id: '90d', label: '90d' },
  { id: 'all', label: 'All' },
];

let teams = [];
let teamId = localStorage.getItem('team-id') || '';
let dateRange = { from: '', to: '', all: true };
let adminToken = sessionStorage.getItem('team-admin-token') || '';
let currentStatsData = null;
let currentMembersList = [];

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
  if (id === 'today') return { from: today, to: today, all: false };
  if (id === '7d') return { from: shiftLocalDay(6), to: today, all: false };
  if (id === '30d') return { from: shiftLocalDay(29), to: today, all: false };
  if (id === '90d') return { from: shiftLocalDay(89), to: today, all: false };
  return { from: '', to: '', all: true };
}

function cleanProjectName(p) {
  if (!p || p === 'default' || p === 'unknown') return 'default';
  let s = String(p).trim();
  if (s.includes('/') || s.includes('\\')) {
    const parts = s.split(/[\/\\]/).filter(Boolean);
    return parts[parts.length - 1] || s;
  }
  if (/^(Users|home|[A-Z])-/i.test(s)) {
    s = s.replace(/^(Users|home|C)-[^-]+-(Coding|Projects|code|dev|workspace|github)-/i, '');
    s = s.replace(/^(Users|home|C)-[^-]+-/i, '');
  }
  return s || 'default';
}

async function api(path, opts = {}) {
  const headers = { ...(opts.headers || {}) };
  if (adminToken && !headers.Authorization) {
    headers.Authorization = `Bearer ${adminToken}`;
  }
  const res = await fetch(path, { credentials: 'include', ...opts, headers });
  if (res.status === 401) {
    adminToken = '';
    sessionStorage.removeItem('team-admin-token');
    showLogin();
    throw new Error('session expired');
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
  return data;
}

function showRecalculationLoader(msg = 'Updating token cost calculations...') {
  let loader = document.getElementById('cost-calculation-loader');
  if (!loader) {
    loader = document.createElement('div');
    loader.id = 'cost-calculation-loader';
    loader.className = 'cost-calc-banner';
    document.body.appendChild(loader);
  }
  loader.innerHTML = `<div class="spinner"></div> <span>${msg}</span>`;
  loader.style.display = 'flex';
}

function hideRecalculationLoader() {
  const loader = document.getElementById('cost-calculation-loader');
  if (loader) loader.style.display = 'none';
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
  const num = Number(n);
  if (num >= 1_000_000) return `${(num / 1_000_000).toFixed(1)}M`;
  if (num >= 1_000) return `${(num / 1_000).toFixed(1)}k`;
  return num % 1 === 0 ? String(num) : num.toFixed(1);
}

function fmtCost(n) {
  if (n == null || !Number(n)) return '$0.00';
  return `$${Number(n).toFixed(2)}`;
}

function fmtMicroCost(n) {
  if (n == null || !Number(n)) return '$0.00';
  const num = Number(n);
  if (num < 0.01) {
    return `$${num.toFixed(4)}`;
  }
  return `$${num.toFixed(2)}`;
}

function fmtPct(n) {
  if (n == null || !Number.isFinite(n)) return '—';
  return `${(n * 100).toFixed(1)}%`;
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

  const memberId = document.getElementById('global-member-filter')?.value;
  if (memberId && memberId !== 'all') params.set('memberId', memberId);

  const source = document.getElementById('global-source-filter')?.value;
  if (source && source !== 'all') params.set('source', source);

  const minTokens = document.getElementById('global-min-tokens-filter')?.value;
  if (minTokens && Number(minTokens) > 0) params.set('minTokens', minTokens);

  return params.toString();
}

function renderBars(containerId, rows, labelKey, valueKey) {
  const el = document.getElementById(containerId);
  if (!el) return;
  if (!rows?.length) { el.innerHTML = '<p class="muted">No data matching active filters</p>'; return; }
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
    ['Sessions', fmt(t.sessions), 'Agent executions'],
    ['Input Tokens', fmt(t.tokensIn), 'Sent to LLM'],
    ['Output Tokens', fmt(t.tokensOut), 'Generated by LLM'],
    ['Cache-Read Tokens', fmt(t.tokensCacheRead), 'Reused prompt context'],
    ['Code Edits', fmt(t.edits), `${fmt(t.changedLines)} lines changed`],
    ['API Equivalent Cost', fmtCost(t.apiCost), 'Estimated billable value'],
  ].map(([label, value, sub]) => `<div class="card"><div class="label">${label}</div><div class="value">${value}</div><div class="sub">${sub}</div></div>`).join('');
}

function renderLeaderboard(rows) {
  const el = document.getElementById('leaderboard');
  if (!el) return;
  if (!rows?.length) { el.innerHTML = '<p class="muted">No member data matching active filters</p>'; return; }
  el.innerHTML = `<table><thead><tr>
    <th>Member</th><th>Sessions</th><th>Input Tokens</th><th>Output Tokens</th><th>Edits</th><th>Lines Diff</th><th>Est. Cost</th>
  </tr></thead><tbody>${rows.map((r) => `<tr>
    <td><strong>👤 ${r.display_name}</strong></td>
    <td>${fmt(r.sessions)}</td>
    <td>${fmt(r.tokens_in)}</td>
    <td>${fmt(r.tokens_out)}</td>
    <td>${fmt(r.edits)}</td>
    <td><span class="diff-add">+${fmt(r.additions || 0)}</span> / <span class="diff-del">−${fmt(r.deletions || 0)}</span></td>
    <td><strong>${fmtCost(r.api_cost)}</strong></td>
  </tr>`).join('')}</tbody></table>`;
}

function renderTokenLeaderboard(rows) {
  const el = document.getElementById('token-leaderboard-table');
  if (!el) return;
  if (!rows?.length) { el.innerHTML = '<p class="muted">No token records matching active filters</p>'; return; }
  const maxTokens = rows[0]?.total_tokens || 1;

  el.innerHTML = `<table><thead><tr>
    <th>Rank</th><th>Member</th><th>Total Tokens</th><th>Team Share</th><th>Input Tokens</th><th>Output Tokens</th><th>Cache Read</th><th>Est. API Cost</th>
  </tr></thead><tbody>${rows.map((r, i) => `<tr>
    <td><strong>#${i + 1}</strong></td>
    <td><strong>👤 ${r.display_name}</strong></td>
    <td><strong>${fmt(r.total_tokens)}</strong></td>
    <td>
      <div class="bar-row" style="margin:0">
        <div class="track" style="width:80px"><div class="fill" style="width:${Math.round((r.total_tokens / maxTokens) * 100)}%"></div></div>
        <span class="val">${r.share_pct ? r.share_pct.toFixed(1) + '%' : '—'}</span>
      </div>
    </td>
    <td>${fmt(r.tokens_in)}</td>
    <td>${fmt(r.tokens_out)}</td>
    <td>${fmt(r.tokens_cache_read)}</td>
    <td><strong>${fmtCost(r.api_cost)}</strong></td>
  </tr>`).join('')}</tbody></table>`;
}

function renderHeadToHead(rows) {
  const el = document.getElementById('head-to-head-table');
  if (!el) return;
  if (!rows?.length) { el.innerHTML = '<p class="muted">No efficiency data available</p>'; return; }
  el.innerHTML = `<table><thead><tr>
    <th>Member</th><th>Edits / Session</th><th>Tokens / Edit</th><th>Tool Error Rate</th><th>Cache Efficiency</th><th>Cost / Edit</th><th>Cost / 100 Lines</th>
  </tr></thead><tbody>${rows.map((r) => `<tr>
    <td><strong>👤 ${r.display_name}</strong></td>
    <td>${r.editsPerSession.toFixed(2)}</td>
    <td>${fmt(r.outputTokensPerEdit)}</td>
    <td>${fmtPct(r.toolErrorRate)}</td>
    <td>${fmtPct(r.cacheEfficiency)}</td>
    <td>${fmtMicroCost(r.costPerEdit)}</td>
    <td>${fmtMicroCost(r.costPer100Lines)}</td>
  </tr>`).join('')}</tbody></table>`;
}

function renderMemberDrilldown(membersData) {
  const select = document.getElementById('member-filter-select');
  const container = document.getElementById('member-drilldown-cards');
  if (!container || !membersData) return;

  if (select && select.children.length <= 1) {
    select.innerHTML = '<option value="all">All Members</option>' +
      membersData.map((m) => `<option value="${m.member_id}">${m.display_name}</option>`).join('');
    select.onchange = () => renderMemberDrilldown(membersData);
  }

  const selectedId = select?.value || 'all';
  const filtered = selectedId === 'all' ? membersData : membersData.filter((m) => m.member_id === selectedId);

  if (!filtered.length) {
    container.innerHTML = '<p class="muted">No member data matching filters.</p>';
    return;
  }

  container.innerHTML = filtered.map((m) => {
    const sourcesHtml = m.sources?.length
      ? m.sources.map((s) => `
        <div class="bar-row">
          <span class="name"><span class="source-tag">${s.source}</span></span>
          <div class="track"><div class="fill" style="width:${Math.min(100, (s.tokens_in / Math.max(1, m.tokens_in)) * 100)}%"></div></div>
          <span class="val">${fmt(s.tokens_in)} in / ${fmtCost(s.api_cost)}</span>
        </div>`).join('')
      : '<p class="muted">No source breakdown</p>';

    const projectsHtml = m.projects?.length
      ? `<div class="table-wrap"><table><thead><tr><th>Project / Workspace</th><th>Source</th><th>Sessions</th><th>Tokens</th><th>Cost</th></tr></thead><tbody>` +
        m.projects.map((p) => `<tr>
          <td><strong>📁 ${cleanProjectName(p.project)}</strong></td>
          <td><span class="source-tag">${p.source}</span></td>
          <td>${fmt(p.sessions)}</td>
          <td>${fmt(p.tokens_in)} in</td>
          <td>${fmtCost(p.api_cost)}</td>
        </tr>`).join('') + `</tbody></table></div>`
      : '<p class="muted">No projects logged yet</p>';

    const modelsHtml = m.models?.length
      ? `<div class="table-wrap"><table><thead><tr><th>LLM Model Used</th><th>Source</th><th>Sessions</th><th>Tokens (In/Out)</th><th>Est. Cost</th></tr></thead><tbody>` +
        m.models.map((mod) => `<tr>
          <td><strong>🤖 <code>${mod.model}</code></strong></td>
          <td><span class="source-tag">${mod.source}</span></td>
          <td>${fmt(mod.sessions)}</td>
          <td>${fmt(mod.tokens_in)} / ${fmt(mod.tokens_out)}</td>
          <td><strong>${fmtCost(mod.api_cost)}</strong></td>
        </tr>`).join('') + `</tbody></table></div>`
      : '<p class="muted">No model usage logged yet</p>';

    const filesHtml = m.topFiles?.length
      ? `<div class="table-wrap"><table><thead><tr><th>File Path</th><th>Edits</th><th>Diff (+ / −)</th></tr></thead><tbody>` +
        m.topFiles.map((f) => `<tr>
          <td><code>${f.path}</code></td>
          <td>${fmt(f.edits)}</td>
          <td><span class="diff-add">+${fmt(f.additions)}</span> <span class="diff-del">−${fmt(f.deletions)}</span></td>
        </tr>`).join('') + `</tbody></table></div>`
      : '<p class="muted">No code edit payloads found</p>';

    return `
      <details class="member-card" open id="member-card-${m.member_id}">
        <summary class="member-header">
          <div style="display:flex; align-items:center; gap:10px;">
            <h3 style="margin:0;">👤 ${m.display_name}</h3>
            <span class="source-tag">${fmt(m.sessions)} sessions</span>
            <span class="source-tag">${fmt(Number(m.tokens_in || 0) + Number(m.tokens_out || 0))} tokens</span>
          </div>
          <div style="display:flex; align-items:center; gap:10px;">
            <strong>${fmtCost(m.api_cost)} total cost</strong>
            <button type="button" class="hbtn" style="border-color:var(--brand);color:var(--brand-hi);font-size:11px;padding:3px 8px;" onclick="event.stopPropagation(); triggerMemberSync('${m.member_id}', '${encodeURIComponent(m.display_name)}')">⚡ Trigger Sync</button>
            <span class="collapse-icon">▼</span>
          </div>
        </summary>
        <div class="member-body">
          <div class="member-stats-grid">
            <div class="mini-stat"><span>Input Tokens</span><strong>${fmt(m.tokens_in)}</strong></div>
            <div class="mini-stat"><span>Output Tokens</span><strong>${fmt(m.tokens_out)}</strong></div>
            <div class="mini-stat"><span>Cache Read</span><strong>${fmt(m.tokens_cache_read)}</strong></div>
            <div class="mini-stat"><span>Code Edits</span><strong>${fmt(m.edits)}</strong></div>
            <div class="mini-stat"><span>Lines Changed</span><strong>+${fmt(m.additions || 0)} / −${fmt(m.deletions || 0)}</strong></div>
            <div class="mini-stat"><span>API Cost</span><strong>${fmtCost(m.api_cost)}</strong></div>
          </div>
          <div class="member-sections">
            <div class="member-subpanel">
              <h4>AI Tools & Accounts Used</h4>
              ${sourcesHtml}
            </div>
            <div class="member-subpanel">
              <h4>Projects & Repos Worked On</h4>
              ${projectsHtml}
            </div>
          </div>
          <div style="margin-top: 14px;" class="member-sections">
            <div class="member-subpanel">
              <h4>LLM Models Used by ${m.display_name}</h4>
              ${modelsHtml}
            </div>
            <div class="member-subpanel">
              <h4>Top Modified Files by ${m.display_name}</h4>
              ${filesHtml}
            </div>
          </div>
        </div>
      </details>`;
  }).join('');
}

function renderProjects(projectsData) {
  const el = document.getElementById('projects-table');
  if (!el) return;
  if (!projectsData?.length) {
    el.innerHTML = '<p class="muted">No project activity matching filters.</p>';
    return;
  }
  el.innerHTML = `<table><thead><tr>
    <th>Project / Workspace Name</th><th>Contributors</th><th>AI Sources</th><th>Sessions</th><th>Input Tokens</th><th>Output Tokens</th><th>Lines Changed</th><th>Total API Cost</th>
  </tr></thead><tbody>${projectsData.map((p) => {
    const memberNames = p.members?.map((m) => m.display_name).join(', ') || '—';
    return `<tr>
      <td><strong>📁 ${cleanProjectName(p.project)}</strong> <br/><small class="muted">${p.project}</small></td>
      <td>${memberNames}</td>
      <td><span class="source-tag">${p.source_count || 1} sources</span></td>
      <td>${fmt(p.sessions)}</td>
      <td>${fmt(p.tokens_in)}</td>
      <td>${fmt(p.tokens_out)}</td>
      <td><span class="diff-add">+${fmt(p.changed_lines)}</span></td>
      <td><strong>${fmtCost(p.api_cost)}</strong></td>
    </tr>`;
  }).join('')}</tbody></table>`;
}

function renderTopFiles(filesData) {
  const el = document.getElementById('top-files');
  if (!el) return;
  if (!filesData?.length) {
    el.innerHTML = '<p class="muted">No code modification payloads matching filters.</p>';
    return;
  }
  el.innerHTML = `<table><thead><tr>
    <th>Codebase File Path</th><th>Edits</th><th>Lines Added</th><th>Lines Removed</th><th>Total Diff</th><th>Contributors</th>
  </tr></thead><tbody>${filesData.map((f) => `<tr>
    <td><code>${f.path}</code></td>
    <td>${fmt(f.edits)}</td>
    <td><span class="diff-add">+${fmt(f.additions || 0)}</span></td>
    <td><span class="diff-del">−${fmt(f.deletions || 0)}</span></td>
    <td><strong>${fmt(f.changed_lines)}</strong></td>
    <td>${fmt(f.member_count || 1)} member(s)</td>
  </tr>`).join('')}</tbody></table>`;
}

function renderSessionLogs(logs) {
  const el = document.getElementById('session-logs-table');
  if (!el) return;
  if (!logs?.length) {
    el.innerHTML = '<p class="muted">No activity logs matching filters.</p>';
    return;
  }
  el.innerHTML = `<table><thead><tr>
    <th>Timestamp</th><th>Member</th><th>Project</th><th>Source / Agent</th><th>Model</th><th>Tokens (In/Out)</th><th>Cost</th>
  </tr></thead><tbody>${logs.map((l) => `<tr>
    <td>${fmtDate(l.timestamp)}</td>
    <td><strong>👤 ${l.member_name}</strong></td>
    <td><code>${cleanProjectName(l.project)}</code></td>
    <td><span class="source-tag">${l.source}</span></td>
    <td>${l.model || '—'}</td>
    <td>${fmt(l.tokens_in)} / ${fmt(l.tokens_out)}</td>
    <td><strong>${fmtCost(l.api_cost)}</strong></td>
  </tr>`).join('')}</tbody></table>`;
}

function renderModelPricingTable(pricingList) {
  const el = document.getElementById('model-pricing-table');
  if (!el) return;

  const defaultDefaults = [
    { model_pattern: 'claude-3-5-sonnet / 3-7-sonnet', cost_in_per_m: 3.00, cost_out_per_m: 15.00, cost_cache_read_per_m: 0.30, isDefault: true },
    { model_pattern: 'claude-3-5-haiku', cost_in_per_m: 0.80, cost_out_per_m: 4.00, cost_cache_read_per_m: 0.08, isDefault: true },
    { model_pattern: 'gpt-4o', cost_in_per_m: 2.50, cost_out_per_m: 10.00, cost_cache_read_per_m: 1.25, isDefault: true },
    { model_pattern: 'o1 / o3-mini', cost_in_per_m: 1.10, cost_out_per_m: 4.40, cost_cache_read_per_m: 0.55, isDefault: true },
  ];

  const customRows = pricingList?.length ? pricingList : [];
  const displayRows = [...customRows, ...defaultDefaults];

  el.innerHTML = `<table><thead><tr>
    <th>Model Pattern / Name</th><th>Input Cost ($/1M)</th><th>Output Cost ($/1M)</th><th>Cache-Read Cost ($/1M)</th><th>Type</th><th>Actions</th>
  </tr></thead><tbody>${displayRows.map((p) => `<tr>
    <td><strong><code>${p.model_pattern}</code></strong></td>
    <td>$${Number(p.cost_in_per_m).toFixed(2)} / 1M</td>
    <td>$${Number(p.cost_out_per_m).toFixed(2)} / 1M</td>
    <td>$${Number(p.cost_cache_read_per_m).toFixed(2)} / 1M</td>
    <td><span class="source-tag">${p.isDefault ? 'Standard Default' : 'Custom Team Override'}</span></td>
    <td>
      ${p.id ? `<button type="button" class="hbtn" style="color:#ee5555" onclick="deletePricingRule('${p.id}')">🗑️ Remove Rule</button>` : '—'}
    </td>
  </tr>`).join('')}</tbody></table>`;
}

function renderMemberModelsTable(memberModels) {
  const el = document.getElementById('member-models-table');
  if (!el) return;
  if (!memberModels?.length) {
    el.innerHTML = '<p class="muted">No member model usage recorded matching filters.</p>';
    return;
  }
  el.innerHTML = `<table><thead><tr>
    <th>Member Name</th><th>LLM Model Used</th><th>Agent Source</th><th>Sessions</th><th>Input Tokens</th><th>Output Tokens</th><th>Estimated API Cost</th>
  </tr></thead><tbody>${memberModels.map((m) => `<tr>
    <td><strong>👤 ${m.member_name}</strong></td>
    <td>🤖 <code>${m.model}</code></td>
    <td><span class="source-tag">${m.source}</span></td>
    <td>${fmt(m.sessions)}</td>
    <td>${fmt(m.tokens_in)}</td>
    <td>${fmt(m.tokens_out)}</td>
    <td><strong>${fmtCost(m.api_cost)}</strong></td>
  </tr>`).join('')}</tbody></table>`;
}

window.deletePricingRule = async function (id) {
  if (!confirm('Are you sure you want to delete this model pricing override rule?')) return;
  showRecalculationLoader('Removing rule & recalculating session costs...');
  try {
    await api(`/api/v1/team/pricing?id=${id}&teamId=${teamId}`, { method: 'DELETE' });
    await loadStats();
  } catch (err) {
    alert(formatError(err.message));
  } finally {
    hideRecalculationLoader();
  }
};

function renderMembersTable(rows) {
  currentMembersList = rows;
  const select = document.getElementById('global-member-filter');
  if (select && rows?.length) {
    const currentVal = select.value;
    select.innerHTML = '<option value="all">All Members</option>' +
      rows.map((m) => `<option value="${m.id}">${m.display_name}</option>`).join('');
    if (currentVal && rows.some((m) => m.id === currentVal)) select.value = currentVal;
  }

  const el = document.getElementById('members');
  if (!el) return;
  if (!rows?.length) { el.innerHTML = '<p class="muted">No members registered</p>'; return; }
  const host = window.location.origin;

  el.innerHTML = `<table><thead><tr>
    <th>Member Name</th><th>Role</th><th>Sessions</th><th>Tokens Used</th><th>Total API Cost</th><th>Last Sync</th><th>Actions</th>
  </tr></thead><tbody>
    ${rows.map((m) => {
      const installCmd = `curl -fsSL ${host}/install.sh | bash -s -- --key ${m.api_key || 'av_live_YOUR_KEY'}`;
      return `<tr>
        <td><strong>👤 ${m.display_name}</strong></td>
        <td><span class="source-tag">${m.role}</span></td>
        <td>${fmt(m.session_count || 0)}</td>
        <td>${fmt(m.total_tokens || 0)}</td>
        <td><strong>${fmtCost(m.total_cost || 0)}</strong></td>
        <td>${fmtDate(m.last_sync_at)}</td>
        <td>
          <button type="button" class="hbtn" style="border-color:var(--brand);color:var(--brand-hi);" onclick="triggerMemberSync('${m.id}', '${encodeURIComponent(m.display_name)}')">⚡ Trigger Sync</button>
          <button type="button" class="hbtn primary" onclick="copyInstallCmd('${encodeURIComponent(installCmd)}')">📋 Copy Install Cmd</button>
          <button type="button" class="hbtn" onclick="openEditMember('${m.id}', '${encodeURIComponent(m.display_name)}', '${m.role}')">✏️ Edit</button>
          <button type="button" class="hbtn" style="color:#ee5555" onclick="confirmDeleteMember('${m.id}', '${encodeURIComponent(m.display_name)}')">🗑️ Delete</button>
        </td>
      </tr>`;
    }).join('')}
  </tbody></table>`;
}

window.copyInstallCmd = function (encodedCmd) {
  const cmd = decodeURIComponent(encodedCmd);
  navigator.clipboard.writeText(cmd).then(() => {
    alert('📋 Mac Install Command copied to clipboard!\n\nTeam member can paste this in Mac Terminal:\n\n' + cmd);
  }).catch(() => {
    prompt('Copy Mac Install Command:', cmd);
  });
};

window.openEditMember = function (id, encodedName, role) {
  const name = decodeURIComponent(encodedName);
  document.getElementById('edit-member-id').value = id;
  document.getElementById('edit-member-name').value = name;
  document.getElementById('edit-member-role').value = role || 'member';
  document.getElementById('edit-member-dialog').showModal();
};

window.confirmDeleteMember = async function (id, encodedName) {
  const name = decodeURIComponent(encodedName);
  if (!confirm(`Are you sure you want to delete member "${name}" and all their synced session data? This cannot be undone.`)) {
    return;
  }
  try {
    await api(`/api/v1/team/members?id=${id}&teamId=${teamId}`, { method: 'DELETE' });
    loadMembers();
    loadStats();
  } catch (err) {
    alert(formatError(err.message));
  }
};

async function loadStats() {
  if (!teamId) return;
  const stats = await api(`/api/v1/team/stats?${statsQuery()}`);
  currentStatsData = stats;

  renderTotals(stats.totals);
  renderLeaderboard(stats.leaderboard);
  renderTokenLeaderboard(stats.tokenLeaderboard);
  renderHeadToHead(stats.scoreboard);
  renderMemberDrilldown(stats.leaderboard);
  renderProjects(stats.projects);
  renderBars('by-source', stats.bySource, 'source', 'api_cost');
  renderBars('by-day', stats.byDay, 'date', 'tokens_in');
  renderBars('top-tools', stats.topTools, 'name', 'count');
  renderTopFiles(stats.topFiles);
  renderSessionLogs(stats.recentLogs);
  renderModelPricingTable(stats.modelPricing);
  renderMemberModelsTable(stats.memberModels);
}

async function loadMembers() {
  if (!teamId) return;
  const { members } = await api(`/api/v1/team/members?teamId=${teamId}`);
  renderMembersTable(members);
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
  if (msg === 'not found') return 'API route not found — restart server or redeploy.';
  if (msg === 'invalid credentials') return 'Wrong password.';
  return msg;
}

function setupTabs() {
  const tabsNav = document.getElementById('team-tabs');
  if (!tabsNav) return;
  tabsNav.querySelectorAll('.tab-btn').forEach((btn) => {
    btn.onclick = () => {
      tabsNav.querySelectorAll('.tab-btn').forEach((b) => b.classList.remove('active'));
      document.querySelectorAll('.tab-content').forEach((tc) => { tc.hidden = true; tc.classList.remove('active'); });

      btn.classList.add('active');
      const targetId = btn.dataset.tab;
      const targetEl = document.getElementById(targetId);
      if (targetEl) {
        targetEl.hidden = false;
        targetEl.classList.add('active');
      }
    };
  });
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

// Event listeners for global header filters
document.getElementById('global-member-filter')?.addEventListener('change', () => {
  loadStats().catch((err) => setAppError(formatError(err.message)));
});
document.getElementById('global-source-filter')?.addEventListener('change', () => {
  loadStats().catch((err) => setAppError(formatError(err.message)));
});
document.getElementById('global-min-tokens-filter')?.addEventListener('change', () => {
  loadStats().catch((err) => setAppError(formatError(err.message)));
});

document.getElementById('refresh').addEventListener('click', () => {
  setAppError('');
  Promise.all([loadStats(), loadMembers()]).catch((err) => setAppError(formatError(err.message)));
});

document.getElementById('recalculate-costs-btn')?.addEventListener('click', async () => {
  if (!teamId) return;
  const btn = document.getElementById('recalculate-costs-btn');
  const origText = btn.textContent;
  btn.disabled = true;
  btn.textContent = '⏳ Recalculating session costs…';
  showRecalculationLoader('⚡ Recalculating costs across all team sessions...');

  try {
    const res = await api('/api/v1/team/recalculate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ teamId }),
    });
    await loadStats();
    alert(`✓ Successfully recalculated costs across ${res.updatedCount || res.totalSessions || 0} sessions using latest model rates!`);
  } catch (err) {
    alert(formatError(err.message));
  } finally {
    btn.disabled = false;
    btn.textContent = origText;
    hideRecalculationLoader();
  }
});

document.getElementById('add-member-btn').addEventListener('click', () => {
  document.getElementById('add-member-dialog').showModal();
});

document.getElementById('cancel-member').addEventListener('click', () => {
  document.getElementById('add-member-dialog').close();
});

document.getElementById('cancel-edit-member').addEventListener('click', () => {
  document.getElementById('edit-member-dialog').close();
});

document.getElementById('add-pricing-btn')?.addEventListener('click', () => {
  document.getElementById('add-pricing-dialog').showModal();
});

document.getElementById('cancel-pricing')?.addEventListener('click', () => {
  document.getElementById('add-pricing-dialog').close();
});

document.getElementById('add-member-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const name = document.getElementById('member-name').value.trim();
  const role = document.getElementById('member-role').value || 'member';
  if (!name || !teamId) return;
  try {
    const { member, apiKey } = await api('/api/v1/team/members', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ teamId, displayName: name, role }),
    });
    document.getElementById('add-member-dialog').close();
    document.getElementById('member-name').value = '';

    const host = window.location.origin;
    const installCmd = `curl -fsSL ${host}/install.sh | bash -s -- --key ${apiKey}`;

    const banner = document.getElementById('new-key');
    banner.hidden = false;
    banner.innerHTML = `<strong>New Member Created: ${member.display_name}</strong><br/>` +
      `API Key: <code>${apiKey}</code><br/><br/>` +
      `<strong>Mac One-Line Install Command:</strong><br/>` +
      `<code style="user-select:all">${installCmd}</code>`;

    loadMembers();
    loadStats();
  } catch (err) {
    alert(formatError(err.message));
  }
});

document.getElementById('edit-member-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const id = document.getElementById('edit-member-id').value;
  const name = document.getElementById('edit-member-name').value.trim();
  const role = document.getElementById('edit-member-role').value || 'member';
  if (!id || !name || !teamId) return;
  try {
    await api('/api/v1/team/members', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, teamId, displayName: name, role }),
    });
    document.getElementById('edit-member-dialog').close();
    loadMembers();
    loadStats();
  } catch (err) {
    alert(formatError(err.message));
  }
});

document.getElementById('add-pricing-form')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  const modelPattern = document.getElementById('pricing-model-pattern').value.trim();
  const costInPerM = document.getElementById('pricing-cost-in').value;
  const costOutPerM = document.getElementById('pricing-cost-out').value;
  const costCacheReadPerM = document.getElementById('pricing-cost-cache').value;
  if (!modelPattern || !teamId) return;

  const submitBtn = e.target.querySelector('button[type="submit"]');
  const origText = submitBtn ? submitBtn.textContent : 'Save Rule';
  if (submitBtn) {
    submitBtn.disabled = true;
    submitBtn.textContent = '⏳ Saving & Recalculating Costs...';
  }

  showRecalculationLoader('Calculating session costs with new pricing rule...');

  try {
    await api('/api/v1/team/pricing', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        teamId,
        modelPattern,
        costInPerM: Number(costInPerM),
        costOutPerM: Number(costOutPerM),
        costCacheReadPerM: Number(costCacheReadPerM),
      }),
    });
    document.getElementById('add-pricing-dialog').close();
    document.getElementById('pricing-model-pattern').value = '';
    document.getElementById('pricing-cost-in').value = '';
    document.getElementById('pricing-cost-out').value = '';
    document.getElementById('pricing-cost-cache').value = '';
    await loadStats();
  } catch (err) {
    alert(formatError(err.message));
  } finally {
    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.textContent = origText;
    }
    hideRecalculationLoader();
  }
});

window.triggerMemberSync = async function (memberId = 'all', name = 'all members') {
  const memberName = name && name !== 'all members' ? decodeURIComponent(name) : 'all members';
  showRecalculationLoader(`Broadcasting sync signal to ${memberName}...`);
  try {
    await api('/api/v1/team/members/trigger-sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ teamId, memberId }),
    });
    alert(
      `⚡ Sync Request Broadcasted!\n\n` +
      `Server sent instant sync request to ${memberName}.\n` +
      `The background sync agent will perform an instant log rescan.\n\n` +
      `Optional: To force instant execution from Mac Terminal right now, run:\n` +
      `launchctl kickstart -k gui/$(id -u)/com.token-tracer.daemon`
    );
    await loadMembers();
    await loadStats();
  } catch (err) {
    alert(formatError(err.message));
  } finally {
    const banner = document.querySelector('.cost-calc-banner');
    if (banner) banner.remove();
  }
};

document.getElementById('trigger-sync-all-btn')?.addEventListener('click', () => {
  window.triggerMemberSync('all', 'all members');
});

document.getElementById('collapse-all-members')?.addEventListener('click', () => {
  document.querySelectorAll('#member-drilldown-cards details.member-card').forEach((el) => el.removeAttribute('open'));
});

document.getElementById('expand-all-members')?.addEventListener('click', () => {
  document.querySelectorAll('#member-drilldown-cards details.member-card').forEach((el) => el.setAttribute('open', ''));
});

setupTabs();

if (adminToken) {
  showApp().catch(() => {
    adminToken = '';
    sessionStorage.removeItem('team-admin-token');
    showLogin();
  });
} else {
  showLogin();
}
