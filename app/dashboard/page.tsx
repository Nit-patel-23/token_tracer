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
        <nav id="tree" aria-label="Session spawn tree" suppressHydrationWarning />
        <main id="main" suppressHydrationWarning />
      </div>
      <div id="tooltip" role="presentation" />
      <Script src="/app.js" strategy="afterInteractive" />
    </div>
  );
}
