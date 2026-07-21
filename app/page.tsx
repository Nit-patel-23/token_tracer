import Script from 'next/script';

/**
 * Personal dashboard page (/).
 * Embeds personal mode components.
 */
export default function PersonalDashboardPage() {
  return (
    <div suppressHydrationWarning>
      <header>
        <div className="wordmark">
          <h1>visualisation</h1>
          <span className="eyebrow">Dashboard</span>
        </div>
        <div id="seg" role="tablist" aria-label="Agent source" suppressHydrationWarning></div>
        <div id="range" aria-label="Date range" suppressHydrationWarning>
          <div id="range-presets" role="tablist" aria-label="Date presets" suppressHydrationWarning></div>
          <label className="range-field">From<input id="range-from" type="date" /></label>
          <label className="range-field">To<input id="range-to" type="date" /></label>
        </div>
        <div id="roots" suppressHydrationWarning>scanning…</div>
        <button id="wrapped-btn" className="hbtn" title="Your usage, as a story">✦ Wrapped</button>
        <button id="refresh" className="hbtn" title="Rescan session files">↻ Refresh</button>
      </header>
      <div className="layout">
        <nav id="tree" aria-label="Session spawn tree" suppressHydrationWarning></nav>
        <main id="main" suppressHydrationWarning></main>
      </div>
      <div id="tooltip" role="presentation"></div>
      <Script src="/app.js" strategy="afterInteractive" />
    </div>
  );
}
