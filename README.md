<p align="center">
  <img src="docs/assets/logo.svg" alt="Token Tracer" width="72" height="72" />
</p>

<h1 align="center">Token Tracer</h1>

<p align="center">
  <strong>AI token analytics for developers and teams.</strong><br/>
  Monitor LLM usage, API costs, model mix, and coding agent activity across Claude Code, Cursor, Codex, and more.
</p>

<p align="center">
  <a href="#features"><img src="https://img.shields.io/badge/features-analytics%20%7C%20costs%20%7C%20teams-e2a355?style=flat-square" alt="Features" /></a>
  <a href="LICENSE"><img src="https://img.shields.io/badge/license-MIT-0ca30c?style=flat-square" alt="MIT License" /></a>
  <a href="https://nextjs.org"><img src="https://img.shields.io/badge/Next.js-16-black?style=flat-square&logo=next.js" alt="Next.js" /></a>
  <a href="#quick-start"><img src="https://img.shields.io/badge/node-%3E%3D20-3987e5?style=flat-square&logo=node.js&logoColor=white" alt="Node 20+" /></a>
</p>

<p align="center">
  <a href="#quick-start">Quick Start</a> ·
  <a href="docs/configuration.md">Configuration</a> ·
  <a href="docs/architecture.md">Architecture</a> ·
  <a href="CONTRIBUTING.md">Contributing</a> ·
  <a href="SECURITY.md">Security</a>
</p>

---

## Why Token Tracer?

AI coding agents burn tokens fast — and most teams have no shared view of **who**, **which model**, **which repo**, or **how much it costs**.

Token Tracer gives you:

- **Personal dashboard** — local session intelligence from your machine
- **Team analytics** — members, leaderboards, projects, file impact, session logs
- **Cost controls** — custom model pricing + recalculated API-equivalent spend
- **Ingest daemon** — sync agent sessions to your server with a one-line install

Built for developers who want clarity without selling their data to another SaaS silo.

---

## Features

- 📊 **Usage analytics** — tokens in/out/cache, sessions, edits, lines changed
- 💰 **Cost estimation** — per-model pricing rules ($ / 1M tokens)
- 👥 **Team workspace** — member keys, roles, sync triggers
- 🏆 **Leaderboards & head-to-head** — efficiency scoreboards
- 📁 **Project & file impact** — see where agents touch the codebase
- 🔐 **Role-based access** — `user` · `admin` · `superadmin`
- 📱 **Mobile-ready UI** — off-canvas nav, SaaS-style filters, branded loaders
- 🧩 **Multi-agent adapters** — Claude Code, Cursor, Codex, Hermes, and more

---

## Screenshots

> Add product screenshots under `docs/assets/` and link them here before public launch.

| Personal      | Team Overview | Admin         |
| ------------- | ------------- | ------------- |
| _Coming soon_ | _Coming soon_ | _Coming soon_ |

---

## Quick Start

### 1. Clone & install

```bash
git clone https://github.com/Nit-patel-23/token_tracer.git
cd token_tracer
npm install
cp .env.example .env.local
```

### 2. Configure environment

Edit `.env.local`:

```bash
DATABASE_URL=postgresql://...
SESSION_SECRET=$(openssl rand -base64 48)
ADMIN_PASSWORD=change-me
SUPERADMIN_PASSWORD=change-me-too
NEXT_PUBLIC_SERVER_URL=http://localhost:3000
```

See the full list in [docs/configuration.md](docs/configuration.md).

### 3. Run

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

| Role       | Username          | Password source        |
| ---------- | ----------------- | ---------------------- |
| Superadmin | `superadmin`      | `SUPERADMIN_PASSWORD`  |
| Team admin | `admin` / DB user | `ADMIN_PASSWORD` or DB |
| Member     | DB user           | created in Admin       |

### 4. Migrate schema

Sign in as **superadmin** → **Admin → Users** → run **Database migration** if prompted.

---

## Install the sync daemon

After creating a user/member with an API key:

**macOS / Linux**

```bash
curl -fsSL "$NEXT_PUBLIC_SERVER_URL/install.sh" | bash -s -- --key av_live_YOUR_KEY
```

**Windows (PowerShell)**

```powershell
$ApiKey="av_live_YOUR_KEY"; iex (irm "$env:NEXT_PUBLIC_SERVER_URL/install.ps1")
```

---

## Project structure

```text
token_tracer/
├── app/                 # Next.js App Router (pages + API routes)
│   ├── api/             # REST handlers (auth, team, ingest, admin)
│   ├── dashboard/       # Personal analytics shell
│   ├── team/            # Team analytics shell
│   └── admin/           # Superadmin shell
├── lib/                 # Server domain logic
│   ├── api/             # Shared HTTP helpers
│   ├── team/            # DB, stats, ingest, schema, env
│   ├── auth.ts          # Session auth
│   └── *.mjs            # Local agent adapters / scanners
├── public/              # Vanilla JS + CSS UI (primary frontend)
├── bin/                 # Daemon CLI helpers
├── docs/                # Architecture & guides
└── .github/             # Issues, PR template, CI
```

> **Note:** The interactive dashboards are intentionally **vanilla JS + CSS** loaded by thin Next.js pages. This keeps the UI fast and portable. A React component migration is optional future work — see [ROADMAP.md](ROADMAP.md).

---

## Scripts

| Command             | Description                    |
| ------------------- | ------------------------------ |
| `npm run dev`       | Development server (Turbopack) |
| `npm run build`     | Production build               |
| `npm run start`     | Start production server        |
| `npm run lint`      | ESLint                         |
| `npm run typecheck` | TypeScript check               |
| `npm run format`    | Prettier                       |
| `npm run check`     | typecheck + lint + build       |

---

## Documentation

- [Configuration](docs/configuration.md)
- [Architecture](docs/architecture.md)
- [API overview](docs/api.md)
- [Deployment](docs/deployment.md)
- [FAQ](docs/faq.md)
- [Contributing](CONTRIBUTING.md)
- [Security](SECURITY.md)
- [Roadmap](ROADMAP.md)
- [Changelog](CHANGELOG.md)

---

## Tech stack

- **Next.js 16** (App Router) + React 19 (shell pages)
- **TypeScript** (server / lib)
- **Postgres** via `pg` (Neon-friendly)
- **Vanilla JS + CSS** dashboards (`public/`)
- **bcryptjs** + HMAC cookie sessions

---

## Contributing

We welcome issues and PRs. Start with [CONTRIBUTING.md](CONTRIBUTING.md) and the [Code of Conduct](CODE_OF_CONDUCT.md).

Good first contributions:

- Documentation & examples
- Accessibility improvements
- Tests for `lib/team/*`
- Adapter coverage for new agents

---

## Roadmap

See [ROADMAP.md](ROADMAP.md) for near-term and longer-term plans (OpenAPI, tests, React migration path, SSO, etc.).

---

## License

[MIT](LICENSE) © Token Tracer contributors

---

## Acknowledgements

Inspired by the DX and polish of projects like [shadcn/ui](https://ui.shadcn.com), [Supabase](https://supabase.com), [Dub.co](https://dub.co), and [Trigger.dev](https://trigger.dev) — thank you to the open-source community.
