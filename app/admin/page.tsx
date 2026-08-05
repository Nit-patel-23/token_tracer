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
        {/* Mobile-only topbar: shown under 880px, hosts the hamburger toggle */}
        <div className="mobile-topbar">
          <button type="button" id="admin-nav-toggle" className="mobile-nav-toggle" aria-label="Toggle menu" aria-expanded="false" aria-controls="admin-sidebar-nav">
            <span></span><span></span><span></span>
          </button>
          <div className="wordmark">
            <h1>admin</h1>
          </div>
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
          </nav>
          <div className="sidebar-footer">
            <button type="button" id="admin-profile-btn" className="hbtn sidebar-profile-btn" title="Account & Profile Settings">
              <span className="profile-btn-icon" aria-hidden="true">👤</span>
              <span id="admin-user-name" className="muted">Profile</span>
            </button>
            <button id="admin-logout-btn" className="hbtn" title="Sign out">Sign out</button>
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

            {/* Create / edit user form */}
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

            {/* Users table */}
            <div className="admin-table-wrap">
              <table className="admin-table" id="users-table">
                <thead>
                  <tr>
                    <th>Username</th>
                    <th>Display Name</th>
                    <th>Role</th>
                    <th>Teams</th>
                    <th>Member</th>
                    <th>Sessions</th>
                    <th>Last Login</th>
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody id="users-tbody" aria-busy="true">
                  {[0, 1, 2, 3].map((i) => (
                    <tr key={i} aria-hidden="true">
                      {Array.from({ length: 9 }).map((_, j) => (
                        <td key={j}><div className="skeleton" style={{ height: '14px', width: j === 0 ? '80%' : '60%' }} /></td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* New password banner */}
            <div id="new-password-banner" className="new-password-banner" hidden>
              <strong>New password:</strong>
              <code id="new-password-value" />
              <span className="muted">— copy it now, it won't be shown again.</span>
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

            {/* Edit member form */}
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

            {/* Create / Edit team form */}
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

            {/* Create / Edit pricing rule form */}
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

            {/* Custom Pricing Table */}
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

            {/* System Baseline Rates Reference Table */}
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
        </main>
      </div>

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
    </div>
  );
}
