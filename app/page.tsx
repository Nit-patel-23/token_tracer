/**
 * Personal dashboard page (/).
 * Embeds personal mode components.
 */
export default function PersonalDashboardPage() {
  return (
    <>
      <header>
        <div className="wordmark">
          <h1>visualisation</h1>
          <span className="eyebrow">Dashboard</span>
        </div>
        <div id="seg" role="tablist" aria-label="Agent source"></div>
        <div id="range" aria-label="Date range">
          <div id="range-presets" role="tablist" aria-label="Date presets"></div>
          <label className="range-field">From<input id="range-from" type="date" /></label>
          <label className="range-field">To<input id="range-to" type="date" /></label>
        </div>
        <div id="roots">scanning…</div>
        <button id="wrapped-btn" className="hbtn" title="Your usage, as a story">✦ Wrapped</button>
        <button id="refresh" className="hbtn" title="Rescan session files">↻ Refresh</button>
      </header>
      <div className="layout">
        <nav id="tree" aria-label="Session spawn tree"></nav>
        <main id="main"></main>
      </div>
      <div id="tooltip" role="presentation"></div>
      <script src="/app.js"></script>
    </>
  );
}
