# FAQ

### Is this a Tailwind / React component library app?

No. Dashboards are **vanilla JS + CSS** loaded by Next.js pages. Server code is TypeScript. A gradual React migration is optional (see roadmap).

### Do I need Neon?

No. Any Postgres 14+ works. Neon is well-supported for serverless deploys.

### Why do I see “Tracing tokens…”?

That is the branded soft-loader shown while analytics refetch after filter/refresh actions.

### Can an admin see other teams?

No. Admins are scoped to their session `teamId`. Only superadmins can select arbitrary teams.

### Where are API keys stored?

Member ingest keys are hashed in `member_keys`. Some flows also store a recoverable key for install commands — treat DB access as sensitive and rotate keys if leaked.

### Does the daemon send prompts / source code?

Ingest runs through sanitization (`lib/team/sanitize.mjs`) to strip prompt payloads. Review that module if you have strict data policies.

### How do I contribute?

See [CONTRIBUTING.md](../CONTRIBUTING.md).
