<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Token Tracer — agent notes

- **UI lives in `public/*.js` + CSS**, not React components. Pages in `app/` are thin shells.
- Prefer fixing `lib/` + API routes for backend work; escape `innerHTML` in `public/team/app.js`.
- Never trust client `teamId` for admin roles — use `getAuthorizedTeamId()`.
- Production requires `SESSION_SECRET`. See `.env.example` and `docs/configuration.md`.
- Full architecture: `docs/architecture.md`.
