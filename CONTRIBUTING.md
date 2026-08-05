# Contributing to Token Tracer

Thanks for helping make Token Tracer better. This guide gets you from zero to a useful PR quickly.

## Development setup

### Prerequisites

- Node.js **20+**
- npm **10+**
- A Postgres database (local or [Neon](https://neon.tech))

### Install

```bash
git clone https://github.com/Nit-patel-23/token_tracer.git
cd token_tracer
npm install
cp .env.example .env.local
```

Fill in `.env.local` (see [docs/configuration.md](docs/configuration.md)).

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### First-time database

1. Sign in as superadmin (`SUPERADMIN_PASSWORD` from env, username `superadmin`)
2. Open **Admin → Users**
3. Run **Database migration** if prompted
4. Create admin/user accounts as needed

## Project model (important)

Token Tracer is a **hybrid** app:

| Layer          | Location               | Notes                                   |
| -------------- | ---------------------- | --------------------------------------- |
| Next.js shells | `app/**/page.tsx`      | Thin HTML structure + Script tags       |
| Client UI      | `public/**/*.js` + CSS | Vanilla JS dashboards                   |
| API            | `app/api/**`           | Next Route Handlers                     |
| Domain logic   | `lib/**`               | Auth, DB, stats, ingest, local adapters |

Please prefer improving the existing architecture over a full React rewrite unless the PR is explicitly scoped for that migration.

## Scripts

| Command             | Purpose                     |
| ------------------- | --------------------------- |
| `npm run dev`       | Start Next.js (Turbopack)   |
| `npm run build`     | Production build            |
| `npm run start`     | Serve production build      |
| `npm run lint`      | ESLint                      |
| `npm run typecheck` | TypeScript (`tsc --noEmit`) |
| `npm run format`    | Prettier write              |
| `npm run check`     | typecheck + lint + build    |

## Pull requests

1. Create a focused branch: `fix/…`, `feat/…`, `docs/…`, `chore/…`
2. Keep PRs small and reviewable
3. Update docs when behavior or env vars change
4. Ensure `npm run check` passes
5. Fill out the PR template

### Commit style

Prefer Conventional Commits:

```
feat: add member model usage empty state
fix: parameterize member filter SQL
docs: expand configuration guide
chore: add CI workflow
```

## Code guidelines

- **TypeScript** for new server/lib code (`strict` is on)
- **No secrets** in commits
- Escape any user-controlled string rendered via `innerHTML`
- Prefer parameterized SQL (`$1`, `$2`, …) — never string-interpolate IDs
- Reuse `lib/api/http.ts` helpers for new API routes when practical
- Match existing visual language (CSS variables in `public/style.css`)

## Reporting bugs

Use the Bug Report issue template. Include:

- Reproduction steps
- Expected vs actual behavior
- Browser / Node / OS versions
- Whether personal, team, or admin surface is affected

## Feature requests

Use the Feature Request template. Describe the problem first, then the proposed solution.

## Security

See [SECURITY.md](SECURITY.md). Never disclose vulnerabilities in public issues.
