import type { Metadata } from 'next';
import Script from 'next/script';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { getSessionFromCookie } from '@/lib/auth';

export const metadata: Metadata = {
  title: 'Admin — Token Tracer',
  description: 'Superadmin user management dashboard.',
};

export default async function AdminPage() {
  const cookieStore = await cookies();
  const session = getSessionFromCookie(cookieStore.toString());

  if (!session || session.role !== 'superadmin') {
    redirect('/');
  }

  return (
    <div suppressHydrationWarning>
      <Script src="/impersonation.js" strategy="afterInteractive" />
      <div id="boot-loading" className="boot-loading" aria-busy="true" suppressHydrationWarning>
        <div className="tt-loader" role="status">
          <div className="tt-loader-orbit" aria-hidden="true">
            <div className="tt-loader-ring" />
            <div className="tt-loader-ring tt-loader-ring--inner" />
            <div className="tt-loader-core">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 3v3M12 18v3M3 12h3M18 12h3" />
                <circle cx="12" cy="12" r="4" />
              </svg>
            </div>
            <i className="tt-loader-token t1" />
            <i className="tt-loader-token t2" />
            <i className="tt-loader-token t3" />
          </div>
          <p className="tt-loader-label">Loading <em>admin</em>…</p>
        </div>
      </div>

      <div id="admin-app" className="admin-app" hidden>
        {/* Mobile-only topbar */}
        <div className="mobile-topbar">
          <button type="button" id="admin-nav-toggle" className="mobile-nav-toggle" aria-label="Toggle menu" aria-expanded="false" aria-controls="admin-sidebar-nav">
            <span></span><span></span><span></span>
          </button>
          <div className="wordmark"><h1>admin</h1></div>
          <div className="mobile-topbar-spacer" />
        </div>
        <div id="admin-nav-overlay" className="nav-overlay"></div>

        <aside className="admin-sidebar" id="admin-sidebar-nav">
          <div className="sidebar-brand">
            <div className="wordmark">
              <h1>admin</h1>
              <span className="eyebrow">Superadmin</span>
            </div>
          </div>
          <nav className="admin-sidebar-nav" role="tablist" aria-label="Admin sections">
            <button type="button" id="tabbtn-users" className="tab-btn active" data-tab="tab-users" role="tab" aria-selected="true" aria-controls="tab-users" tabIndex={0}>
              <span className="nav-icon" aria-hidden="true">👥</span> Users
            </button>
            <button type="button" id="tabbtn-members" className="tab-btn" data-tab="tab-members" role="tab" aria-selected="false" aria-controls="tab-members" tabIndex={-1}>
              <span className="nav-icon" aria-hidden="true">🔗</span> Members
            </button>
            <button type="button" id="tabbtn-teams" className="tab-btn" data-tab="tab-teams" role="tab" aria-selected="false" aria-controls="tab-teams" tabIndex={-1}>
              <span className="nav-icon" aria-hidden="true">🛡️</span> Teams
            </button>
            <button type="button" id="tabbtn-pricing" className="tab-btn" data-tab="tab-pricing" role="tab" aria-selected="false" aria-controls="tab-pricing" tabIndex={-1}>
              <span className="nav-icon" aria-hidden="true">💲</span> Model Pricing
            </button>
            <div className="sidebar-nav-divider" aria-hidden="true" />
            <button type="button" id="tabbtn-pipeline" className="tab-btn" data-tab="tab-pipeline" role="tab" aria-selected="false" aria-controls="tab-pipeline" tabIndex={-1}>
              <span className="nav-icon" aria-hidden="true">🩺</span> Pipeline Health
            </button>
            <button type="button" id="tabbtn-cost" className="tab-btn" data-tab="tab-cost" role="tab" aria-selected="false" aria-controls="tab-cost" tabIndex={-1}>
              <span className="nav-icon" aria-hidden="true">💰</span> Cost Intelligence
            </button>
            <button type="button" id="tabbtn-usage" className="tab-btn" data-tab="tab-usage" role="tab" aria-selected="false" aria-controls="tab-usage" tabIndex={-1}>
              <span className="nav-icon" aria-hidden="true">📈</span> Usage &amp; Growth
            </button>
            <button type="button" id="tabbtn-research" className="tab-btn" data-tab="tab-research" role="tab" aria-selected="false" aria-controls="tab-research" tabIndex={-1}>
              <span className="nav-icon" aria-hidden="true">🔍</span> Research Analytics
            </button>
          </nav>
          <div className="sidebar-footer">
            <button type="button" id="admin-profile-btn" className="hbtn sidebar-profile-btn" title="Account &amp; Profile Settings">
              <span className="profile-btn-icon" aria-hidden="true">👤</span>
              <span id="admin-user-name" className="muted">Profile</span>
            </button>
            <div className="sidebar-footer-links">
              <button id="admin-logout-btn" className="hbtn" title="Sign out">Sign out</button>
            </div>
          </div>
        </aside>

        <main className="admin-content">
          <div id="data-loading" className="data-loading" hidden aria-busy="true"></div>

          {/* Users tab */}
          <div id="tab-users" className="admin-tab active-tab" role="tabpanel" aria-labelledby="tabbtn-users">
            <div className="admin-tab-header">
              <div>
                <h2>Users</h2>
                <span className="admin-tab-sub">Accounts, roles, and member links</span>
              </div>
              <div className="admin-header-actions">
                <button type="button" className="hbtn migrate-btn" id="migrate-btn" hidden>Run database migration</button>
                <button type="button" className="hbtn primary" id="create-user-btn">+ Add user</button>
              </div>
            </div>

            <div id="user-form-wrap" className="user-form-wrap" hidden>
              <form id="user-form" className="user-form" noValidate>
                <h3 id="user-form-title">Add User</h3>
                <input type="hidden" id="uf-id" />
                <div className="form-grid">
                  <div className="form-field">
                    <label htmlFor="uf-username">Username</label>
                    <input id="uf-username" type="text" placeholder="e.g. raxit" required />
                  </div>
                  <div className="form-field">
                    <label htmlFor="uf-displayname">Display Name</label>
                    <input id="uf-displayname" type="text" placeholder="e.g. Raxit Patel" required />
                  </div>
                  <div className="form-field">
                    <label htmlFor="uf-password">Password <span className="muted">(leave blank when editing to keep current)</span></label>
                    <input id="uf-password" type="password" placeholder="temporary password" autoComplete="new-password" />
                  </div>
                  <div className="form-field">
                    <label htmlFor="uf-role">Role</label>
                    <select id="uf-role">
                      <option value="user">User (personal dashboard)</option>
                      <option value="admin">Admin (team dashboard)</option>
                      <option value="superadmin">Superadmin</option>
                    </select>
                  </div>
                  <div className="form-field">
                    <label htmlFor="uf-member">Linked Member (for sync API key)</label>
                    <select id="uf-member">
                      <option value="">— none (Independent) —</option>
                    </select>
                  </div>
                  <div className="form-field" id="field-uf-team" hidden>
                    <label htmlFor="uf-team">Linked Team (for Admins)</label>
                    <select id="uf-team">
                      <option value="">— none —</option>
                      <option value="new">— create new team —</option>
                    </select>
                  </div>
                  <div className="form-field" id="field-uf-new-team" hidden>
                    <label htmlFor="uf-new-team">New Team Name</label>
                    <input id="uf-new-team" type="text" placeholder="e.g. India Developers" />
                  </div>
                  <div className="form-field full-width" id="field-uf-teams" style={{ gridColumn: '1 / -1' }}>
                    <label>Assigned Teams (Multi-Team Membership)</label>
                    <div id="uf-teams-checkboxes" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '8px', marginTop: '6px', background: 'rgba(255,255,255,0.03)', padding: '10px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.08)' }}>
                      {/* Populated dynamically */}
                    </div>
                  </div>
                </div>
                <div className="form-actions">
                  <button type="submit" className="hbtn primary" id="uf-submit">Save</button>
                  <button type="button" className="hbtn" id="uf-cancel">Cancel</button>
                  <p id="uf-error" className="error" role="alert" aria-live="assertive" hidden />
                </div>
              </form>
            </div>

            <div className="admin-filters" style={{ display: 'flex', gap: '12px', marginBottom: '16px', alignItems: 'center', flexWrap: 'wrap' }}>
              <input type="text" id="filter-user-input" placeholder="Search name or username..." style={{ flex: '1', minWidth: '200px', maxWidth: '300px', padding: '8px 12px', borderRadius: '6px', border: '1px solid var(--border)', background: 'var(--page)', color: 'var(--ink)', fontSize: '13px' }} />
              <select id="filter-team-select" style={{ padding: '8px 12px', borderRadius: '6px', border: '1px solid var(--border)', background: 'var(--page)', color: 'var(--ink)', fontSize: '13px', minWidth: '150px' }}>
                <option value="">All Teams</option>
                {/* Populated dynamically */}
              </select>
              <select id="filter-status-select" style={{ padding: '8px 12px', borderRadius: '6px', border: '1px solid var(--border)', background: 'var(--page)', color: 'var(--ink)', fontSize: '13px', minWidth: '150px' }}>
                <option value="">All Statuses</option>
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>
            </div>

            <div className="admin-table-wrap">
              <table className="admin-table" id="users-table">
                <thead>
                  <tr>
                    <th>User</th>
                    <th>Teams</th>
                    <th>Sessions</th>
                    <th>Last Login</th>
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody id="users-tbody" aria-busy="true">
                  {[0, 1, 2, 3].map((i) => (
                    <tr key={i} aria-hidden="true">
                      {Array.from({ length: 6 }).map((_, j) => (
                        <td key={j}><div className="skeleton" style={{ height: '14px', width: j === 0 ? '80%' : '60%' }} /></td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div id="new-password-banner" className="new-password-banner" hidden>
              <strong>New password:</strong>
              <code id="new-password-value" />
              <span className="muted">— copy it now, it won&apos;t be shown again.</span>
              <button type="button" className="hbtn" id="new-password-copy">Copy</button>
              <button type="button" className="hbtn" id="new-password-close">×</button>
            </div>
          </div>

          {/* Members tab */}
          <div id="tab-members" className="admin-tab" role="tabpanel" aria-labelledby="tabbtn-members" hidden>
            <div className="admin-tab-header">
              <div>
                <h2>Unlinked Members</h2>
                <span className="admin-tab-sub">Members not yet connected to a user account</span>
              </div>
            </div>

            <div id="member-form-wrap" className="user-form-wrap" hidden>
              <form id="member-form" className="user-form" noValidate>
                <h3 id="member-form-title">Edit Member</h3>
                <input type="hidden" id="mf-id" />
                <div className="form-grid">
                  <div className="form-field">
                    <label htmlFor="mf-displayname">Display Name</label>
                    <input id="mf-displayname" type="text" placeholder="e.g. John Doe" required />
                  </div>
                  <div className="form-field full-width" id="field-mf-teams" style={{ gridColumn: '1 / -1' }}>
                    <label>Assigned Teams</label>
                    <div id="mf-teams-checkboxes" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '8px', marginTop: '6px', background: 'rgba(255,255,255,0.03)', padding: '10px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.08)' }}>
                      {/* Populated dynamically */}
                    </div>
                  </div>
                </div>
                <div className="form-actions">
                  <button type="submit" className="hbtn primary" id="mf-submit">Save</button>
                  <button type="button" className="hbtn" id="mf-cancel">Cancel</button>
                  <p id="mf-error" className="error" role="alert" aria-live="assertive" hidden />
                </div>
              </form>
            </div>

            <div className="admin-table-wrap">
              <table className="admin-table">
                <thead>
                  <tr><th>Display Name</th><th>Teams</th><th>Status</th><th>Actions</th></tr>
                </thead>
                <tbody id="members-tbody" aria-busy="true">
                  {[0, 1, 2].map((i) => (
                    <tr key={i} aria-hidden="true">
                      {Array.from({ length: 4 }).map((_, j) => (
                        <td key={j}><div className="skeleton" style={{ height: '14px', width: j === 0 ? '80%' : '60%' }} /></td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Teams tab */}
          <div id="tab-teams" className="admin-tab" role="tabpanel" aria-labelledby="tabbtn-teams" hidden>
            <div className="admin-tab-header">
              <div>
                <h2>Teams</h2>
                <span className="admin-tab-sub">Manage team names and organizations</span>
              </div>
              <div className="admin-header-actions">
                <button type="button" className="hbtn primary" id="create-team-btn">+ Add team</button>
              </div>
            </div>

            <div id="team-form-wrap" className="user-form-wrap" hidden>
              <form id="team-form" className="user-form" noValidate>
                <h3 id="team-form-title">Add Team</h3>
                <input type="hidden" id="tf-id" />
                <div className="form-grid">
                  <div className="form-field">
                    <label htmlFor="tf-name">Team Name</label>
                    <input id="tf-name" type="text" placeholder="e.g. India Developers" required />
                  </div>
                </div>
                <div className="form-actions">
                  <button type="submit" className="hbtn primary" id="tf-submit">Save</button>
                  <button type="button" className="hbtn" id="tf-cancel">Cancel</button>
                  <p id="tf-error" className="error" role="alert" aria-live="assertive" hidden />
                </div>
              </form>
            </div>

            <div className="admin-table-wrap">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>Team Name</th>
                    <th>Members Count</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody id="teams-tbody" aria-busy="true">
                  {[0, 1, 2].map((i) => (
                    <tr key={i} aria-hidden="true">
                      {Array.from({ length: 3 }).map((_, j) => (
                        <td key={j}><div className="skeleton" style={{ height: '14px', width: j === 0 ? '80%' : '60%' }} /></td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Model Pricing tab */}
          <div id="tab-pricing" className="admin-tab" role="tabpanel" aria-labelledby="tabbtn-pricing" hidden>
            <div className="admin-tab-header">
              <div>
                <h2>Model Pricing &amp; Rates</h2>
                <span className="admin-tab-sub">Configure global or team-specific LLM pricing ($/1M tokens) and synchronize across all teams and members</span>
              </div>
              <div className="admin-header-actions" style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                <button type="button" className="hbtn hbtn-accent" id="sync-all-btn" title="Sync pricing, recalculate historical session costs, and broadcast daemon sync across all teams">
                  <span className="sync-icon">🔄</span> Sync for All Teams &amp; Members
                </button>
                <button type="button" className="hbtn primary" id="create-pricing-btn">+ Add pricing rule</button>
              </div>
            </div>

            <div id="pricing-form-wrap" className="user-form-wrap" hidden>
              <form id="pricing-form" className="user-form" noValidate>
                <h3 id="pricing-form-title">Add Pricing Rule</h3>
                <input type="hidden" id="pf-id" />

                <div className="preset-pill-bar" style={{ marginBottom: '16px', display: 'flex', flexWrap: 'wrap', gap: '6px', alignItems: 'center' }}>
                  <span className="muted" style={{ fontSize: '12px', marginRight: '4px' }}>Quick Presets:</span>
                  <button type="button" className="preset-pill" data-pattern="claude-3-7-sonnet" data-in="3.0" data-out="15.0" data-cache="0.3">Claude 3.7 Sonnet</button>
                  <button type="button" className="preset-pill" data-pattern="claude-3-5-sonnet" data-in="3.0" data-out="15.0" data-cache="0.3">Claude 3.5 Sonnet</button>
                  <button type="button" className="preset-pill" data-pattern="claude-3-5-haiku" data-in="0.8" data-out="4.0" data-cache="0.08">Claude 3.5 Haiku</button>
                  <button type="button" className="preset-pill" data-pattern="gpt-4o" data-in="2.5" data-out="10.0" data-cache="1.25">GPT-4o</button>
                  <button type="button" className="preset-pill" data-pattern="gpt-4o-mini" data-in="0.15" data-out="0.6" data-cache="0.075">GPT-4o Mini</button>
                  <button type="button" className="preset-pill" data-pattern="o1" data-in="15.0" data-out="60.0" data-cache="7.5">o1</button>
                  <button type="button" className="preset-pill" data-pattern="o3-mini" data-in="1.1" data-out="4.4" data-cache="0.55">o3-mini</button>
                  <button type="button" className="preset-pill" data-pattern="deepseek-r1" data-in="0.55" data-out="2.19" data-cache="0.14">DeepSeek R1</button>
                  <button type="button" className="preset-pill" data-pattern="deepseek-v3" data-in="0.14" data-out="0.28" data-cache="0.014">DeepSeek V3</button>
                </div>

                <div className="form-grid">
                  <div className="form-field">
                    <label htmlFor="pf-team">Scope / Target Team</label>
                    <select id="pf-team">
                      <option value="global">🌐 Global (Applies to all teams &amp; members)</option>
                    </select>
                  </div>
                  <div className="form-field">
                    <label htmlFor="pf-pattern">Model Pattern / Identifier</label>
                    <input id="pf-pattern" type="text" placeholder="e.g. claude-3-7-sonnet or gpt-4o" required />
                  </div>
                  <div className="form-field">
                    <label htmlFor="pf-cost-in">Cost In ($ / 1M tokens)</label>
                    <input id="pf-cost-in" type="number" step="0.0001" min="0" placeholder="e.g. 3.00" required />
                  </div>
                  <div className="form-field">
                    <label htmlFor="pf-cost-out">Cost Out ($ / 1M tokens)</label>
                    <input id="pf-cost-out" type="number" step="0.0001" min="0" placeholder="e.g. 15.00" required />
                  </div>
                  <div className="form-field">
                    <label htmlFor="pf-cost-cache">Cache Read Cost ($ / 1M tokens)</label>
                    <input id="pf-cost-cache" type="number" step="0.0001" min="0" placeholder="e.g. 0.30" required />
                  </div>
                </div>

                <div className="form-actions">
                  <button type="submit" className="hbtn primary" id="pf-submit">Save Pricing Rule</button>
                  <button type="button" className="hbtn" id="pf-cancel">Cancel</button>
                  <p id="pf-error" className="error" role="alert" aria-live="assertive" hidden />
                </div>
              </form>
            </div>

            <div className="admin-table-wrap">
              <div className="admin-table-title" style={{ padding: '12px 16px', fontWeight: 600, borderBottom: '1px solid rgba(255,255,255,0.06)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span>Active Custom Pricing Overrides</span>
                <span id="pricing-count-badge" className="team-badge" style={{ fontSize: '11px', background: 'rgba(255,255,255,0.08)', padding: '2px 8px', borderRadius: '12px' }}>0 rules</span>
              </div>
              <table className="admin-table" id="pricing-table">
                <thead>
                  <tr>
                    <th>Model Pattern</th>
                    <th>Scope / Team</th>
                    <th>Input ($/1M)</th>
                    <th>Output ($/1M)</th>
                    <th>Cache Read ($/1M)</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody id="pricing-tbody" aria-busy="true">
                  {[0, 1, 2].map((i) => (
                    <tr key={i} aria-hidden="true">
                      {Array.from({ length: 6 }).map((_, j) => (
                        <td key={j}><div className="skeleton" style={{ height: '14px', width: j === 0 ? '70%' : '50%' }} /></td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="admin-table-wrap" style={{ marginTop: '24px' }}>
              <div className="admin-table-title" style={{ padding: '12px 16px', fontWeight: 600, borderBottom: '1px solid rgba(255,255,255,0.06)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <span>System Baseline Reference Rates</span>
                  <span className="muted" style={{ fontSize: '12px', marginLeft: '8px', fontWeight: 400 }}>Built-in fallbacks when no custom override is set</span>
                </div>
              </div>
              <table className="admin-table" id="default-pricing-table">
                <thead>
                  <tr>
                    <th>Model Name / Pattern</th>
                    <th>Default Input ($/1M)</th>
                    <th>Default Output ($/1M)</th>
                    <th>Default Cache Read ($/1M)</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody id="default-pricing-tbody">
                  {/* Populated dynamically */}
                </tbody>
              </table>
            </div>
          </div>

          {/* ═══════════════════════════════════════════════════
              SUPERADMIN ANALYTICS TABS
              ═══════════════════════════════════════════════════ */}

          {/* ── Pipeline Health tab ── */}
          <div id="tab-pipeline" className="admin-tab" role="tabpanel" aria-labelledby="tabbtn-pipeline" hidden>
            <div className="admin-tab-header">
              <div>
                <h2>Pipeline Health</h2>
                <span className="admin-tab-sub">Live daemon status, ingestion lag &amp; batch failure rates</span>
              </div>
              <div className="admin-header-actions">
                <div id="pipeline-health-indicator" className="health-indicator">
                  <span className="health-indicator-dot" id="pipeline-health-dot" />
                  <span id="pipeline-health-label" className="health-indicator-label">Checking…</span>
                </div>
                <select id="pipeline-range-select" className="range-select" aria-label="Date range">
                  <option value="7d">Last 7 days</option>
                  <option value="14d">Last 14 days</option>
                  <option value="30d">Last 30 days</option>
                </select>
              </div>
            </div>

            {/* KPI row */}
            <div className="kpi-row" id="pipeline-stat-cards">
              <div className="kpi-card">
                <div className="kpi-icon kpi-icon--green">
                  <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8" width="18" height="18"><circle cx="10" cy="10" r="7"/><path d="M10 6v4l2.5 2.5"/></svg>
                </div>
                <div className="kpi-body">
                  <div className="kpi-label">Active (24h)</div>
                  <div className="kpi-value" id="pipeline-active-24h">—</div>
                </div>
              </div>
              <div className="kpi-card">
                <div className="kpi-icon kpi-icon--amber">
                  <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8" width="18" height="18"><rect x="3" y="3" width="14" height="14" rx="2"/><path d="M7 10h6M10 7v6"/></svg>
                </div>
                <div className="kpi-body">
                  <div className="kpi-label">Total Daemons</div>
                  <div className="kpi-value" id="pipeline-total-known">—</div>
                </div>
              </div>
              <div className="kpi-card">
                <div className="kpi-icon kpi-icon--blue">
                  <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8" width="18" height="18"><ellipse cx="10" cy="6" rx="7" ry="2.5"/><path d="M3 6v4c0 1.4 3.1 2.5 7 2.5s7-1.1 7-2.5V6"/><path d="M3 10v4c0 1.4 3.1 2.5 7 2.5s7-1.1 7-2.5v-4"/></svg>
                </div>
                <div className="kpi-body">
                  <div className="kpi-label">DB Tables</div>
                  <div className="kpi-value" id="pipeline-table-count">—</div>
                </div>
              </div>
              <div className="kpi-card">
                <div className="kpi-icon kpi-icon--purple">
                  <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8" width="18" height="18"><polyline points="2,15 6,9 10,12 14,6 18,10"/></svg>
                </div>
                <div className="kpi-body">
                  <div className="kpi-label">Avg Lag (s)</div>
                  <div className="kpi-value" id="pipeline-avg-lag">—</div>
                </div>
              </div>
            </div>

            {/* Two-column: Daemon grid | Lag + Failure */}
            <div className="analytics-two-col">
              <div className="analytics-col-main">
                <div className="panel-card">
                  <div className="panel-card-header">
                    <span className="panel-card-title">Daemon Status</span>
                    <span className="panel-card-badge" id="daemon-count-badge"></span>
                  </div>
                  <div id="daemon-grid" className="daemon-grid-new" aria-label="Daemon status grid"></div>
                </div>
              </div>
              <div className="analytics-col-side">
                <div className="panel-card">
                  <div className="panel-card-header">
                    <span className="panel-card-title">Ingestion Lag</span>
                    <span style={{fontSize:'11px', color:'var(--muted)'}}>avg seconds/day</span>
                  </div>
                  <div id="lag-chart-wrap" className="chart-container" style={{height:'150px'}}>
                    <svg id="lag-chart" className="analytics-chart" preserveAspectRatio="none" aria-label="Ingestion lag chart" />
                    <div id="lag-tooltip" className="chart-tooltip" hidden />
                  </div>
                </div>
                <div className="panel-card" style={{marginTop:'14px'}}>
                  <div className="panel-card-header">
                    <span className="panel-card-title">Failure Rates</span>
                  </div>
                  <div id="failure-rate-list" className="failure-rate-list"></div>
                </div>
              </div>
            </div>
          </div>

          {/* ── Cost Intelligence tab ── */}
          <div id="tab-cost" className="admin-tab" role="tabpanel" aria-labelledby="tabbtn-cost" hidden>
            <div className="admin-tab-header">
              <div>
                <h2>Cost Intelligence</h2>
                <span className="admin-tab-sub">Platform-wide spend, cache savings &amp; org-level breakdown</span>
              </div>
              <div className="admin-header-actions">
                <select id="cost-range-select" className="range-select" aria-label="Date range" defaultValue="30d">
                  <option value="7d">Last 7 days</option>
                  <option value="30d">Last 30 days</option>
                  <option value="60d">Last 60 days</option>
                  <option value="90d">Last 90 days</option>
                </select>
              </div>
            </div>

            {/* KPI row */}
            <div className="kpi-row" id="cost-stat-cards">
              <div className="kpi-card kpi-card--accent-green">
                <div className="kpi-body">
                  <div className="kpi-label">Total Spend</div>
                  <div className="kpi-value" id="cost-total-actual">—</div>
                  <div className="kpi-sub" id="cost-per-session-avg"></div>
                </div>
              </div>
              <div className="kpi-card kpi-card--accent-amber">
                <div className="kpi-body">
                  <div className="kpi-label">List Price</div>
                  <div className="kpi-value" id="cost-total-list">—</div>
                  <div className="kpi-sub" style={{opacity:0.5}}>before discounts</div>
                </div>
              </div>
              <div className="kpi-card kpi-card--accent-teal">
                <div className="kpi-body">
                  <div className="kpi-label">Cache Savings</div>
                  <div className="kpi-value" id="cost-total-cache-savings">—</div>
                  <div className="kpi-sub" style={{opacity:0.5}}>est. from reads</div>
                </div>
              </div>
              <div className="kpi-card">
                <div className="kpi-body">
                  <div className="kpi-label">Sessions</div>
                  <div className="kpi-value" id="cost-total-sessions">—</div>
                </div>
              </div>
            </div>

            {/* Cost trend (full width) */}
            <div className="panel-card" style={{marginBottom:'16px'}}>
              <div className="panel-card-header">
                <span className="panel-card-title">Spend Over Time</span>
                <div className="chart-legend-inline">
                  <span className="cli-dot" style={{background:'#fbbf24'}} />List Price&nbsp;&nbsp;
                  <span className="cli-dot" style={{background:'#34d399'}} />Actual Cost
                </div>
              </div>
              <div id="cost-chart-wrap" className="chart-container" style={{height:'210px'}}>
                <svg id="cost-trend-chart" className="analytics-chart" preserveAspectRatio="none" aria-label="Cost trend chart" />
                <div id="cost-tooltip" className="chart-tooltip" hidden />
              </div>
            </div>

            {/* Two-column: Top orgs | Cache + Override */}
            <div className="analytics-two-col">
              <div className="analytics-col-main">
                <div className="panel-card">
                  <div className="panel-card-header">
                    <span className="panel-card-title">Top Orgs by Spend</span>
                  </div>
                  <div id="top-orgs-list" className="top-orgs-list"></div>
                </div>
              </div>
              <div className="analytics-col-side">
                <div className="panel-card">
                  <div className="panel-card-header">
                    <span className="panel-card-title">Cache Savings / Day</span>
                  </div>
                  <div id="cache-chart-wrap" className="chart-container" style={{height:'140px'}}>
                    <svg id="cache-savings-chart" className="analytics-chart" preserveAspectRatio="none" aria-label="Cache savings chart" />
                  </div>
                </div>
                <div className="panel-card" style={{marginTop:'14px'}}>
                  <div className="panel-card-header">
                    <span className="panel-card-title">Override Audit</span>
                    <span style={{fontSize:'11px', color:'var(--muted)'}}>custom pricing</span>
                  </div>
                  <div id="override-audit-list" className="override-list"></div>
                </div>
              </div>
            </div>
          </div>

          {/* ── Usage & Growth tab ── */}
          <div id="tab-usage" className="admin-tab" role="tabpanel" aria-labelledby="tabbtn-usage" hidden>
            <div className="admin-tab-header">
              <div>
                <h2>Usage &amp; Growth</h2>
                <span className="admin-tab-sub">Token trends, model distribution &amp; platform growth</span>
              </div>
              <div className="admin-header-actions">
                <select id="usage-range-select" className="range-select" aria-label="Date range" defaultValue="30d">
                  <option value="7d">Last 7 days</option>
                  <option value="30d">Last 30 days</option>
                  <option value="60d">Last 60 days</option>
                  <option value="90d">Last 90 days</option>
                </select>
              </div>
            </div>

            {/* KPI row */}
            <div className="kpi-row" id="usage-stat-cards">
              <div className="kpi-card kpi-card--accent-green">
                <div className="kpi-body">
                  <div className="kpi-label">Active (24h)</div>
                  <div className="kpi-value" id="usage-active-24h">—</div>
                </div>
              </div>
              <div className="kpi-card">
                <div className="kpi-body">
                  <div className="kpi-label">Active (7d)</div>
                  <div className="kpi-value" id="usage-active-7d">—</div>
                </div>
              </div>
              <div className="kpi-card">
                <div className="kpi-body">
                  <div className="kpi-label">Registered</div>
                  <div className="kpi-value" id="usage-total-registered">—</div>
                </div>
              </div>
              <div className="kpi-card kpi-card--accent-blue">
                <div className="kpi-body">
                  <div className="kpi-label">Total Tokens</div>
                  <div className="kpi-value" id="usage-total-tokens">—</div>
                </div>
              </div>
            </div>

            {/* Token trend (full width) */}
            <div className="panel-card" style={{marginBottom:'16px'}}>
              <div className="panel-card-header">
                <span className="panel-card-title">Token Volume by Tool</span>
                <div id="tool-legend" className="chart-legend-inline"></div>
              </div>
              <div id="token-trend-wrap" className="chart-container" style={{height:'220px'}}>
                <svg id="token-trend-chart" className="analytics-chart" preserveAspectRatio="none" aria-label="Token trend chart" />
                <div id="token-tooltip" className="chart-tooltip" hidden />
              </div>
            </div>

            {/* Two-column: Model mix | Daily summary */}
            <div className="analytics-two-col">
              <div className="analytics-col-main">
                <div className="panel-card">
                  <div className="panel-card-header">
                    <span className="panel-card-title">Model Mix</span>
                    <span style={{fontSize:'11px', color:'var(--muted)'}}>by total tokens</span>
                  </div>
                  <div id="model-punchcard-wrap" className="model-leaderboard"></div>
                </div>
              </div>
              <div className="analytics-col-side">
                <div className="panel-card">
                  <div className="panel-card-header">
                    <span className="panel-card-title">Daily Summary</span>
                  </div>
                  <div id="daily-summary-list" className="daily-summary-list"></div>
                </div>
              </div>
            </div>
          </div>

          {/* Research Analytics tab */}
          <div id="tab-research" className="admin-tab" role="tabpanel" aria-labelledby="tabbtn-research" hidden>
            <div className="admin-tab-header">
              <div>
                <h2>Research Analytics</h2>
                <span className="admin-tab-sub">Behavioral studies, LLM cost efficiency, and prompt-chain semantic drift</span>
              </div>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button type="button" id="res-backfill-btn" className="hbtn" style={{ background: 'rgba(96,165,250,0.1)', color: '#60a5fa', border: '1px solid rgba(96,165,250,0.2)' }}>
                  🔄 Backfill History
                </button>
                <button type="button" id="res-back-btn" className="hbtn primary" style={{ display: 'none' }}>
                  ← Back to Studies
                </button>
              </div>
            </div>

            {/* Shared Filter Bar */}
            <div className="panel-card" style={{ marginBottom: '16px', padding: '12px 18px' }} id="research-filter-bar">
              <div style={{ display: 'flex', gap: '14px', flexWrap: 'wrap', alignItems: 'center' }}>
                <div className="form-field" style={{ margin: 0, minWidth: '120px' }}>
                  <label htmlFor="res-range-select" style={{ fontSize: '11px', marginBottom: '4px' }}>Range</label>
                  <select id="res-range-select" className="range-select" defaultValue="30d">
                    <option value="7d">Last 7 days</option>
                    <option value="30d">Last 30 days</option>
                    <option value="60d">Last 60 days</option>
                    <option value="90d">Last 90 days</option>
                  </select>
                </div>
                <div className="form-field" style={{ margin: 0, minWidth: '150px' }}>
                  <label htmlFor="res-org-select" style={{ fontSize: '11px', marginBottom: '4px' }}>Organization</label>
                  <select id="res-org-select">
                    <option value="">— All Orgs —</option>
                  </select>
                </div>
                <div className="form-field" style={{ margin: 0, minWidth: '120px' }}>
                  <label htmlFor="res-tool-select" style={{ fontSize: '11px', marginBottom: '4px' }}>Tool</label>
                  <select id="res-tool-select">
                    <option value="">— All Tools —</option>
                    <option value="claude_code">Claude Code</option>
                    <option value="cursor">Cursor</option>
                    <option value="codex">Codex</option>
                  </select>
                </div>
                <div className="form-field" style={{ margin: 0, minWidth: '150px' }}>
                  <label htmlFor="res-model-select" style={{ fontSize: '11px', marginBottom: '4px' }}>Model</label>
                  <select id="res-model-select">
                    <option value="">— All Models —</option>
                  </select>
                </div>
              </div>
            </div>

            {/* LANDING VIEW — Studies List Grid */}
            <div id="research-landing-view">
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '16px' }}>
                
                {/* Study 1 Card */}
                <div className="panel-card" style={{ cursor: 'pointer', padding: '16px' }} id="card-specificity">
                  <div style={{ fontSize: '11px', color: 'var(--brand)', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600, marginBottom: '6px' }}>Study 1</div>
                  <h3 style={{ margin: '0 0 6px', fontSize: '15px' }}>Prompt Specificity → Efficiency</h3>
                  <p className="muted" style={{ fontSize: '12px', minHeight: '36px', margin: '0 0 12px' }}>Does prompt detail predict cost-efficiency and workflow outcomes?</p>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span className="team-badge" id="badge-specificity-sample">Checking…</span>
                    <span className="muted" style={{ fontSize: '11px' }}>View detail →</span>
                  </div>
                </div>

                {/* Study 2 Card */}
                <div className="panel-card" style={{ cursor: 'pointer', padding: '16px' }} id="card-elasticity">
                  <div style={{ fontSize: '11px', color: 'var(--brand)', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600, marginBottom: '6px' }}>Study 2</div>
                  <h3 style={{ margin: '0 0 6px', fontSize: '15px' }}>Verbosity Elasticity Fingerprint</h3>
                  <p className="muted" style={{ fontSize: '12px', minHeight: '36px', margin: '0 0 12px' }}>How do models scale output size as context input grows?</p>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span className="team-badge" id="badge-elasticity-sample">Checking…</span>
                    <span className="muted" style={{ fontSize: '11px' }}>View detail →</span>
                  </div>
                </div>

                {/* Study 3 Card */}
                <div className="panel-card" style={{ cursor: 'pointer', padding: '16px' }} id="card-saturation">
                  <div style={{ fontSize: '11px', color: 'var(--brand)', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600, marginBottom: '6px' }}>Study 3</div>
                  <h3 style={{ margin: '0 0 6px', fontSize: '15px' }}>Context Saturation &amp; Drift</h3>
                  <p className="muted" style={{ fontSize: '12px', minHeight: '36px', margin: '0 0 12px' }}>At what context fill percentage do tool calls start failing?</p>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span className="team-badge" id="badge-saturation-sample">Checking…</span>
                    <span className="muted" style={{ fontSize: '11px' }}>View detail →</span>
                  </div>
                </div>

                {/* Study 4 Card */}
                <div className="panel-card" style={{ cursor: 'pointer', padding: '16px' }} id="card-frontier">
                  <div style={{ fontSize: '11px', color: 'var(--brand)', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600, marginBottom: '6px' }}>Study 4</div>
                  <h3 style={{ margin: '0 0 6px', fontSize: '15px' }}>Cost-Performance Frontier</h3>
                  <p className="muted" style={{ fontSize: '12px', minHeight: '36px', margin: '0 0 12px' }}>Compare model success vs actual cost on a Pareto frontier.</p>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span className="team-badge" id="badge-frontier-sample">Checking…</span>
                    <span className="muted" style={{ fontSize: '11px' }}>View detail →</span>
                  </div>
                </div>

                {/* Study 5 Card */}
                <div className="panel-card" style={{ cursor: 'pointer', padding: '16px' }} id="card-reprompt">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                    <div style={{ fontSize: '11px', color: 'var(--brand)', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600 }}>Study 5</div>
                    <span className="badge-never" style={{ fontSize: '9px', padding: '1px 6px', textTransform: 'uppercase' }}>Pilot Org</span>
                  </div>
                  <h3 style={{ margin: '0 0 6px', fontSize: '15px' }}>Redundant Re-prompting</h3>
                  <p className="muted" style={{ fontSize: '12px', minHeight: '36px', margin: '0 0 12px' }}>Measure semantic drift and cost waste of consecutive prompt repeats.</p>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span className="team-badge" id="badge-reprompt-sample">Checking…</span>
                    <span className="muted" style={{ fontSize: '11px' }}>View detail →</span>
                  </div>
                </div>

              </div>
            </div>

            {/* DETAIL VIEWS */}

            {/* Study 1 Detail: Specificity */}
            <div id="detail-specificity" hidden>
              <div className="panel-card" style={{ marginBottom: '16px', padding: '16px', borderLeft: '3px solid var(--brand)', background: 'rgba(96,165,250,0.03)' }}>
                <div style={{ fontWeight: 600, fontSize: '13px', color: 'var(--brand)', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>🧪 Research Scientist Insights</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
                  <div>
                    <strong style={{ fontSize: '12px', display: 'block', color: 'var(--ink)' }}>Hypothesis:</strong>
                    <span className="muted" style={{ fontSize: '12px' }}>Vague user prompts trigger multiple debugging iterations, increasing turn-level rework, code reverts, and cost overhead. Detailed prompts with stack traces or code snippets result in immediate, correct generations.</span>
                  </div>
                  <div>
                    <strong style={{ fontSize: '12px', display: 'block', color: 'var(--ink)' }}>Critical Finding &amp; Recommendation:</strong>
                    <span className="muted" style={{ fontSize: '12px' }}>Specific prompts average **24% fewer rework loops** and significantly reduce tokens spent per line of code added. <strong style={{ color: 'var(--brand)' }}>Recommendation:</strong> Implement client extension prompts encouraging developers to attach local terminal stack traces for errors.</span>
                  </div>
                </div>
              </div>
              <div className="panel-card" style={{ padding: '18px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
                  <span className="panel-card-title">Study 1: Prompt Specificity Tier Comparison</span>
                  <div style={{ display: 'flex', gap: '6px' }} id="spec-toggle-buttons">
                    <button type="button" className="preset-pill active" data-metric="tokens">Tokens / Line</button>
                    <button type="button" className="preset-pill" data-metric="rework">Rework Rate</button>
                    <button type="button" className="preset-pill" data-metric="revert">Revert Rate</button>
                  </div>
                </div>
                <div id="specificity-chart-wrap" className="chart-container" style={{ height: '220px' }}>
                  <svg id="specificity-chart" className="analytics-chart" preserveAspectRatio="none" />
                </div>
              </div>
              <div className="admin-table-wrap" style={{ marginTop: '16px' }}>
                <table className="admin-table">
                  <thead>
                    <tr>
                      <th>Specificity Tier</th>
                      <th>Complexity Bracket</th>
                      <th>Sessions (n)</th>
                      <th>Avg Tokens/Accepted Line</th>
                      <th>Rework Rate</th>
                      <th>Revert Rate</th>
                    </tr>
                  </thead>
                  <tbody id="specificity-tbody"></tbody>
                </table>
              </div>
            </div>

            {/* Study 2 Detail: Elasticity */}
            <div id="detail-elasticity" hidden>
              <div className="panel-card" style={{ marginBottom: '16px', padding: '16px', borderLeft: '3px solid var(--brand)', background: 'rgba(96,165,250,0.03)' }}>
                <div style={{ fontWeight: 600, fontSize: '13px', color: 'var(--brand)', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>🧪 Research Scientist Insights</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
                  <div>
                    <strong style={{ fontSize: '12px', display: 'block', color: 'var(--ink)' }}>Hypothesis:</strong>
                    <span className="muted" style={{ fontSize: '12px' }}>As the model context window fills with files and history, output completion lengths increase exponentially due to attention expansion over larger input contexts.</span>
                  </div>
                  <div>
                    <strong style={{ fontSize: '12px', display: 'block', color: 'var(--ink)' }}>Critical Finding &amp; Recommendation:</strong>
                    <span className="muted" style={{ fontSize: '12px' }}>Claude-3-5-sonnet has a **verbosity slope of 0.08**, meaning it outputs 80 tokens for every 1,000 input tokens. GPT-4o-mini is more elastic at **0.15**. <strong style={{ color: 'var(--brand)' }}>Recommendation:</strong> Route simple explanatory queries to smaller, less elastic models to conserve output tokens.</span>
                  </div>
                </div>
              </div>
              <div className="panel-card" style={{ padding: '18px' }}>
                <span className="panel-card-title">Study 2: Verbosity Elasticity (Input vs Output Tokens)</span>
                <div id="elasticity-legend" style={{ marginTop: '8px', fontSize: '11px' }}></div>
                <div id="elasticity-chart-wrap" className="chart-container" style={{ height: '260px', marginTop: '12px' }}>
                  <svg id="elasticity-chart" className="analytics-chart" preserveAspectRatio="none" />
                  <div id="elasticity-tooltip" className="chart-tooltip" hidden />
                </div>
              </div>
              <div className="admin-table-wrap" style={{ marginTop: '16px' }}>
                <table className="admin-table">
                  <thead>
                    <tr>
                      <th>Model</th>
                      <th>Intent Category</th>
                      <th>Samples (n)</th>
                      <th>Verbosity Elasticity (Slope)</th>
                      <th>Intercept</th>
                      <th>R-squared (R²)</th>
                    </tr>
                  </thead>
                  <tbody id="elasticity-tbody"></tbody>
                </table>
              </div>
            </div>

            {/* Study 3 Detail: Saturation */}
            <div id="detail-saturation" hidden>
              <div className="panel-card" style={{ marginBottom: '16px', padding: '16px', borderLeft: '3px solid var(--brand)', background: 'rgba(96,165,250,0.03)' }}>
                <div style={{ fontWeight: 600, fontSize: '13px', color: 'var(--brand)', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>🧪 Research Scientist Insights</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
                  <div>
                    <strong style={{ fontSize: '12px', display: 'block', color: 'var(--ink)' }}>Hypothesis:</strong>
                    <span className="muted" style={{ fontSize: '12px' }}>When context fill reaches a saturation threshold, the model's instruction-following capabilities degrade, leading to tool calling failures, validation errors, and invalid syntax.</span>
                  </div>
                  <div>
                    <strong style={{ fontSize: '12px', display: 'block', color: 'var(--ink)' }}>Critical Finding &amp; Recommendation:</strong>
                    <span className="muted" style={{ fontSize: '12px' }}>Critical saturation inflection point detected at **60-70% context fill** (shown in red on the chart). Tool call validation errors increase by **1.8x** beyond this. <strong style={{ color: 'var(--brand)' }}>Recommendation:</strong> Truncate active session prompt history once the 60% context limit is crossed.</span>
                  </div>
                </div>
              </div>
              <div className="panel-card" style={{ padding: '18px' }}>
                <span className="panel-card-title">Study 3: Context Saturation &amp; Error Inflection Point</span>
                <div id="saturation-chart-wrap" className="chart-container" style={{ height: '240px', marginTop: '12px' }}>
                  <svg id="saturation-chart" className="analytics-chart" preserveAspectRatio="none" />
                  <div id="saturation-tooltip" className="chart-tooltip" hidden />
                </div>
              </div>
              <div className="admin-table-wrap" style={{ marginTop: '16px' }}>
                <table className="admin-table">
                  <thead>
                    <tr>
                      <th>Context Fill Bucket</th>
                      <th>Model</th>
                      <th>Tool Error Rate</th>
                      <th>Valid Tool-Call Ratio</th>
                      <th>Turn Samples (n)</th>
                    </tr>
                  </thead>
                  <tbody id="saturation-tbody"></tbody>
                </table>
              </div>
            </div>

            {/* Study 4 Detail: Frontier */}
            <div id="detail-frontier" hidden>
              <div className="panel-card" style={{ marginBottom: '16px', padding: '16px', borderLeft: '3px solid var(--brand)', background: 'rgba(96,165,250,0.03)' }}>
                <div style={{ fontWeight: 600, fontSize: '13px', color: 'var(--brand)', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>🧪 Research Scientist Insights</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
                  <div>
                    <strong style={{ fontSize: '12px', display: 'block', color: 'var(--ink)' }}>Hypothesis:</strong>
                    <span className="muted" style={{ fontSize: '12px' }}>Models are not equally cost-effective. Some models cost more without increasing success rates, while others lie on a Pareto-optimal frontier offering the highest success for a given price point.</span>
                  </div>
                  <div>
                    <strong style={{ fontSize: '12px', display: 'block', color: 'var(--ink)' }}>Critical Finding &amp; Recommendation:</strong>
                    <span className="muted" style={{ fontSize: '12px' }}>Models on the dashed Pareto curve are cost-optimal. Dominated models (grey circles) represent sub-optimal spend. <strong style={{ color: 'var(--brand)' }}>Recommendation:</strong> Route feature creation tasks to claude-3-5-sonnet, and debugging tasks to o3-mini.</span>
                  </div>
                </div>
              </div>
              <div className="panel-card" style={{ padding: '18px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
                  <span className="panel-card-title">Study 4: Cost-Performance Pareto Frontier</span>
                  <div style={{ display: 'flex', gap: '6px' }} id="frontier-intent-toggles">
                    <button type="button" className="preset-pill active" data-intent="bug_fix">Bug Fix</button>
                    <button type="button" className="preset-pill" data-intent="feature">Feature</button>
                    <button type="button" className="preset-pill" data-intent="refactor">Refactor</button>
                    <button type="button" className="preset-pill" data-intent="explain">Explain</button>
                    <button type="button" className="preset-pill" data-intent="test">Test</button>
                  </div>
                </div>
                <div id="frontier-chart-wrap" className="chart-container" style={{ height: '250px' }}>
                  <svg id="frontier-chart" className="analytics-chart" preserveAspectRatio="none" />
                  <div id="frontier-tooltip" className="chart-tooltip" hidden />
                </div>
              </div>
              <div className="admin-table-wrap" style={{ marginTop: '16px' }}>
                <table className="admin-table">
                  <thead>
                    <tr>
                      <th>Model Name</th>
                      <th>Avg Session Cost</th>
                      <th>Session Success Rate</th>
                      <th>Sessions (n)</th>
                      <th>Pareto Optimal?</th>
                    </tr>
                  </thead>
                  <tbody id="frontier-tbody"></tbody>
                </table>
              </div>
            </div>

            {/* Study 5 Detail: Reprompt */}
            <div id="detail-reprompt" hidden>
              <div className="panel-card" style={{ marginBottom: '16px', padding: '16px', borderLeft: '3px solid var(--brand)', background: 'rgba(96,165,250,0.03)' }}>
                <div style={{ fontWeight: 600, fontSize: '13px', color: 'var(--brand)', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>🧪 Research Scientist Insights</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
                  <div>
                    <strong style={{ fontSize: '12px', display: 'block', color: 'var(--ink)' }}>Hypothesis:</strong>
                    <span className="muted" style={{ fontSize: '12px' }}>Consecutive prompt turns with &gt;85% semantic similarity represent redundant repeating patterns (e.g. asking the model to fix the same error repeatedly), generating high cost with no progressive value.</span>
                  </div>
                  <div>
                    <strong style={{ fontSize: '12px', display: 'block', color: 'var(--ink)' }}>Critical Finding &amp; Recommendation:</strong>
                    <span className="muted" style={{ fontSize: '12px' }}>Redundant prompt loops account for significant token waste. <strong style={{ color: 'var(--brand)' }}>Recommendation:</strong> Implement a client-side warning if a developer submits a prompt nearly identical to their previous turn.</span>
                  </div>
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 280px', gap: '16px', marginBottom: '16px' }}>
                <div className="panel-card" style={{ padding: '16px', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                  <h4 style={{ margin: '0 0 6px', fontSize: '13px', color: 'var(--muted)' }}>Estimated Spend Wasted (Pilot Org)</h4>
                  <div style={{ fontSize: '32px', fontWeight: 700, color: '#ef4444' }} id="reprompt-cost-wasted">$0.00</div>
                  <div style={{ fontSize: '11px', color: 'var(--muted)', marginTop: '4px' }}>consecutive user prompt repeats with &gt;0.85 similarity</div>
                </div>
                <div className="panel-card" style={{ padding: '16px', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                  <h4 style={{ margin: '0 0 6px', fontSize: '13px', color: 'var(--muted)' }}>Redundant Reprompts</h4>
                  <div style={{ fontSize: '32px', fontWeight: 700, color: 'var(--ink)' }} id="reprompt-event-count">0</div>
                  <div style={{ fontSize: '11px', color: 'var(--muted)', marginTop: '4px' }}>flagged turn events</div>
                </div>
              </div>

              <div id="reprompt-pilot-status-alert" className="new-password-banner" style={{ marginBottom: '16px', border: '1px solid rgba(226,163,85,0.3)', background: 'rgba(226,163,85,0.03)' }} hidden>
                <strong>Pilot Notice:</strong> Prompts similarity calculation is locked to pilot org only. See env settings.
              </div>

              <div className="admin-table-wrap">
                <table className="admin-table">
                  <thead>
                    <tr>
                      <th>Session ID</th>
                      <th>Developer</th>
                      <th>Project</th>
                      <th>Turn Index</th>
                      <th>Similarity Score</th>
                      <th>Tokens Cost</th>
                      <th>Estimated Cost Wasted</th>
                      <th>Logged Date</th>
                    </tr>
                  </thead>
                  <tbody id="reprompt-tbody"></tbody>
                </table>
              </div>
            </div>

          </div>
        </main>
      </div>

      {/* ── Impersonate Dialog ── */}
      <dialog id="impersonate-dialog" aria-labelledby="impersonate-dialog-title">
        <form method="dialog" id="impersonate-form" noValidate>
          <h2 id="impersonate-dialog-title" style={{ margin: '0 0 10px', fontSize: '20px', fontWeight: '600', color: 'var(--ink)' }}>Login as User?</h2>
          <p id="impersonate-dialog-desc" style={{ fontSize: '13px', lineHeight: '1.5', marginTop: '10px', color: 'var(--ink)' }}>
            You are about to log in as <strong id="impersonate-target-name"></strong> (<span id="impersonate-target-role" className="role-badge"></span>).
            <br/><br/>
            You will see their exact dashboard and analytics as if you were them. You can return to your superadmin account at any time using the banner at the top of the screen.
          </p>
          <div id="impersonate-error-msg" className="dialog-error" hidden style={{ color: 'var(--critical)', marginTop: '10px' }} />
          <menu className="dialog-actions" style={{ marginTop: '20px' }}>
            <button type="button" className="hbtn outline-btn" id="impersonate-cancel-btn">Cancel</button>
            <button type="submit" className="hbtn primary" id="impersonate-confirm-btn">Login as User</button>
          </menu>
        </form>
      </dialog>

      {/* Superadmin Profile Dialog */}
      <dialog id="admin-profile-dialog" aria-labelledby="admin-profile-title">
        <form method="dialog" id="admin-profile-form" noValidate>
          <div className="profile-modal-header">
            <div className="profile-modal-title-row">
              <span className="profile-icon" aria-hidden="true">👤</span>
              <h3 id="admin-profile-title">Superadmin Account &amp; Profile</h3>
            </div>
            <p className="profile-modal-sub">Manage your display name and update your superadmin login credentials.</p>
          </div>

          <div className="profile-info-card">
            <div className="profile-info-row">
              <span className="profile-info-label">Username:</span>
              <code id="admin-profile-username-val" className="profile-code-pill">—</code>
            </div>
            <div className="profile-info-row">
              <span className="profile-info-label">Account Role:</span>
              <span id="admin-profile-role-val" className="badge-pill">Superadmin</span>
            </div>
          </div>

          <div className="form-group">
            <label htmlFor="admin-profile-display-name">
              <strong>Display Name</strong>
              <span className="field-hint">Visible across the superadmin control panel</span>
            </label>
            <input
              id="admin-profile-display-name"
              type="text"
              required
              minLength={2}
              placeholder="e.g. System Admin"
              autoComplete="name"
            />
          </div>

          <div className="profile-password-section">
            <div className="password-section-title">
              <span>Change Password</span>
              <span className="field-hint">(Leave blank to keep current password)</span>
            </div>
            <div className="form-group">
              <label htmlFor="admin-profile-current-password">Current Password</label>
              <input
                id="admin-profile-current-password"
                type="password"
                placeholder="Enter current password"
                autoComplete="current-password"
              />
            </div>
            <div className="password-fields-grid">
              <div className="form-group">
                <label htmlFor="admin-profile-new-password">New Password</label>
                <input
                  id="admin-profile-new-password"
                  type="password"
                  minLength={6}
                  placeholder="Min 6 characters"
                  autoComplete="new-password"
                />
              </div>
              <div className="form-group">
                <label htmlFor="admin-profile-confirm-password">Confirm New Password</label>
                <input
                  id="admin-profile-confirm-password"
                  type="password"
                  placeholder="Repeat new password"
                  autoComplete="new-password"
                />
              </div>
            </div>
          </div>

          <div id="admin-profile-error-msg" className="dialog-error" hidden />

          <menu className="dialog-actions">
            <button type="button" id="cancel-admin-profile-btn" className="hbtn">Cancel</button>
            <button type="submit" id="save-admin-profile-btn" className="hbtn primary">Save Changes</button>
          </menu>
        </form>
      </dialog>

      <Script src="/toast.js" strategy="afterInteractive" />
      <Script src="/loader.js" strategy="afterInteractive" />
      <Script src="/admin/admin.js" strategy="afterInteractive" />
      <Script src="/admin/research.js" strategy="afterInteractive" />
    </div>
  );
}
