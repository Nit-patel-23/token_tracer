import Script from 'next/script';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { getSessionFromCookie } from '@/lib/auth';

/**
 * Personal dashboard page (/).
 * Auth check + onboarding panel are handled client-side in app.js.
 */
export default async function PersonalDashboardPage() {
  const cookieStore = await cookies();
  const session = getSessionFromCookie(cookieStore.toString());

  if (!session) {
    redirect('/login');
  }

  if (session.role === 'admin') {
    redirect('/team');
  }

  if (session.role === 'superadmin') {
    redirect('/admin');
  }

  return (
    <div suppressHydrationWarning>
      {/* ── Onboarding overlay (shown when user has 0 sessions) ── */}
      <div id="onboarding" className="onboarding-overlay" hidden>
        <div className="onboarding-card">
          <div className="onboarding-header">
            <div className="wordmark">
              <h2>Welcome!</h2>
              <span className="eyebrow">Set up your sync agent</span>
            </div>
          </div>
          <p className="onboarding-intro">
            To see your AI usage stats here, install the background sync agent on your computer.
            It runs silently and sends only anonymised aggregates — no prompts or code ever leave your machine.
          </p>

          {/* OS picker */}
          <div id="os-picker" className="os-picker" role="tablist" aria-label="Operating system">
            <button type="button" id="os-mac" className="os-btn active" data-os="mac" role="tab" aria-selected="true">
              🍎 Mac
            </button>
            <button type="button" id="os-win" className="os-btn" data-os="win" role="tab" aria-selected="false">
              🪟 Windows
            </button>
          </div>

          {/* Mac command */}
          <div id="cmd-mac" className="cmd-block">
            <label className="cmd-label">Run this in Terminal:</label>
            <div className="cmd-row">
              <code id="cmd-mac-text" className="cmd-text">Loading…</code>
              <button type="button" className="copy-btn" id="copy-mac" title="Copy command">Copy</button>
            </div>
          </div>

          {/* Windows command */}
          <div id="cmd-win" className="cmd-block" hidden>
            <label className="cmd-label">Run this in PowerShell:</label>
            <div className="cmd-row">
              <code id="cmd-win-text" className="cmd-text">Loading…</code>
              <button type="button" className="copy-btn" id="copy-win" title="Copy command">Copy</button>
            </div>
          </div>

          <p className="onboarding-footer muted">
            Once installed, refresh this page in a few minutes and your sessions will appear.
          </p>
        </div>
      </div>

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
