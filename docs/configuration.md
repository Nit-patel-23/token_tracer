# Configuration

## Environment variables

Copy the example file:

```bash
cp .env.example .env.local
```

### Required

| Variable              | Description                                          |
| --------------------- | ---------------------------------------------------- |
| `DATABASE_URL`        | Postgres connection string (Neon or self-hosted)     |
| `SESSION_SECRET`      | HMAC secret for cookies (**required in production**) |
| `ADMIN_PASSWORD`      | Bootstrap password for env admin login               |
| `SUPERADMIN_PASSWORD` | Bootstrap password for `superadmin`                  |

### Recommended

| Variable                 | Description                                                            |
| ------------------------ | ---------------------------------------------------------------------- |
| `NEXT_PUBLIC_SERVER_URL` | Public origin for install commands (e.g. `https://tracer.example.com`) |
| `NEON_CONNECTION_STRING` | Alias for `DATABASE_URL`                                               |

### Optional

| Variable                                                          | Default     | Description                                      |
| ----------------------------------------------------------------- | ----------- | ------------------------------------------------ |
| `ALLOW_LEGACY_ADMIN_TOKEN`                                        | unset/off   | Set `1` to allow legacy `team_admin` bearer auth |
| `DATABASE_SSL_REJECT_UNAUTHORIZED`                                | auto        | `true`/`false` TLS verification override         |
| `TEAM_API_URL` / `TEAM_API_KEY`                                   | —           | Daemon install helpers                           |
| `CLAUDE_CONFIG_DIR`, `CODEX_HOME`, `CURSOR_*`, `HERMES_STATE_DIR` | OS defaults | Local adapter paths                              |

## Generating secrets

```bash
openssl rand -base64 48   # SESSION_SECRET
openssl rand -base64 24   # strong passwords
```

## Database

Schema lives in `lib/team/schema.sql` and is applied via:

- Superadmin UI → **Run database migration**
- `POST /api/admin/migrate` (authenticated superadmin session)

## Local vs hosted personal mode

On Vercel (`VERCEL=1`), personal stats read from the database.

Locally (`npm run dev`), personal routes can fall back to scanning agent files on disk via `lib/scan.mjs`.
