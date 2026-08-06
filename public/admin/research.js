(function() {
  // Helper to select elements
  const $ = (s) => document.querySelector(s);
  const esc = (str) => {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  };

  const formatCost = window.fmtCost || ((v) => '$' + Number(v).toFixed(2));
  const formatTokens = window.fmtTokens || ((v) => String(v));

  // State
  let activeTab = 'tab-research';
  let activeStudy = null; // 'specificity', 'elasticity', 'saturation', 'frontier', 'reprompt'
  let teamsList = [];
  let researchLoaded = false;

  const STUDY_METRICS = {
    specificity: 'tokens', // 'tokens' | 'rework' | 'revert'
    frontier: 'bug_fix'   // intent category
  };

  const MODEL_COLORS = {
    'claude-3-7-sonnet': '#f87171',
    'claude-3-5-sonnet': '#fca5a5',
    'claude-3-5-haiku': '#fdba74',
    'gpt-4o': '#60a5fa',
    'gpt-4o-mini': '#93c5fd',
    'o1': '#c084fc',
    'o3-mini': '#e879f9',
    'deepseek-r1': '#34d399',
    'deepseek-v3': '#6ee7b7',
    'default': '#94a3b8'
  };

  function getModelColor(model) {
    const key = String(model || 'default').toLowerCase();
    for (const pattern in MODEL_COLORS) {
      if (key.includes(pattern)) return MODEL_COLORS[pattern];
    }
    return MODEL_COLORS.default;
  }

  // Initial Load & Setup
  async function init() {
    await fetchTeams();
    setupFilters();
    setupNavigation();
    setupToggles();
    loadLandingPreviews();
  }

  async function fetchTeams() {
    try {
      const res = await fetch('/api/admin/pricing');
      if (res.ok) {
        const data = await res.json();
        teamsList = data.teams || [];
        const orgSelect = $('#res-org-select');
        if (orgSelect) {
          orgSelect.innerHTML = '<option value="">— All Orgs —</option>' + 
            teamsList.map(t => `<option value="${esc(t.id)}">${esc(t.name)}</option>`).join('');
        }
      }
    } catch (err) {
      console.error('Failed to fetch teams list:', err);
    }
  }

  function setupFilters() {
    const filterSelectors = ['#res-range-select', '#res-org-select', '#res-tool-select', '#res-model-select'];
    filterSelectors.forEach(selector => {
      $(selector)?.addEventListener('change', () => {
        if (activeStudy) {
          loadStudyDetail(activeStudy);
        } else {
          loadLandingPreviews();
        }
      });
    });
  }

  function setupNavigation() {
    const cards = [
      { id: 'card-specificity', study: 'specificity' },
      { id: 'card-elasticity', study: 'elasticity' },
      { id: 'card-saturation', study: 'saturation' },
      { id: 'card-frontier', study: 'frontier' },
      { id: 'card-reprompt', study: 'reprompt' }
    ];

    cards.forEach(c => {
      $(`#${c.id}`)?.addEventListener('click', () => {
        navigateToStudy(c.study);
      });
    });

    $('#res-back-btn')?.addEventListener('click', () => {
      navigateToStudy(null);
    });

    $('#res-backfill-btn')?.addEventListener('click', async () => {
      const btn = $('#res-backfill-btn');
      btn.disabled = true;
      btn.innerHTML = '<span class="spinning" style="margin-right: 6px;">🔄</span> Backfilling...';
      try {
        const res = await fetch('/api/admin/migrate', { method: 'POST' });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Backfill failed');
        if (window.showToast) {
          window.showToast(data.message || 'Backfill successful', { type: 'success' });
        } else {
          alert('Backfill successful: ' + data.message);
        }
        await loadLandingPreviews();
      } catch (err) {
        console.error(err);
        if (window.showToast) {
          window.showToast(err.message, { type: 'error' });
        } else {
          alert('Error: ' + err.message);
        }
      } finally {
        btn.disabled = false;
        btn.innerHTML = '🔄 Backfill History';
      }
    });
  }

  function navigateToStudy(study) {
    activeStudy = study;
    if (study) {
      $('#research-landing-view').hidden = true;
      $('#res-back-btn').style.display = 'inline-block';
      
      // Hide all detail blocks
      ['specificity', 'elasticity', 'saturation', 'frontier', 'reprompt'].forEach(s => {
        const el = $(`#detail-${s}`);
        if (el) el.hidden = true;
      });

      // Show requested detail block
      $(`#detail-${study}`).hidden = false;

      if (study === 'reprompt') {
        const currentOrg = $('#res-org-select')?.value;
        if (!currentOrg) {
          fetch(`/api/admin/research/redundant-reprompt?range=30d&org=`)
            .then(res => res.json())
            .then(data => {
              if (data.pilotOnly && data.eligibleOrg && !data.eligibleOrg.startsWith('None')) {
                const orgSelect = $('#res-org-select');
                if (orgSelect) {
                  orgSelect.value = data.eligibleOrg;
                  loadStudyDetail('reprompt');
                }
              } else {
                loadStudyDetail(study);
              }
            })
            .catch(e => {
              console.error(e);
              loadStudyDetail(study);
            });
          return;
        }
      }

      loadStudyDetail(study);
    } else {
      $('#research-landing-view').hidden = false;
      $('#res-back-btn').style.display = 'none';
      ['specificity', 'elasticity', 'saturation', 'frontier', 'reprompt'].forEach(s => {
        const el = $(`#detail-${s}`);
        if (el) el.hidden = true;
      });
      loadLandingPreviews();
    }
  }

  function setupToggles() {
    // Specificity metric toggle
    $('#spec-toggle-buttons')?.querySelectorAll('button').forEach(btn => {
      btn.addEventListener('click', (e) => {
        $('#spec-toggle-buttons').querySelectorAll('button').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        STUDY_METRICS.specificity = btn.dataset.metric;
        if (activeStudy === 'specificity') loadStudyDetail('specificity');
      });
    });

    // Cost frontier intent toggle
    $('#frontier-intent-toggles')?.querySelectorAll('button').forEach(btn => {
      btn.addEventListener('click', (e) => {
        $('#frontier-intent-toggles').querySelectorAll('button').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        STUDY_METRICS.frontier = btn.dataset.intent;
        if (activeStudy === 'frontier') loadStudyDetail('frontier');
      });
    });
  }

  // Get current shared filter params
  function getFilterQuery() {
    const range = $('#res-range-select')?.value || '30d';
    const org = $('#res-org-select')?.value || '';
    const tool = $('#res-tool-select')?.value || '';
    const model = $('#res-model-select')?.value || '';
    return `range=${range}&org=${org}&tool=${tool}&model=${model}`;
  }

  // LANDING PAGE PREVIEWS LOAD
  async function loadLandingPreviews() {
    const queryStr = getFilterQuery();

    // Specificity preview
    try {
      const res = await fetch(`/api/admin/research/prompt-specificity?${queryStr}`);
      if (res.ok) {
        const data = await res.json();
        const totalSample = data.reduce((sum, r) => sum + r.sampleSize, 0);
        $('#badge-specificity-sample').textContent = `${totalSample.toLocaleString()} sessions`;
      }
    } catch (e) { console.error(e); }

    // Elasticity preview
    try {
      const res = await fetch(`/api/admin/research/verbosity-elasticity?${queryStr}`);
      if (res.ok) {
        const data = await res.json();
        const totalSample = (data.stats || []).reduce((sum, r) => sum + r.sampleSize, 0);
        $('#badge-elasticity-sample').textContent = `${totalSample.toLocaleString()} turns`;
      }
    } catch (e) { console.error(e); }

    // Saturation preview
    try {
      const res = await fetch(`/api/admin/research/context-saturation?${queryStr}`);
      if (res.ok) {
        const data = await res.json();
        const totalSample = (data.rows || []).reduce((sum, r) => sum + r.sampleSize, 0);
        $('#badge-saturation-sample').textContent = `${totalSample.toLocaleString()} turns`;
      }
    } catch (e) { console.error(e); }

    // Frontier preview
    try {
      const res = await fetch(`/api/admin/research/cost-performance-frontier?${queryStr}`);
      if (res.ok) {
        const data = await res.json();
        let totalSample = 0;
        if (data.points) {
          totalSample = data.points.reduce((sum, r) => sum + r.sessionCount, 0);
        } else {
          for (const cat in data) {
            totalSample += data[cat].reduce((sum, r) => sum + r.sessionCount, 0);
          }
        }
        $('#badge-frontier-sample').textContent = `${totalSample.toLocaleString()} sessions`;
      }
    } catch (e) { console.error(e); }

    // Reprompt preview
    try {
      const res = await fetch(`/api/admin/research/redundant-reprompt?${queryStr}`);
      if (res.ok) {
        const data = await res.json();
        if (data.pilotOnly) {
          $('#badge-reprompt-sample').textContent = 'Pilot Lock';
        } else {
          const events = data.events || [];
          $('#badge-reprompt-sample').textContent = `${events.length.toLocaleString()} reprompts`;
        }
      }
    } catch (e) { console.error(e); }
  }

  // STUDY DETAIL LOADER
  async function loadStudyDetail(study) {
    const queryStr = getFilterQuery();

    if (study === 'specificity') {
      const res = await fetch(`/api/admin/research/prompt-specificity?${queryStr}`);
      if (res.ok) {
        const data = await res.json();
        renderSpecificityStudy(data);
      }
    } else if (study === 'elasticity') {
      const res = await fetch(`/api/admin/research/verbosity-elasticity?${queryStr}`);
      if (res.ok) {
        const data = await res.json();
        renderElasticityStudy(data);
      }
    } else if (study === 'saturation') {
      const res = await fetch(`/api/admin/research/context-saturation?${queryStr}`);
      if (res.ok) {
        const data = await res.json();
        renderSaturationStudy(data);
      }
    } else if (study === 'frontier') {
      const res = await fetch(`/api/admin/research/cost-performance-frontier?${queryStr}`);
      if (res.ok) {
        const data = await res.json();
        renderFrontierStudy(data);
      }
    } else if (study === 'reprompt') {
      const res = await fetch(`/api/admin/research/redundant-reprompt?${queryStr}`);
      if (res.ok) {
        const data = await res.json();
        renderRepromptStudy(data);
      }
    }
  }

  // ── Study 1 Rendering: Prompt Specificity ─────────────────────────────────
  function renderSpecificityStudy(data) {
    const tbody = $('#specificity-tbody');
    if (!tbody) return;

    if (!data.length) {
      tbody.innerHTML = '<tr><td colspan="6" class="admin-empty">No specificity outcomes recorded</td></tr>';
      return;
    }

    tbody.innerHTML = data.map(r => `
      <tr>
        <td><strong style="text-transform: capitalize;">${esc(r.tier)}</strong></td>
        <td>${esc(r.complexityBucket)}</td>
        <td>${Number(r.sampleSize).toLocaleString()}</td>
        <td>${formatTokens(Math.round(r.avgTokensPerLine))} tkn/line</td>
        <td>${(r.reworkRate * 100).toFixed(1)}%</td>
        <td>${(r.revertRate * 100).toFixed(1)}%</td>
      </tr>
    `).join('');

    // Draw Grouped Bar Chart
    const svg = $('#specificity-chart');
    if (!svg) return;

    const W = 600, H = 220;
    const padL = 45, padR = 12, padT = 16, padB = 24;
    const chartW = W - padL - padR;
    const chartH = H - padT - padB;

    const metric = STUDY_METRICS.specificity;

    function getVal(row) {
      if (metric === 'rework') return row.reworkRate;
      if (metric === 'revert') return row.revertRate;
      return row.avgTokensPerLine;
    }

    const maxVal = Math.max(...data.map(getVal), 0) * 1.1 || 1;

    // Groups: vague, partial, specific
    const groups = ['vague', 'partial', 'specific'];
    const complexities = ['Low Complexity', 'Medium Complexity', 'High Complexity'];
    const compColors = ['#60a5fa', '#a78bfa', '#fbbf24'];

    const gw = chartW / 3;
    const bw = (gw * 0.7) / 3;

    let html = '';
    // Y-Axis Grid Lines
    for (let i = 0; i <= 4; i++) {
      const y = padT + (i / 4) * chartH;
      const val = maxVal * (1 - i / 4);
      const label = metric === 'tokens' ? formatTokens(Math.round(val)) : (val * 100).toFixed(0) + '%';
      html += `<line x1="${padL}" y1="${y}" x2="${W - padR}" y2="${y}" stroke="rgba(255,255,255,0.04)" stroke-width="1"/>`;
      html += `<text x="${padL - 6}" y="${y + 3}" text-anchor="end" font-size="8" fill="rgba(255,255,255,0.3)" font-family="var(--font-mono)">${label}</text>`;
    }

    groups.forEach((group, gi) => {
      const gx = padL + gi * gw + (gw * 0.15);
      
      complexities.forEach((comp, ci) => {
        const row = data.find(r => r.tier === group && r.complexityBucket === comp);
        const val = row ? getVal(row) : 0;
        const bh = (val / maxVal) * chartH;
        const bx = gx + ci * bw;
        const by = padT + chartH - bh;

        html += `
          <g class="bar-group" title="${group} - ${comp}: ${val}">
            <rect x="${bx}" y="${by}" width="${bw - 2}" height="${bh}" fill="${compColors[ci]}" rx="1" fill-opacity="0.85"/>
          </g>
        `;
      });

      // Group label
      html += `<text x="${padL + gi * gw + gw / 2}" y="${H - 6}" text-anchor="middle" font-size="9" fill="rgba(255,255,255,0.5)" style="text-transform: capitalize; font-weight: 600;">${group}</text>`;
    });

    // Render legend
    html += `
      <g transform="translate(${padL}, 8)">
        ${complexities.map((comp, i) => `
          <g transform="translate(${i * 120}, 0)">
            <rect x="0" y="-7" width="8" height="8" rx="2" fill="${compColors[i]}"/>
            <text x="12" y="0" font-size="8" fill="rgba(255,255,255,0.4)">${comp}</text>
          </g>
        `).join('')}
      </g>
    `;

    svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
    svg.innerHTML = html;
  }

  // ── Study 2 Rendering: Verbosity Elasticity ──────────────────────────────
  function renderElasticityStudy(data) {
    const tbody = $('#elasticity-tbody');
    if (!tbody) return;

    const stats = data.stats || [];
    const points = data.points || [];

    if (!stats.length) {
      tbody.innerHTML = '<tr><td colspan="6" class="admin-empty">No verbosity elasticity samples recorded</td></tr>';
      return;
    }

    tbody.innerHTML = stats.map(s => `
      <tr>
        <td><code style="font-family: var(--font-mono);">${esc(s.model)}</code></td>
        <td style="text-transform: capitalize;">${esc(s.intentCategory)}</td>
        <td>${Number(s.sampleSize).toLocaleString()}</td>
        <td><strong>${Number(s.slope).toFixed(4)}</strong></td>
        <td>${Number(s.intercept).toFixed(1)}</td>
        <td><strong style="color: var(--brand);">${(s.r2 * 100).toFixed(1)}%</strong></td>
      </tr>
    `).join('');

    // Draw Scatter Plot with overlaid regression lines
    const svg = $('#elasticity-chart');
    const tooltip = $('#elasticity-tooltip');
    if (!svg) return;

    const W = 600, H = 260;
    const padL = 45, padR = 12, padT = 16, padB = 28;
    const chartW = W - padL - padR;
    const chartH = H - padT - padB;

    const maxX = Math.max(...points.map(p => p.x), 1000) * 1.05;
    const maxY = Math.max(...points.map(p => p.y), 500) * 1.05;

    function px(x) { return padL + (x / maxX) * chartW; }
    function py(y) { return padT + chartH - (y / maxY) * chartH; }

    let html = '<g class="grid">';
    // X and Y gridlines
    for (let i = 0; i <= 3; i++) {
      const y = padT + (i / 3) * chartH;
      const valY = maxY * (1 - i / 3);
      html += `<line x1="${padL}" y1="${y}" x2="${W - padR}" y2="${y}" stroke="rgba(255,255,255,0.03)" stroke-width="1"/>`;
      html += `<text x="${padL - 6}" y="${y + 3}" text-anchor="end" font-size="8" fill="rgba(255,255,255,0.3)" font-family="var(--font-mono)">${formatTokens(Math.round(valY))}</text>`;

      const x = padL + (i / 3) * chartW;
      const valX = maxX * (i / 3);
      html += `<line x1="${x}" y1="${padT}" x2="${x}" y2="${H - padB}" stroke="rgba(255,255,255,0.03)" stroke-width="1"/>`;
      html += `<text x="${x}" y="${H - 6}" text-anchor="middle" font-size="8" fill="rgba(255,255,255,0.3)" font-family="var(--font-mono)">${formatTokens(Math.round(valX))}</text>`;
    }
    html += '</g>';

    // Plot scatter points
    points.forEach((pt, idx) => {
      const cx = px(pt.x);
      const cy = py(pt.y);
      const col = getModelColor(pt.model);
      html += `<circle cx="${cx}" cy="${cy}" r="2" fill="${col}" fill-opacity="0.5" class="scatter-dot" data-idx="${idx}"/>`;
    });

    // Plot regression lines for each series
    stats.forEach(s => {
      const col = getModelColor(s.model);
      // We draw from x=0 to x=maxX
      const y0 = s.intercept;
      const yMax = s.slope * maxX + s.intercept;

      const x1 = px(0);
      const y1 = py(y0);
      const x2 = px(maxX);
      const y2 = py(yMax);

      html += `
        <line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${col}" stroke-width="1.8" stroke-dasharray="4,4" />
      `;
    });

    svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
    svg.innerHTML = html;

    // Render interactive legend
    const models = [...new Set(stats.map(s => s.model))];
    const legend = $('#elasticity-legend');
    if (legend) {
      legend.innerHTML = models.map(m => `
        <span style="display:inline-flex;align-items:center;margin-right:12px;">
          <span class="cli-dot" style="background:${getModelColor(m)}"></span>${esc(m)}
        </span>`
      ).join('');
    }

    // Connect tooltip hover events to scatter points
    svg.onmousemove = (e) => {
      const target = e.target;
      if (target.classList.contains('scatter-dot')) {
        const idx = Number(target.dataset.idx);
        const pt = points[idx];
        const rect = svg.getBoundingClientRect();
        
        if (tooltip && pt) {
          tooltip.hidden = false;
          tooltip.style.left = `${((px(pt.x) / W) * rect.width) + 10}px`;
          tooltip.style.top = `${((py(pt.y) / H) * rect.height) - 30}px`;
          tooltip.innerHTML = `
            <div class="tooltip-label" style="font-family: var(--font-mono);">${esc(pt.model)}</div>
            <div class="tooltip-row">Input: <span class="tooltip-val">${formatTokens(pt.x)}</span></div>
            <div class="tooltip-row">Output: <span class="tooltip-val">${formatTokens(pt.y)}</span></div>
            <div class="tooltip-row">Files Touched: <span class="tooltip-val">${pt.filesTouched}</span></div>
          `;
        }
      }
    };
    svg.onmouseleave = () => {
      if (tooltip) tooltip.hidden = true;
    };
  }

  // ── Study 3 Rendering: Context Saturation ────────────────────────────────
  function renderSaturationStudy(data) {
    const tbody = $('#saturation-tbody');
    if (!tbody) return;

    const rows = data.rows || [];
    const inflections = data.inflectionPoints || {};

    if (!rows.length) {
      tbody.innerHTML = '<tr><td colspan="5" class="admin-empty">No saturation turn metrics recorded</td></tr>';
      return;
    }

    tbody.innerHTML = rows.map(r => `
      <tr>
        <td>${r.fillBucket * 10}-${(r.fillBucket + 1) * 10}%</td>
        <td><code style="font-family: var(--font-mono);">${esc(r.model)}</code></td>
        <td><span style="color: ${r.toolErrorRate > 0.05 ? '#f87171' : 'inherit'};">${(r.toolErrorRate * 100).toFixed(1)}%</span></td>
        <td>${(r.validToolCallRate * 100).toFixed(1)}%</td>
        <td>${Number(r.sampleSize).toLocaleString()}</td>
      </tr>
    `).join('');

    // Draw Multi-series Saturation Line Chart
    const svg = $('#saturation-chart');
    const tooltip = $('#saturation-saturation-tooltip'); // or use general tooltip
    if (!svg) return;

    const W = 600, H = 240;
    const padL = 42, padR = 12, padT = 16, padB = 24;
    const chartW = W - padL - padR;
    const chartH = H - padT - padB;

    const maxVal = 1.05; // Rates go from 0 to 100%

    function px(bucket) { return padL + (bucket / 9) * chartW; }
    function py(v) { return padT + chartH - (v / maxVal) * chartH; }

    let html = '<g class="grid">';
    // Gridlines
    for (let i = 0; i <= 4; i++) {
      const y = padT + (i / 4) * chartH;
      const v = 1 - (i / 4);
      html += `<line x1="${padL}" y1="${y}" x2="${W - padR}" y2="${y}" stroke="rgba(255,255,255,0.03)" stroke-width="1"/>`;
      html += `<text x="${padL - 6}" y="${y + 3}" text-anchor="end" font-size="8" fill="rgba(255,255,255,0.3)">${(v*100).toFixed(0)}%</text>`;
    }
    // X-axis buckets
    for (let i = 0; i < 10; i++) {
      const x = px(i);
      html += `<line x1="${x}" y1="${padT}" x2="${x}" y2="${H - padB}" stroke="rgba(255,255,255,0.02)" stroke-width="1"/>`;
      html += `<text x="${x}" y="${H - 6}" text-anchor="middle" font-size="8" fill="rgba(255,255,255,0.3)">${i*10}%</text>`;
    }
    html += '</g>';

    // Render lines for each model
    const models = [...new Set(rows.map(r => r.model))];

    models.forEach(model => {
      const modelRows = rows.filter(r => r.model === model).sort((a, b) => a.fillBucket - b.fillBucket);
      if (!modelRows.length) return;

      const col = getModelColor(model);
      const points = modelRows.map(r => `${px(r.fillBucket)},${py(r.toolErrorRate)}`).join(' ');

      html += `<polyline points="${points}" fill="none" stroke="${col}" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" />`;
      
      // Highlight inflection point if detected
      const infBucket = inflections[model];
      if (infBucket != null) {
        const infX = px(infBucket);
        html += `
          <line x1="${infX}" y1="${padT}" x2="${infX}" y2="${H - padB}" stroke="#ef4444" stroke-width="1" stroke-dasharray="2,2"/>
          <circle cx="${infX}" cy="${py(modelRows.find(r => r.fillBucket === infBucket)?.toolErrorRate || 0)}" r="4.5" fill="#ef4444" stroke="var(--surface)" stroke-width="1.5" />
          <text x="${infX + 4}" y="${padT + 12}" fill="#ef4444" font-size="7" font-weight="600">${model} Inflection: ${infBucket * 10}%</text>
        `;
      }
    });

    svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
    svg.innerHTML = html;
  }

  // ── Study 4 Rendering: Cost-Performance Frontier ──────────────────────────
  function renderFrontierStudy(data) {
    const tbody = $('#frontier-tbody');
    if (!tbody) return;

    const activeIntent = STUDY_METRICS.frontier;
    let points = [];

    if (data.points) {
      points = data.points;
    } else {
      points = data[activeIntent] || [];
    }

    if (!points.length) {
      tbody.innerHTML = '<tr><td colspan="5" class="admin-empty">No sessions recorded on cost frontier</td></tr>';
      return;
    }

    tbody.innerHTML = points.map(p => `
      <tr>
        <td><code style="font-family: var(--font-mono);">${esc(p.model)}</code></td>
        <td><strong>${formatCost(p.avgCost)}</strong></td>
        <td>${(p.successRate * 100).toFixed(1)}%</td>
        <td>${Number(p.sessionCount).toLocaleString()}</td>
        <td>
          <span class="daemon-row-badge ${p.isPareto ? 'badge-healthy' : 'badge-never'}">
            ${p.isPareto ? 'Pareto Optimal' : 'Dominated'}
          </span>
        </td>
      </tr>
    `).join('');

    // Draw Pareto Scatter Plot
    const svg = $('#frontier-chart');
    const tooltip = $('#frontier-tooltip');
    if (!svg) return;

    const W = 600, H = 250;
    const padL = 42, padR = 12, padT = 16, padB = 28;
    const chartW = W - padL - padR;
    const chartH = H - padT - padB;

    const maxCost = Math.max(...points.map(p => p.avgCost), 0.1) * 1.1;
    const maxSuccess = 1.05;

    function px(c) { return padL + (c / maxCost) * chartW; }
    function py(s) { return padT + chartH - (s / maxSuccess) * chartH; }

    let html = '<g class="grid">';
    // Gridlines
    for (let i = 0; i <= 4; i++) {
      const y = padT + (i / 4) * chartH;
      const v = 1 - (i / 4);
      html += `<line x1="${padL}" y1="${y}" x2="${W - padR}" y2="${y}" stroke="rgba(255,255,255,0.03)" stroke-width="1"/>`;
      html += `<text x="${padL - 6}" y="${y + 3}" text-anchor="end" font-size="8" fill="rgba(255,255,255,0.3)">${(v*100).toFixed(0)}%</text>`;

      const x = padL + (i / 4) * chartW;
      const valX = maxCost * (i / 4);
      html += `<line x1="${x}" y1="${padT}" x2="${x}" y2="${H - padB}" stroke="rgba(255,255,255,0.03)" stroke-width="1"/>`;
      html += `<text x="${x}" y="${H - 6}" text-anchor="middle" font-size="8" fill="rgba(255,255,255,0.3)" font-family="var(--font-mono)">${formatCost(valX).replace('$','')}</text>`;
    }
    html += '</g>';

    // Connect Pareto points with a frontier curve line (sorted by cost)
    const paretoPoints = points.filter(p => p.isPareto).sort((a, b) => a.avgCost - b.avgCost);
    if (paretoPoints.length >= 2) {
      const linePts = paretoPoints.map(p => `${px(p.avgCost)},${py(p.successRate)}`).join(' ');
      html += `<polyline points="${linePts}" fill="none" stroke="var(--brand)" stroke-width="1.8" stroke-dasharray="3,3" />`;
    }

    // Render scatter dots
    points.forEach((p, idx) => {
      const cx = px(p.avgCost);
      const cy = py(p.successRate);
      const col = getModelColor(p.model);

      if (p.isPareto) {
        html += `
          <g class="frontier-point" data-idx="${idx}">
            <circle cx="${cx}" cy="${cy}" r="6" fill="${col}" stroke="var(--brand)" stroke-width="1.5" class="frontier-dot" data-idx="${idx}"/>
            <circle cx="${cx}" cy="${cy}" r="10" fill="${col}" fill-opacity="0.15"/>
          </g>
        `;
      } else {
        html += `<circle cx="${cx}" cy="${cy}" r="4" fill="none" stroke="${col}" stroke-width="1.8" stroke-opacity="0.6" class="frontier-dot" data-idx="${idx}"/>`;
      }
    });

    svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
    svg.innerHTML = html;

    // Hook tooltip events
    svg.onmousemove = (e) => {
      const target = e.target;
      if (target.classList.contains('frontier-dot')) {
        const idx = Number(target.dataset.idx);
        const p = points[idx];
        const rect = svg.getBoundingClientRect();
        
        if (tooltip && p) {
          tooltip.hidden = false;
          tooltip.style.left = `${((px(p.avgCost) / W) * rect.width) + 10}px`;
          tooltip.style.top = `${((py(p.successRate) / H) * rect.height) - 30}px`;
          tooltip.innerHTML = `
            <div class="tooltip-label" style="font-family: var(--font-mono);">${esc(p.model)}</div>
            <div class="tooltip-row">Avg Cost: <span class="tooltip-val">${formatCost(p.avgCost)}</span></div>
            <div class="tooltip-row">Success Rate: <span class="tooltip-val">${(p.successRate*100).toFixed(1)}%</span></div>
            <div class="tooltip-row">Sessions: <span class="tooltip-val">${p.sessionCount}</span></div>
          `;
        }
      }
    };
    svg.onmouseleave = () => {
      if (tooltip) tooltip.hidden = true;
    };
  }

  // ── Study 5 Rendering: Redundant Reprompt ─────────────────────────────────
  function renderRepromptStudy(data) {
    const tbody = $('#reprompt-tbody');
    if (!tbody) return;

    if (data.pilotOnly) {
      $('#reprompt-pilot-status-alert').hidden = false;
      $('#reprompt-cost-wasted').textContent = 'Pilot Gated';
      $('#reprompt-event-count').textContent = '—';
      tbody.innerHTML = '<tr><td colspan="6" class="admin-empty">Reprompt study only accessible for pilot organization.</td></tr>';
      return;
    }

    $('#reprompt-pilot-status-alert').hidden = true;

    const events = data.events || [];
    const totalWasted = events.reduce((sum, r) => sum + (Number(r.costWasted) || 0), 0);

    $('#reprompt-cost-wasted').textContent = formatCost(totalWasted);
    $('#reprompt-event-count').textContent = String(events.length);

    if (!events.length) {
      tbody.innerHTML = '<tr><td colspan="6" class="admin-empty">No redundant reprompt events flagged for this org in selected period</td></tr>';
      return;
    }

    tbody.innerHTML = events.map(e => `
      <tr>
        <td><code>${esc(e.sessionId.slice(0,8))}...</code></td>
        <td><strong style="color: var(--brand);">${esc(e.userName)}</strong></td>
        <td><span class="badge-pill" style="font-size: 11px; padding: 2px 8px; background: rgba(255,255,255,0.05);">${esc(e.projectName)}</span></td>
        <td>Turn #${e.turnIndex}</td>
        <td><strong style="color: #ef4444;">${(e.similarityScore * 100).toFixed(1)}%</strong> similarity</td>
        <td>${formatTokens(e.tokensCost)}</td>
        <td><strong style="color: #ef4444;">${formatCost(e.costWasted)}</strong></td>
        <td>${new Date(e.createdAt).toLocaleDateString()}</td>
      </tr>
    `).join('');
  }

  // Self-initialization
  init();

  window.addEventListener('research-tab-activated', () => {
    if (activeStudy) {
      loadStudyDetail(activeStudy);
    } else {
      loadLandingPreviews();
    }
  });
})();
