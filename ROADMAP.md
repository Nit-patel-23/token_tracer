# Roadmap

Living document — priorities may shift based on community feedback.

## Now (0.1 → 0.2)

- [x] Open-source scaffolding (README, LICENSE, SECURITY, CI)
- [x] Critical authz + SQL parameterization hardening
- [x] Branded loading states + mobile UX polish
- [ ] Unit tests for `lib/team/stats` and auth helpers
- [ ] Expand API routes onto shared `lib/api/http` helpers
- [ ] Capture real product screenshots for README

## Next

- [ ] Playwright smoke tests (login → team overview → filters)
- [ ] OpenAPI / Zod request validation for v1 routes
- [ ] Rate limiting on `/api/auth/login` and `/api/v1/ingest`
- [ ] First-party Dockerfile + compose for local Postgres
- [ ] Stop storing recoverable plaintext API keys long-term
- [ ] Deprecate legacy `/api/v1/auth/login` entirely

## Later

- [ ] Optional React/TS UI migration (component-by-component)
- [ ] SSO / OIDC for enterprise teams
- [ ] Org-level budgets and alerts
- [ ] Public demo deployment with synthetic data
- [ ] Plugin adapters for additional agents/IDEs

## Non-goals (for now)

- Becoming a full LLM observability suite (traces, evals)
- Rewriting working vanilla dashboards without a clear migration plan
