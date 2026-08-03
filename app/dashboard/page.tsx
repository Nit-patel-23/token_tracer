import Script from 'next/script';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { getSessionFromCookie } from '@/lib/auth';

/**
 * Personal dashboard page (/dashboard).
 * Auth check + onboarding panel are handled client-side in app.js.
 */
export default async function PersonalDashboardPage() {
  const cookieStore = await cookies();
  const session = getSessionFromCookie(cookieStore.toString());

  if (!session) {
    redirect('/');
  }

  if (session.role === 'admin') {
    redirect('/team');
  }

  if (session.role === 'superadmin') {
    redirect('/admin');
  }

  return (
    <div suppressHydrationWarning>


      {/* ── Main dashboard ── */}
      <header>
        <div className="wordmark">
          <h1>visualisation</h1>
          <span className="eyebrow">Dashboard</span>
        </div>
        <div id="seg" role="tablist" aria-label="Agent source" suppressHydrationWarning />
        <div id="range" aria-label="Date range" suppressHydrationWarning>
          <div id="range-presets" role="tablist" aria-label="Date presets" suppressHydrationWarning />
          <label className="range-field">From<input id="range-from" type="date" /></label>
          <label className="range-field">To<input id="range-to" type="date" /></label>
        </div>
        <div id="roots" suppressHydrationWarning>scanning…</div>
        <div className="header-user" id="header-user" suppressHydrationWarning>
          <span id="user-name" className="user-name" />
          <button id="logout-btn" className="hbtn" title="Sign out">Sign out</button>
        </div>
        <button id="wrapped-btn" className="hbtn" title="Your usage, as a story">✦ Wrapped</button>
        <button id="refresh" className="hbtn" title="Rescan session files">↻ Refresh</button>
      </header>
      <div className="layout">
        <div id="data-loading" className="data-loading" hidden aria-busy="true"></div>
        <nav id="tree" aria-label="Session spawn tree" suppressHydrationWarning>
          <div className="app-loading-hero" style={{ margin: '8px', minHeight: '120px', padding: '18px 12px' }}>
            <div className="tt-loader tt-loader--sm" role="status">
              <div className="tt-loader-orbit" aria-hidden="true">
                <div className="tt-loader-ring" />
                <div className="tt-loader-ring tt-loader-ring--inner" />
                <div className="tt-loader-core">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 3v3M12 18v3M3 12h3M18 12h3" />
                    <circle cx="12" cy="12" r="4" />
                  </svg>
                </div>
              </div>
              <p className="tt-loader-label">Scanning…</p>
            </div>
          </div>
          <div className="skeleton skeleton-tree-item" style={{ width: '85%' }} />
          <div className="skeleton skeleton-tree-item" style={{ width: '70%' }} />
          <div className="skeleton skeleton-tree-item" style={{ width: '78%' }} />
        </nav>
        <main id="main" aria-busy="true" suppressHydrationWarning>
          <div className="app-loading-hero">
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
              <p className="tt-loader-label">Tracing <em>your</em> tokens…</p>
            </div>
          </div>
          <div className="skeleton-cards" aria-hidden="true">
            <div className="skeleton-stat"><div className="skeleton" /><div className="skeleton" /></div>
            <div className="skeleton-stat"><div className="skeleton" /><div className="skeleton" /></div>
            <div className="skeleton-stat"><div className="skeleton" /><div className="skeleton" /></div>
            <div className="skeleton-stat"><div className="skeleton" /><div className="skeleton" /></div>
          </div>
          <div className="skeleton-panel" aria-hidden="true">
            <div className="skeleton skeleton-title" />
            <div className="skeleton skeleton-row" style={{ height: '160px' }} />
          </div>
          <span className="visually-hidden">Loading your dashboard…</span>
        </main>
      </div>
      <div id="tooltip" role="presentation" />
      <Script src="/toast.js" strategy="afterInteractive" />
      <Script src="/loader.js" strategy="afterInteractive" />
      <Script src="/app.js" strategy="afterInteractive" />
    </div>
  );
}
