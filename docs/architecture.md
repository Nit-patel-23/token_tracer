# Architecture

Token Tracer is a **hybrid Next.js application**: App Router for routing + APIs, and vanilla JS dashboards for interactive analytics UIs.

```text
┌─────────────┐     cookie / fetch      ┌──────────────────┐
│  Browser UI │ ───────────────────────▶│  Next.js API     │
│  public/*.js│                         │  app/api/**      │
└─────────────┘                         └────────┬─────────┘
                                                 │
                                    ┌────────────▼────────────┐
                                    │  lib/ (domain layer)    │
                                    │  auth · team · ingest   │
                                    └────────────┬────────────┘
                                                 │
                                    ┌────────────▼────────────┐
                                    │  Postgres (Neon / self) │
                                    └─────────────────────────┘

Local machine (optional)
┌──────────────────────┐    Bearer API key     ┌─────────────┐
│ sync daemon (bin/)   │ ─────────────────────▶│ /api/v1/    │
│ + agent adapters     │                       │ ingest      │
└──────────────────────┘                       └─────────────┘
```

## Roles

| Role         | Access                                               |
| ------------ | ---------------------------------------------------- |
| `user`       | Personal dashboard (`/dashboard`), own sessions      |
| `admin`      | Team dashboard (`/team`), scoped to `session.teamId` |
| `superadmin` | Admin panel (`/admin`), all users/teams              |

Authorization for team APIs uses `getAuthorizedTeamId()` in `lib/auth.ts`.

**Admins never take `teamId` from the client** — only from their session.

## Frontend

Pages under `app/**/page.tsx` render structure (sidebar, filters, panels) and load scripts:

- `public/app.js` — personal dashboard
- `public/team/app.js` — team analytics
- `public/admin/admin.js` — superadmin
- Shared: `toast.js`, `loader.js`, CSS design tokens

This is intentional for performance and to avoid a premature React rewrite of dense analytics tables.

## Backend modules

| Path                             | Responsibility                         |
| -------------------------------- | -------------------------------------- |
| `lib/auth.ts`                    | Sessions, passwords, team authz helper |
| `lib/team/db.ts`                 | `pg` pool                              |
| `lib/team/env.ts`                | Env loading + production secret rules  |
| `lib/team/stats.ts`              | Analytics SQL + member CRUD            |
| `lib/team/ingest.ts`             | Session upsert + pricing               |
| `lib/team/auth.ts`               | API keys + legacy admin token          |
| `lib/api/http.ts`                | Shared JSON response helpers           |
| `lib/adapters.mjs`               | Local agent transcript discovery       |
| `lib/scan.mjs` / `analytics.mjs` | Personal local mode                    |

## Data flow (team)

1. Daemon scans local agent state dirs
2. POSTs sanitized sessions to `/api/v1/ingest` with member API key
3. Rows land in `sync_sessions` (+ related events)
4. Team UI calls `/api/v1/team/stats` with date/member/source filters
5. `buildTeamStats()` returns rollups for cards, tables, bars

## Security notes

See [SECURITY.md](../SECURITY.md). Highlights:

- Parameterized SQL only
- Production requires `SESSION_SECRET`
- Legacy admin tokens opt-in via `ALLOW_LEGACY_ADMIN_TOKEN`
- Escape user strings in `innerHTML` paths (`esc()`)
