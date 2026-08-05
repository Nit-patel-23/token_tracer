# API Overview

Base URL: your deployment origin (e.g. `http://localhost:3000`).

All JSON errors should be treated as `{ error: string }` (newer helpers also include `ok: false`).

## Auth

| Method | Path              | Auth    | Description                                                         |
| ------ | ----------------- | ------- | ------------------------------------------------------------------- |
| `POST` | `/api/auth/login` | —       | Unified login (`username` + `password`) → sets `app_session` cookie |
| `GET`  | `/api/auth/me`    | Session | Current user                                                        |
| `POST` | `/api/auth/me`    | Session | Logout (clears cookie)                                              |

## Personal

| Method | Path               | Auth           | Description               |
| ------ | ------------------ | -------------- | ------------------------- |
| `GET`  | `/api/stats`       | Session (user) | Aggregated personal stats |
| `GET`  | `/api/state`       | Session (user) | Session tree / roots      |
| `GET`  | `/api/session?id=` | Session (user) | Single session detail     |

## Team (v1)

| Method                | Path                                | Auth                        | Description           |
| --------------------- | ----------------------------------- | --------------------------- | --------------------- |
| `GET`                 | `/api/v1/teams`                     | Admin+                      | List teams            |
| `GET`                 | `/api/v1/team/stats`                | Admin (scoped) / Superadmin | Analytics rollup      |
| `GET/POST/PUT/DELETE` | `/api/v1/team/members`              | Admin scoped                | Member CRUD           |
| `POST`                | `/api/v1/team/members/link`         | Admin scoped                | Link existing member  |
| `POST`                | `/api/v1/team/members/trigger-sync` | Admin scoped                | Broadcast sync signal |
| `GET/POST/DELETE`     | `/api/v1/team/pricing`              | Admin scoped                | Model pricing rules   |
| `POST`                | `/api/v1/team/recalculate`          | Admin scoped                | Recalc session costs  |
| `POST`                | `/api/v1/ingest`                    | Member API key              | Daemon ingest         |

Query filters for stats commonly include: `teamId`, `from`, `to`, `memberId`, `source`, `minTokens`.

## Admin

| Method                | Path                              | Auth       | Description             |
| --------------------- | --------------------------------- | ---------- | ----------------------- |
| `GET/POST/PUT/DELETE` | `/api/admin/users`                | Superadmin | User management         |
| `POST`                | `/api/admin/users/reset-password` | Superadmin | Password reset          |
| `POST`                | `/api/admin/migrate`              | Superadmin | Apply schema migrations |

## Health

| Method | Path          | Description |
| ------ | ------------- | ----------- |
| `GET`  | `/api/health` | Liveness    |

## Notes

- Prefer cookie session auth for browser clients.
- Daemon clients use `Authorization: Bearer <member_api_key>` on ingest.
- Legacy `/api/v1/auth/login` admin tokens are **disabled by default** (`ALLOW_LEGACY_ADMIN_TOKEN`).
