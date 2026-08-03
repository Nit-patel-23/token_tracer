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
          <nav className="admin-sidebar-nav">
            <button type="button" className="tab-btn active" data-tab="tab-users">
              <span className="nav-icon">👥</span> Users
            </button>
            <button type="button" className="tab-btn" data-tab="tab-members">
              <span className="nav-icon">🔗</span> Members
            </button>
          </nav>
          <div className="sidebar-footer">
            <span id="admin-user-name" className="muted" />
            <button id="admin-logout-btn" className="hbtn" title="Sign out">Sign out</button>
          </div>
        </aside>

        <main className="admin-content">
          {/* Users tab */}
          <div id="tab-users" className="admin-tab active-tab">
            <div className="admin-tab-header">
              <h2>Users</h2>
              <div style={{ display: 'flex', gap: '10px' }}>
                <button type="button" className="hbtn primary" id="migrate-btn" style={{ background: '#e27355', display: 'none' }}>⚠️ Run Database Migration</button>
                <button type="button" className="hbtn primary" id="create-user-btn">+ Add User</button>
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
                  <div className="form-field" id="field-uf-team">
                    <label htmlFor="uf-team">Linked Team (for Admins)</label>
                    <select id="uf-team">
                      <option value="">— none —</option>
                      <option value="new">— create new team —</option>
                    </select>
                  </div>
                  <div className="form-field" id="field-uf-new-team" style={{ display: 'none' }}>
                    <label htmlFor="uf-new-team">New Team Name</label>
                    <input id="uf-new-team" type="text" placeholder="e.g. India Developers" />
                  </div>
                </div>
                <div className="form-actions">
                  <button type="submit" className="hbtn primary" id="uf-submit">Save</button>
                  <button type="button" className="hbtn" id="uf-cancel">Cancel</button>
                  <p id="uf-error" className="error" hidden />
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
                <tbody id="users-tbody">
                  <tr><td colSpan={8} className="muted">Loading…</td></tr>
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
          <div id="tab-members" className="admin-tab" hidden>
            <div className="admin-tab-header">
              <h2>Members (unlinked to any user)</h2>
            </div>
            <div className="admin-table-wrap">
              <table className="admin-table">
                <thead>
                  <tr><th>Display Name</th><th>Team</th><th>Status</th></tr>
                </thead>
                <tbody id="members-tbody">
                  <tr><td colSpan={3} className="muted">Loading…</td></tr>
                </tbody>
              </table>
            </div>
          </div>
        </main>
      </div>

      <Script src="/admin/admin.js" strategy="afterInteractive" />
    </div>
  );
}
