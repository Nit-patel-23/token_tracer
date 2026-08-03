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
          </nav>
          <div className="sidebar-footer">
            <span id="admin-user-name" className="muted" />
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
                      {Array.from({ length: 8 }).map((_, j) => (
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
            <div className="admin-table-wrap">
              <table className="admin-table">
                <thead>
                  <tr><th>Display Name</th><th>Team</th><th>Status</th></tr>
                </thead>
                <tbody id="members-tbody" aria-busy="true">
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
        </main>
      </div>

      <Script src="/toast.js" strategy="afterInteractive" />
      <Script src="/loader.js" strategy="afterInteractive" />
      <Script src="/admin/admin.js" strategy="afterInteractive" />
    </div>
  );
}
