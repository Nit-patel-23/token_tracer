/**
 * Team admin dashboard page (/team).
 * Renders the full standalone HTML shell for the team analytics UI.
 * Requires ADMIN_PASSWORD and DATABASE_URL environment variables.
 */
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Team Analytics — Visualisation Dashboard',
  description: 'Team-level agent analytics dashboard — leaderboard, cost breakdown, and session statistics for your engineering team.',
};

export default function TeamDashboardPage() {
  return (
    <>
      <html lang="en">
        <head>
          <meta charSet="utf-8" />
          <meta name="viewport" content="width=device-width, initial-scale=1" />
          <title>Team Analytics — Visualisation Dashboard</title>
          <meta
            name="description"
            content="Team-level agent analytics dashboard — leaderboard, cost breakdown, and session statistics."
          />
          <link rel="stylesheet" href="/style.css" />
          <link rel="stylesheet" href="/team/team.css" />
        </head>
        <body>
          <div id="login-screen" className="team-login">
            <form id="login-form">
              <h1>Team analytics</h1>
              <p className="muted">Admin login — personal dashboard is at <code>/</code></p>
              <label>
                Password
                <input id="login-password" type="password" autoComplete="current-password" required />
              </label>
              <button type="submit" className="hbtn primary" id="login-submit">Sign in</button>
              <p id="login-error" className="error" hidden></p>
            </form>
          </div>

          <div id="app" hidden>
            <header className="team-header">
              <div className="wordmark">
                <h1>team</h1>
                <span className="eyebrow">Analytics</span>
              </div>
              <select id="team-select" aria-label="Team"></select>
              <div id="range-presets" className="range-presets" role="tablist"></div>
              <label className="range-field">From<input id="range-from" type="date" /></label>
              <label className="range-field">To<input id="range-to" type="date" /></label>
              <button id="refresh" className="hbtn" title="Refresh stats">↻</button>
            </header>

            <main className="team-main">
              <div id="app-error" className="app-error" hidden></div>
              <div id="app-loading" className="app-loading" hidden>Loading team data…</div>
              <div id="app-content">
                <section className="cards" id="totals"></section>

                <section className="panel">
                  <h2>Leaderboard</h2>
                  <div id="leaderboard" className="table-wrap"></div>
                </section>

                <div className="grid-2">
                  <section className="panel">
                    <h2>By source</h2>
                    <div id="by-source"></div>
                  </section>
                  <section className="panel">
                    <h2>By day</h2>
                    <div id="by-day"></div>
                  </section>
                </div>

                <div className="grid-2">
                  <section className="panel">
                    <h2>Top tools</h2>
                    <div id="top-tools"></div>
                  </section>
                  <section className="panel">
                    <h2>Top files</h2>
                    <div id="top-files"></div>
                  </section>
                </div>

                <section className="panel">
                  <div className="panel-head">
                    <h2>Members</h2>
                    <button id="add-member-btn" className="hbtn">+ Add member</button>
                  </div>
                  <div id="members" className="table-wrap"></div>
                  <p id="new-key" className="key-banner" hidden></p>
                </section>
              </div>
            </main>
          </div>

          <dialog id="add-member-dialog">
            <form method="dialog" id="add-member-form">
              <h3>Add member</h3>
              <label>Display name<input id="member-name" required /></label>
              <menu>
                <button type="button" id="cancel-member" className="hbtn">Cancel</button>
                <button type="submit" className="hbtn primary">Create + API key</button>
              </menu>
            </form>
          </dialog>

          <script src="/team/app.js"></script>
        </body>
      </html>
    </>
  );
}
