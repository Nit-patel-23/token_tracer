# Security Policy

## Supported Versions

| Version | Supported |
| ------- | --------- |
| `0.x`   | ✅        |

## Reporting a Vulnerability

**Please do not open a public GitHub issue for security vulnerabilities.**

Prefer one of these channels:

1. [GitHub Security Advisories](https://github.com/Nit-patel-23/token_tracer/security/advisories/new) (recommended)
2. Private contact with the repository maintainers

Include:

- Description of the issue
- Steps to reproduce
- Impact assessment
- Suggested fix (optional)

We aim to acknowledge reports within **72 hours** and provide a timeline for a fix.

## Security Hardening Checklist (operators)

When self-hosting Token Tracer:

1. Set a strong unique `SESSION_SECRET` (`openssl rand -base64 48`)
2. Never commit `.env.local`
3. Use least-privilege Postgres credentials
4. Keep `ALLOW_LEGACY_ADMIN_TOKEN` unset/disabled
5. Rotate member ingest API keys if leaked
6. Deploy behind HTTPS
7. Restrict admin/superadmin passwords and rotate regularly
8. Review `/api/v1/ingest` exposure — keys are bearer tokens

## Known trust boundaries

- **Ingest API** (`/api/v1/ingest`) accepts CORS `*` for daemon installs. Protect with strong API keys.
- **Client UI** uses vanilla JS with `innerHTML` rendering; user-controlled strings must be escaped (see `esc()` in `public/team/app.js`).
- **Admin team scoping** is enforced server-side via session `teamId` — never trust client-provided team IDs for admins.
