/**
 * Personal dashboard page (/).
 * Renders the full standalone HTML shell that loads the vanilla JS frontend.
 * The JS talks to /api/state, /api/stats, /api/session.
 *
 * NOTE: On Vercel deployments the personal dashboard API endpoints
 * will return 503 (no local filesystem). Run `npm run dev` locally for
 * full personal mode.
 */
export default function PersonalDashboardPage() {
  return (
    <>
      <html lang="en">
        <head>
          <meta charSet="utf-8" />
          <meta name="viewport" content="width=device-width, initial-scale=1" />
          <title>Visualisation Dashboard — cross-agent intelligence</title>
          <meta
            name="description"
            content="Cross-agent intelligence dashboard for Claude Code, Codex, Cursor, OpenClaw, and Hermes — API-equivalent cost, code impact, workflow quality, and read-only session trajectories."
          />
          <link rel="stylesheet" href="/style.css" />
          {/* eslint-disable-next-line @next/next/no-page-custom-font */}
          <link rel="icon" href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90'>📊</text></svg>" />
        </head>
        <body>
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
        </body>
      </html>
    </>
  );
}
