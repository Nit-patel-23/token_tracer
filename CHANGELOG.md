# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- Open-source documentation suite (README, CONTRIBUTING, SECURITY, ARCHITECTURE, FAQ, etc.)
- MIT LICENSE
- `.env.example`, Prettier, expanded npm scripts (`typecheck`, `format`, `check`)
- GitHub issue/PR templates, CI workflow, Dependabot
- Shared `lib/api/http.ts` response helpers
- Branded Token Tracer loaders across team/personal/admin surfaces

### Security

- Admin team authorization no longer trusts client-provided `teamId`
- Parameterized member filter SQL in `buildTeamStats`
- `SESSION_SECRET` required in production (no insecure fallback)
- Legacy admin bearer tokens disabled by default (`ALLOW_LEGACY_ADMIN_TOKEN`)
- XSS hardening via `esc()` across team dashboard `innerHTML` paths
- Removed hardcoded production deployment URL defaults

### Changed

- Package renamed `agentvis-next` → `token-tracer`
- Public server URL resolved through `publicServerUrl()`

## [0.1.0] — 2026-08-03

### Added

- Initial hybrid Next.js + vanilla analytics dashboards
- Team stats, pricing, ingest daemon, admin user management
