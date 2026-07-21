/**
 * Team admin dashboard page (/team).
 * Features custom filters (Member, Token Usage Range, AI Agent Source),
 * Model Pricing Rates Management ($/1M tokens), API cost recalculation,
 * vertical sidebar, and deep analytics.
 */
import type { Metadata } from 'next';
import Script from 'next/script';

export const metadata: Metadata = {
  title: 'Team Analytics — Visualisation Dashboard',
  description: 'Comprehensive team agent analytics — member token logs, custom model pricing, API cost recalculation, and scorecards.',
};

export default function TeamDashboardPage() {
  return (
    <div suppressHydrationWarning>
      <div id="login-screen" className="team-login">
        <form id="login-form">
          <h1>Team analytics</h1>
          <p className="muted">Admin login — personal dashboard is at <code>/</code></p>
          <label>
            Password
            <input id="login-password" type="password" autoComplete="current-password" required />
          </label>
          <button type="submit" className="hbtn primary" id="login-submit">Sign in</button>
          <p id="login-error" className="error" hidden></p>
        </form>
      </div>

      <div id="app" hidden className="team-app-layout">
        {/* Left Vertical Sidebar */}
        <aside className="team-sidebar">
          <div className="sidebar-brand">
            <div className="wordmark">
              <h1>team</h1>
              <span className="eyebrow">Analytics</span>
            </div>
          </div>

          <div className="sidebar-team-select">
            <label className="muted">Current Team</label>
            <select id="team-select" aria-label="Team"></select>
          </div>

          <nav className="team-sidebar-nav" id="team-tabs" role="tablist">
            <button type="button" className="tab-btn active" data-tab="tab-overview">
              <span className="nav-icon">📊</span> Overview & Stats
            </button>
            <button type="button" className="tab-btn" data-tab="tab-token-leaderboard">
              <span className="nav-icon">🏆</span> Token Leaderboard
            </button>
            <button type="button" className="tab-btn" data-tab="tab-head-to-head">
              <span className="nav-icon">⚔️</span> Head-to-Head
            </button>
            <button type="button" className="tab-btn" data-tab="tab-members">
              <span className="nav-icon">👥</span> Member Token Logs
            </button>
            <button type="button" className="tab-btn" data-tab="tab-projects">
              <span className="nav-icon">📁</span> Projects & Repos
            </button>
            <button type="button" className="tab-btn" data-tab="tab-files">
              <span className="nav-icon">📄</span> Code Impact Map
            </button>
            <button type="button" className="tab-btn" data-tab="tab-logs">
              <span className="nav-icon">📜</span> Session Logs
            </button>
            <button type="button" className="tab-btn" data-tab="tab-pricing">
              <span className="nav-icon">💲</span> Model Pricing Rates
            </button>
            <button type="button" className="tab-btn" data-tab="tab-settings">
              <span className="nav-icon">⚙️</span> Manage Members
            </button>
          </nav>

          <div className="sidebar-footer">
            <a href="/" className="sidebar-link">← Personal Dashboard</a>
          </div>
        </aside>

        {/* Main Content Area */}
        <div className="team-main-wrapper">
          {/* Header Controls & Filters */}
          <header className="team-header">
            <div className="header-filters-row">
              {/* Date Presets */}
              <div id="range-presets" className="range-presets" role="tablist"></div>
              <label className="filter-label">From <input id="range-from" type="date" /></label>
              <label className="filter-label">To <input id="range-to" type="date" /></label>

              {/* Member Filter */}
              <label className="filter-label">Member
                <select id="global-member-filter">
                  <option value="all">All Members</option>
                </select>
              </label>

              {/* Source Filter */}
              <label className="filter-label">AI Tool
                <select id="global-source-filter">
                  <option value="all">All Tools</option>
                  <option value="cursor">Cursor</option>
                  <option value="claude-code">Claude Code</option>
                  <option value="codex">Codex</option>
                </select>
              </label>

              {/* Token Usage Range Filter */}
              <label className="filter-label">Min Tokens
                <select id="global-min-tokens-filter">
                  <option value="0">All Usage (0+)</option>
                  <option value="10000">&gt; 10k Tokens</option>
                  <option value="100000">&gt; 100k Tokens</option>
                  <option value="1000000">&gt; 1M Tokens</option>
                  <option value="10000000">&gt; 10M Tokens</option>
                </select>
              </label>

              <button id="refresh" className="hbtn primary" title="Refresh stats">↻ Apply Filters</button>
            </div>
          </header>

          <main className="team-main">
            <div id="app-error" className="app-error" hidden></div>
            <div id="app-loading" className="app-loading" hidden>Loading team analytics…</div>
            <div id="app-content">

              {/* TAB 1: OVERVIEW & KEY STATS */}
              <section id="tab-overview" className="tab-content active">
                <div className="cards" id="totals"></div>

                <div className="grid-2">
                  <section className="panel">
                    <h2>Member Token & Cost Summary</h2>
                    <div id="leaderboard" className="table-wrap"></div>
                  </section>
                  <section className="panel">
                    <h2>AI Tools & Accounts Distribution</h2>
                    <div id="by-source"></div>
                  </section>
                </div>

                <div className="grid-2">
                  <section className="panel">
                    <h2>Daily Token Flow</h2>
                    <div id="by-day"></div>
                  </section>
                  <section className="panel">
                    <h2>Top Tools Called</h2>
                    <div id="top-tools"></div>
                  </section>
                </div>
              </section>

              {/* TAB 2: TOKEN LEADERBOARD */}
              <section id="tab-token-leaderboard" className="tab-content" hidden>
                <div className="panel">
                  <div className="panel-head">
                    <h2>🏆 Token Consumption Leaderboard</h2>
                    <span className="muted">Ranked by total tokens exchanged (Input + Output + Cache)</span>
                  </div>
                  <div id="token-leaderboard-table" className="table-wrap"></div>
                </div>
              </section>

              {/* TAB 3: HEAD-TO-HEAD SCOREBOARD */}
              <section id="tab-head-to-head" className="tab-content" hidden>
                <div className="panel">
                  <div className="panel-head">
                    <h2>⚔️ Member Head-to-Head Scoreboard</h2>
                    <span className="muted">Normalized efficiency metrics across team members</span>
                  </div>
                  <div id="head-to-head-table" className="table-wrap"></div>
                </div>
              </section>

              {/* TAB 4: MEMBER DEEP DIVE & FILES */}
              <section id="tab-members" className="tab-content" hidden>
                <div className="panel-head">
                  <h2>Per-Member Token & Activity Drilldown</h2>
                  <div className="filter-group" style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                    <button type="button" id="collapse-all-members" className="hbtn" style={{ fontSize: '11px', padding: '4px 10px' }}>
                      ▶ Collapse All
                    </button>
                    <button type="button" id="expand-all-members" className="hbtn" style={{ fontSize: '11px', padding: '4px 10px' }}>
                      ▼ Expand All
                    </button>
                    <label style={{ marginLeft: '6px' }}>Member Filter: </label>
                    <select id="member-filter-select"></select>
                  </div>
                </div>
                <div id="member-drilldown-cards"></div>
              </section>

              {/* TAB 5: PROJECTS & WORKSPACES */}
              <section id="tab-projects" className="tab-content" hidden>
                <div className="panel">
                  <div className="panel-head">
                    <h2>Projects & Workspace Intelligence</h2>
                    <span className="muted">Which Cursor accounts & team members worked on which repositories</span>
                  </div>
                  <div id="projects-table" className="table-wrap"></div>
                </div>
              </section>

              {/* TAB 6: FILE IMPACT RISK MAP */}
              <section id="tab-files" className="tab-content" hidden>
                <div className="panel">
                  <div className="panel-head">
                    <h2>Code Impact & File Risk Map</h2>
                    <span className="muted">Most-modified codebase paths, line diffs (+ / −), and contributor counts</span>
                  </div>
                  <div id="top-files" className="table-wrap"></div>
                </div>
              </section>

              {/* TAB 7: SESSION ACTIVITY LOGS */}
              <section id="tab-logs" className="tab-content" hidden>
                <div className="panel">
                  <div className="panel-head">
                    <h2>Recent Token & Ingest Activity Logs</h2>
                    <span className="muted">Detailed log of recent agent sessions across the team</span>
                  </div>
                  <div id="session-logs-table" className="table-wrap"></div>
                </div>
              </section>

              {/* TAB 8: MODEL PRICING RATES */}
              <section id="tab-pricing" className="tab-content" hidden>
                <div className="panel">
                  <div className="panel-head">
                    <h2>💲 Custom Model Pricing & Cost Configuration</h2>
                    <div style={{ display: 'flex', gap: '10px' }}>
                      <button id="recalculate-costs-btn" className="hbtn" style={{ borderColor: 'var(--brand)', color: 'var(--brand-hi)', fontWeight: 600 }}>
                        ⚡ Recalculate All Session Costs
                      </button>
                      <button id="add-pricing-btn" className="hbtn primary">+ Add Model Pricing Rule</button>
                    </div>
                  </div>
                  <p className="muted" style={{ marginBottom: '16px' }}>
                    Configure custom LLM pricing rules ($ per Million Tokens). Click <strong>Recalculate All Session Costs</strong> to update total costs across all member sessions!
                  </p>
                  <div id="model-pricing-table" className="table-wrap"></div>

                  <div style={{ marginTop: '24px', paddingTop: '20px', borderTop: '1px solid var(--grid)' }}>
                    <div className="panel-head" style={{ marginBottom: '12px' }}>
                      <h2>🤖 Member Model Usage & Spend Breakdown</h2>
                      <span className="muted">Breakdown of LLM models used by each team member</span>
                    </div>
                    <div id="member-models-table" className="table-wrap"></div>
                  </div>
                </div>
              </section>

              {/* TAB 9: SETTINGS & MEMBER KEYS */}
              <section id="tab-settings" className="tab-content" hidden>
                <section className="panel">
                  <div className="panel-head">
                    <h2>Team Members & API Ingest Keys</h2>
                    <div style={{ display: 'flex', gap: '10px' }}>
                      <button id="trigger-sync-all-btn" className="hbtn" style={{ borderColor: 'var(--brand)', color: 'var(--brand-hi)', fontWeight: 600 }}>
                        ⚡ Trigger Sync for All Members
                      </button>
                      <button id="add-member-btn" className="hbtn primary">+ Add member</button>
                    </div>
                  </div>
                  <div id="members" className="table-wrap"></div>
                  <p id="new-key" className="key-banner" hidden></p>
                </section>
              </section>

            </div>
          </main>
        </div>
      </div>

      {/* Add Member Dialog */}
      <dialog id="add-member-dialog">
        <form method="dialog" id="add-member-form">
          <h3>Add team member</h3>
          <label>Display name<input id="member-name" required placeholder="e.g. Alex Smith" /></label>
          <label>Role
            <select id="member-role">
              <option value="member">Member</option>
              <option value="admin">Admin</option>
            </select>
          </label>
          <menu>
            <button type="button" id="cancel-member" className="hbtn">Cancel</button>
            <button type="submit" className="hbtn primary">Create + API key</button>
          </menu>
        </form>
      </dialog>

      {/* Edit Member Dialog */}
      <dialog id="edit-member-dialog">
        <form method="dialog" id="edit-member-form">
          <h3>Edit team member</h3>
          <input type="hidden" id="edit-member-id" />
          <label>Display name<input id="edit-member-name" required /></label>
          <label>Role
            <select id="edit-member-role">
              <option value="member">Member</option>
              <option value="admin">Admin</option>
            </select>
          </label>
          <menu>
            <button type="button" id="cancel-edit-member" className="hbtn">Cancel</button>
            <button type="submit" className="hbtn primary">Save Changes</button>
          </menu>
        </form>
      </dialog>

      {/* Add Model Pricing Dialog */}
      <dialog id="add-pricing-dialog">
        <form method="dialog" id="add-pricing-form">
          <h3>Add / Update Model Pricing Rule</h3>
          <label>Model Pattern / Name
            <input id="pricing-model-pattern" required placeholder="e.g. claude-3-5-sonnet or deepseek-r1" />
          </label>
          <label>Input Tokens Cost ($ per 1 Million tokens)
            <input id="pricing-cost-in" type="number" step="0.01" min="0" required placeholder="e.g. 3.00" />
          </label>
          <label>Output Tokens Cost ($ per 1 Million tokens)
            <input id="pricing-cost-out" type="number" step="0.01" min="0" required placeholder="e.g. 15.00" />
          </label>
          <label>Cache Read Tokens Cost ($ per 1 Million tokens)
            <input id="pricing-cost-cache" type="number" step="0.01" min="0" required placeholder="e.g. 0.30" />
          </label>
          <menu>
            <button type="button" id="cancel-pricing" className="hbtn">Cancel</button>
            <button type="submit" className="hbtn primary">Save Pricing Rule</button>
          </menu>
        </form>
      </dialog>

      <Script src="/team/app.js" strategy="afterInteractive" />
    </div>
  );
}
