/**
 * Team admin dashboard page (/team).
 * Features custom filters (Member, Token Usage Range, AI Agent Source),
 * Model Pricing Rates Management ($/1M tokens), API cost recalculation,
 * vertical sidebar, and deep analytics.
 */
import type { Metadata } from 'next';
import Link from 'next/link';
import Script from 'next/script';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { getSessionFromCookie } from '@/lib/auth';

export const metadata: Metadata = {
  title: 'Team Analytics — Visualisation Dashboard',
  description:
    'Comprehensive team agent analytics — member token logs, custom model pricing, API cost recalculation, and scorecards.',
};

export default async function TeamDashboardPage() {
  const cookieStore = await cookies();
  const session = getSessionFromCookie(cookieStore.toString());

  if (!session || (session.role !== 'admin' && session.role !== 'superadmin')) {
    redirect('/');
  }

  return (
    <div suppressHydrationWarning>
      {/* Shown only until the cookie session check resolves, so a slow
          network never flashes the legacy password-login screen below
          in front of an already-authenticated user. */}
      <div id="boot-loading" className="boot-loading" aria-busy="true" suppressHydrationWarning>
        <div className="tt-loader" role="status">
          <div className="tt-loader-orbit" aria-hidden="true">
            <div className="tt-loader-ring" />
            <div className="tt-loader-ring tt-loader-ring--inner" />
            <div className="tt-loader-core">
              <svg
                width="22"
                height="22"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M12 3v3M12 18v3M3 12h3M18 12h3" />
                <circle cx="12" cy="12" r="4" />
              </svg>
            </div>
            <i className="tt-loader-token t1" />
            <i className="tt-loader-token t2" />
            <i className="tt-loader-token t3" />
          </div>
          <p className="tt-loader-label">
            Tracing <em>team</em> tokens…
          </p>
        </div>
      </div>

      <div id="login-screen" className="team-login" hidden suppressHydrationWarning>
        <form id="login-form">
          <h1>Team analytics</h1>
          <p className="muted">
            Admin login — personal dashboard is at <code>/</code>
          </p>
          <label>
            Password
            <input id="login-password" type="password" autoComplete="current-password" required />
          </label>
          <button type="submit" className="hbtn primary" id="login-submit">
            Sign in
          </button>
          <p id="login-error" className="error" role="alert" aria-live="assertive" hidden></p>
        </form>
      </div>

      <div id="app" hidden className="team-app-layout">
        {/* Mobile-only topbar: shown under 880px, hosts the hamburger toggle */}
        <div className="mobile-topbar">
          <button
            type="button"
            id="team-nav-toggle"
            className="mobile-nav-toggle"
            aria-label="Toggle menu"
            aria-expanded="false"
            aria-controls="team-sidebar-nav"
          >
            <span></span>
            <span></span>
            <span></span>
          </button>
          <div className="wordmark">
            <h1>team</h1>
          </div>
          <div className="mobile-topbar-spacer" />
        </div>
        <div id="team-nav-overlay" className="nav-overlay"></div>

        {/* Left Vertical Sidebar */}
        <aside className="team-sidebar" id="team-sidebar-nav">
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

          <nav
            className="team-sidebar-nav"
            id="team-tabs"
            role="tablist"
            aria-label="Team analytics sections"
          >
            <button
              type="button"
              id="tabbtn-overview"
              className="tab-btn active"
              data-tab="tab-overview"
              data-title="Overview & Stats"
              role="tab"
              aria-selected="true"
              aria-controls="tab-overview"
              tabIndex={0}
            >
              <span className="nav-icon" aria-hidden="true">
                📊
              </span>{' '}
              Overview & Stats
            </button>
            <button
              type="button"
              id="tabbtn-token-leaderboard"
              className="tab-btn"
              data-tab="tab-token-leaderboard"
              data-title="Token Leaderboard"
              role="tab"
              aria-selected="false"
              aria-controls="tab-token-leaderboard"
              tabIndex={-1}
            >
              <span className="nav-icon" aria-hidden="true">
                🏆
              </span>{' '}
              Token Leaderboard
            </button>
            <button
              type="button"
              id="tabbtn-head-to-head"
              className="tab-btn"
              data-tab="tab-head-to-head"
              data-title="Head-to-Head"
              role="tab"
              aria-selected="false"
              aria-controls="tab-head-to-head"
              tabIndex={-1}
            >
              <span className="nav-icon" aria-hidden="true">
                ⚔️
              </span>{' '}
              Head-to-Head
            </button>
            <button
              type="button"
              id="tabbtn-members"
              className="tab-btn"
              data-tab="tab-members"
              data-title="Member Token Logs"
              role="tab"
              aria-selected="false"
              aria-controls="tab-members"
              tabIndex={-1}
            >
              <span className="nav-icon" aria-hidden="true">
                👥
              </span>{' '}
              Member Token Logs
            </button>
            <button
              type="button"
              id="tabbtn-projects"
              className="tab-btn"
              data-tab="tab-projects"
              data-title="Projects & Repos"
              role="tab"
              aria-selected="false"
              aria-controls="tab-projects"
              tabIndex={-1}
            >
              <span className="nav-icon" aria-hidden="true">
                📁
              </span>{' '}
              Projects & Repos
            </button>
            <button
              type="button"
              id="tabbtn-files"
              className="tab-btn"
              data-tab="tab-files"
              data-title="Code Impact Map"
              role="tab"
              aria-selected="false"
              aria-controls="tab-files"
              tabIndex={-1}
            >
              <span className="nav-icon" aria-hidden="true">
                📄
              </span>{' '}
              Code Impact Map
            </button>
            <button
              type="button"
              id="tabbtn-logs"
              className="tab-btn"
              data-tab="tab-logs"
              data-title="Session Logs"
              role="tab"
              aria-selected="false"
              aria-controls="tab-logs"
              tabIndex={-1}
            >
              <span className="nav-icon" aria-hidden="true">
                📜
              </span>{' '}
              Session Logs
            </button>
            <button
              type="button"
              id="tabbtn-pricing"
              className="tab-btn"
              data-tab="tab-pricing"
              data-title="Model Pricing"
              role="tab"
              aria-selected="false"
              aria-controls="tab-pricing"
              tabIndex={-1}
            >
              <span className="nav-icon" aria-hidden="true">
                💲
              </span>{' '}
              Model Pricing Rates
            </button>
            <button
              type="button"
              id="tabbtn-settings"
              className="tab-btn"
              data-tab="tab-settings"
              data-title="Manage Members"
              role="tab"
              aria-selected="false"
              aria-controls="tab-settings"
              tabIndex={-1}
            >
              <span className="nav-icon" aria-hidden="true">
                ⚙️
              </span>{' '}
              Manage Members
            </button>
          </nav>

          <div className="sidebar-footer">
            <Link href="/dashboard" className="sidebar-link">
              ← Personal Dashboard
            </Link>
            <button id="team-logout-btn" className="hbtn sidebar-logout-btn">
              Sign out
            </button>
          </div>
        </aside>

        {/* Main Content Area */}
        <div className="team-main-wrapper">
          {/* Header Controls & Filters */}
          <header className="team-header">
            <div className="team-header-top">
              <h1 id="team-page-title" className="team-page-title">
                Overview &amp; Stats
              </h1>
            </div>
            <div className="header-filters-row">
              {/* Date Presets */}
              <div id="range-presets" className="range-presets" role="tablist"></div>

              {/* Mobile-only collapsible trigger for the remaining filters */}
              <button
                type="button"
                id="filters-toggle"
                className="hbtn filters-toggle-btn"
                aria-expanded="false"
                aria-controls="filters-more"
              >
                <span aria-hidden="true">⚙️</span> Filters
                <span id="filters-badge" className="filters-badge" hidden>
                  0
                </span>
              </button>

              <div id="filters-more" className="filters-more">
                <div className="filters-more-grid">
                  <label className="filter-label">
                    From <input id="range-from" type="date" />
                  </label>
                  <label className="filter-label">
                    To <input id="range-to" type="date" />
                  </label>

                  {/* Member Filter */}
                  <label className="filter-label">
                    Member
                    <select id="global-member-filter">
                      <option value="all">All Members</option>
                    </select>
                  </label>

                  {/* Source Filter */}
                  <label className="filter-label">
                    AI Tool
                    <select id="global-source-filter">
                      <option value="all">All Tools</option>
                      <option value="cursor">Cursor</option>
                      <option value="claude-code">Claude Code</option>
                      <option value="codex">Codex</option>
                    </select>
                  </label>

                  {/* Token Usage Range Filter */}
                  <label className="filter-label filter-label-wide">
                    Min Tokens
                    <select id="global-min-tokens-filter">
                      <option value="0">All Usage (0+)</option>
                      <option value="10000">&gt; 10k Tokens</option>
                      <option value="100000">&gt; 100k Tokens</option>
                      <option value="1000000">&gt; 1M Tokens</option>
                      <option value="10000000">&gt; 10M Tokens</option>
                    </select>
                  </label>
                </div>

                <button id="refresh" className="hbtn primary" title="Refresh stats">
                  ↻ Apply Filters
                </button>
              </div>
            </div>
          </header>

          <main className="team-main">
            <div
              id="app-error"
              className="app-error"
              role="alert"
              aria-live="assertive"
              hidden
            ></div>
            <div id="data-loading" className="data-loading" hidden aria-busy="true"></div>
            <div id="app-loading" className="app-loading" hidden aria-busy="true">
              <div className="app-loading-hero">
                <div className="tt-loader" role="status">
                  <div className="tt-loader-orbit" aria-hidden="true">
                    <div className="tt-loader-ring" />
                    <div className="tt-loader-ring tt-loader-ring--inner" />
                    <div className="tt-loader-core">
                      <svg
                        width="22"
                        height="22"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <path d="M12 3v3M12 18v3M3 12h3M18 12h3" />
                        <circle cx="12" cy="12" r="4" />
                      </svg>
                    </div>
                    <i className="tt-loader-token t1" />
                    <i className="tt-loader-token t2" />
                    <i className="tt-loader-token t3" />
                  </div>
                  <p className="tt-loader-label">
                    Gathering <em>analytics</em>…
                  </p>
                </div>
              </div>
              <div className="skeleton-cards" aria-hidden="true">
                <div className="skeleton-stat">
                  <div className="skeleton" />
                  <div className="skeleton" />
                </div>
                <div className="skeleton-stat">
                  <div className="skeleton" />
                  <div className="skeleton" />
                </div>
                <div className="skeleton-stat">
                  <div className="skeleton" />
                  <div className="skeleton" />
                </div>
                <div className="skeleton-stat">
                  <div className="skeleton" />
                  <div className="skeleton" />
                </div>
                <div className="skeleton-stat">
                  <div className="skeleton" />
                  <div className="skeleton" />
                </div>
                <div className="skeleton-stat">
                  <div className="skeleton" />
                  <div className="skeleton" />
                </div>
              </div>
              <div className="grid-2" aria-hidden="true">
                <div className="skeleton-panel">
                  <div className="skeleton skeleton-title" />
                  <div className="skeleton skeleton-row" />
                  <div className="skeleton skeleton-row" />
                  <div className="skeleton skeleton-row" />
                </div>
                <div className="skeleton-panel">
                  <div className="skeleton skeleton-title" />
                  <div className="skeleton skeleton-row" style={{ height: '160px' }} />
                </div>
              </div>
              <span className="visually-hidden">Loading team analytics…</span>
            </div>
            <div id="app-content">
              {/* TAB 1: OVERVIEW & KEY STATS */}
              <section
                id="tab-overview"
                className="tab-content active"
                role="tabpanel"
                aria-labelledby="tabbtn-overview"
              >
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
              <section
                id="tab-token-leaderboard"
                className="tab-content"
                role="tabpanel"
                aria-labelledby="tabbtn-token-leaderboard"
                hidden
              >
                <div className="panel">
                  <div className="panel-head">
                    <div>
                      <h2>Token Consumption Leaderboard</h2>
                      <span className="muted">
                        Ranked by total tokens exchanged (input + output + cache)
                      </span>
                    </div>
                  </div>
                  <div id="token-leaderboard-table" className="table-wrap"></div>
                </div>
              </section>

              {/* TAB 3: HEAD-TO-HEAD SCOREBOARD */}
              <section
                id="tab-head-to-head"
                className="tab-content"
                role="tabpanel"
                aria-labelledby="tabbtn-head-to-head"
                hidden
              >
                <div className="panel">
                  <div className="panel-head">
                    <div>
                      <h2>Member Head-to-Head</h2>
                      <span className="muted">
                        Normalized efficiency metrics across team members
                      </span>
                    </div>
                  </div>
                  <div id="head-to-head-table" className="table-wrap"></div>
                </div>
              </section>

              {/* TAB 4: MEMBER DEEP DIVE & FILES */}
              <section
                id="tab-members"
                className="tab-content"
                role="tabpanel"
                aria-labelledby="tabbtn-members"
                hidden
              >
                <div className="panel-head">
                  <div>
                    <h2>Per-Member Drilldown</h2>
                    <span className="muted">
                      Token, project, model, and edit activity by member
                    </span>
                  </div>
                  <div className="filter-group">
                    <button type="button" id="collapse-all-members" className="hbtn hbtn-sm">
                      Collapse all
                    </button>
                    <button type="button" id="expand-all-members" className="hbtn hbtn-sm">
                      Expand all
                    </button>
                    <label className="member-filter-label" htmlFor="member-filter-select">
                      Member
                    </label>
                    <select id="member-filter-select" aria-label="Filter by member"></select>
                  </div>
                </div>
                <div id="member-drilldown-cards"></div>
              </section>

              {/* TAB 5: PROJECTS & WORKSPACES */}
              <section
                id="tab-projects"
                className="tab-content"
                role="tabpanel"
                aria-labelledby="tabbtn-projects"
                hidden
              >
                <div className="panel">
                  <div className="panel-head">
                    <div>
                      <h2>Projects & Workspaces</h2>
                      <span className="muted">
                        Which accounts and members worked on which repositories
                      </span>
                    </div>
                  </div>
                  <div id="projects-table" className="table-wrap"></div>
                </div>
              </section>

              {/* TAB 6: FILE IMPACT RISK MAP */}
              <section
                id="tab-files"
                className="tab-content"
                role="tabpanel"
                aria-labelledby="tabbtn-files"
                hidden
              >
                <div className="panel">
                  <div className="panel-head">
                    <div>
                      <h2>Code Impact Map</h2>
                      <span className="muted">
                        Most-modified paths, line diffs, and contributor counts
                      </span>
                    </div>
                  </div>
                  <div id="top-files" className="table-wrap"></div>
                </div>
              </section>

              {/* TAB 7: SESSION ACTIVITY LOGS */}
              <section
                id="tab-logs"
                className="tab-content"
                role="tabpanel"
                aria-labelledby="tabbtn-logs"
                hidden
              >
                <div className="panel">
                  <div className="panel-head">
                    <div>
                      <h2>Session Activity Logs</h2>
                      <span className="muted">Recent agent sessions across the team</span>
                    </div>
                  </div>
                  <div id="session-logs-table" className="table-wrap"></div>
                </div>
              </section>

              {/* TAB 8: MODEL PRICING RATES */}
              <section
                id="tab-pricing"
                className="tab-content"
                role="tabpanel"
                aria-labelledby="tabbtn-pricing"
                hidden
              >
                <div className="panel">
                  <div className="panel-head">
                    <div>
                      <h2>Model Pricing</h2>
                      <span className="muted">Custom LLM rates in $ per million tokens</span>
                    </div>
                    <div className="inline-actions">
                      <button id="recalculate-costs-btn" className="hbtn hbtn-accent">
                        Recalculate costs
                      </button>
                      <button id="add-pricing-btn" className="hbtn primary">
                        + Add pricing rule
                      </button>
                    </div>
                  </div>
                  <p className="panel-intro">
                    Configure pricing rules, then recalculate to refresh estimated costs across
                    member sessions.
                  </p>
                  <div id="model-pricing-table" className="table-wrap"></div>

                  <div className="panel-subsection">
                    <div className="panel-head panel-head-tight">
                      <div>
                        <h2>Member Model Usage</h2>
                        <span className="muted">Spend breakdown by model for each team member</span>
                      </div>
                    </div>
                    <div id="member-models-table" className="table-wrap"></div>
                  </div>
                </div>
              </section>

              {/* TAB 9: SETTINGS & MEMBER KEYS */}
              <section
                id="tab-settings"
                className="tab-content"
                role="tabpanel"
                aria-labelledby="tabbtn-settings"
                hidden
              >
                <section className="panel">
                  <div className="panel-head">
                    <div>
                      <h2>Team Members & API Keys</h2>
                      <span className="muted">Manage members, roles, and ingest keys</span>
                    </div>
                    <div className="inline-actions">
                      <button id="trigger-sync-all-btn" className="hbtn hbtn-accent">
                        Sync all members
                      </button>
                      <button id="link-member-btn" className="hbtn">
                        Link existing
                      </button>
                      <button id="add-member-btn" className="hbtn primary">
                        + Add member
                      </button>
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
          <label>
            Display name
            <input id="member-name" required placeholder="e.g. Alex Smith" />
          </label>
          <label>
            Role
            <select id="member-role">
              <option value="member">Member</option>
              <option value="admin">Admin</option>
            </select>
          </label>
          <menu>
            <button type="button" id="cancel-member" className="hbtn">
              Cancel
            </button>
            <button type="submit" className="hbtn primary">
              Create + API key
            </button>
          </menu>
        </form>
      </dialog>

      {/* Edit Member Dialog */}
      <dialog id="edit-member-dialog">
        <form method="dialog" id="edit-member-form">
          <h3>Edit team member</h3>
          <input type="hidden" id="edit-member-id" />
          <label>
            Display name
            <input id="edit-member-name" required />
          </label>
          <label>
            Role
            <select id="edit-member-role">
              <option value="member">Member</option>
              <option value="admin">Admin</option>
            </select>
          </label>
          <menu>
            <button type="button" id="cancel-edit-member" className="hbtn">
              Cancel
            </button>
            <button type="submit" className="hbtn primary">
              Save Changes
            </button>
          </menu>
        </form>
      </dialog>

      {/* Link Member Dialog */}
      <dialog id="link-member-dialog">
        <form method="dialog" id="link-member-form">
          <h3>Link existing member</h3>
          <label>
            Select Member
            <select id="link-member-select" required>
              <option value="">— select member —</option>
            </select>
          </label>
          <menu>
            <button type="button" id="cancel-link-member" className="hbtn">
              Cancel
            </button>
            <button type="submit" className="hbtn primary">
              Link to Team
            </button>
          </menu>
        </form>
      </dialog>

      {/* Add Model Pricing Dialog */}
      <dialog id="add-pricing-dialog">
        <form method="dialog" id="add-pricing-form">
          <h3>Add / Update Model Pricing Rule</h3>
          <label>
            Model Pattern / Name
            <input
              id="pricing-model-pattern"
              required
              placeholder="e.g. claude-3-5-sonnet or deepseek-r1"
            />
          </label>
          <label>
            Input Tokens Cost ($ per 1 Million tokens)
            <input
              id="pricing-cost-in"
              type="number"
              step="0.01"
              min="0"
              required
              placeholder="e.g. 3.00"
            />
          </label>
          <label>
            Output Tokens Cost ($ per 1 Million tokens)
            <input
              id="pricing-cost-out"
              type="number"
              step="0.01"
              min="0"
              required
              placeholder="e.g. 15.00"
            />
          </label>
          <label>
            Cache Read Tokens Cost ($ per 1 Million tokens)
            <input
              id="pricing-cost-cache"
              type="number"
              step="0.01"
              min="0"
              required
              placeholder="e.g. 0.30"
            />
          </label>
          <menu>
            <button type="button" id="cancel-pricing" className="hbtn">
              Cancel
            </button>
            <button type="submit" className="hbtn primary">
              Save Pricing Rule
            </button>
          </menu>
        </form>
      </dialog>

      <Script src="/toast.js" strategy="afterInteractive" />
      <Script src="/loader.js" strategy="afterInteractive" />
      <Script src="/team/app.js" strategy="afterInteractive" />
    </div>
  );
}
