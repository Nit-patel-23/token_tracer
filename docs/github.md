# GitHub repository setup

Recommended settings when publishing Token Tracer.

## About

**Description**

> AI token analytics dashboard for developers & teams — usage, costs, models, and coding-agent activity.

**Topics**

`ai` `llm` `token-usage` `analytics` `nextjs` `postgres` `neon` `developer-tools` `claude` `cursor` `openai` `observability` `open-source`

**Website** — production demo URL (when available)

## Social preview

Upload a 1280×640 image showing the team Overview screen with the copper dark theme. Store source under `docs/assets/social-preview.png`.

## Labels

Create (or sync) these labels:

| Label              | Color     | Use                             |
| ------------------ | --------- | ------------------------------- |
| `bug`              | `#d03b3b` | Defects                         |
| `enhancement`      | `#e2a355` | Features                        |
| `documentation`    | `#3987e5` | Docs                            |
| `good first issue` | `#0ca30c` | Newcomer-friendly               |
| `help wanted`      | `#8a8172` | Extra hands needed              |
| `security`         | `#d03b3b` | Security-related (non-advisory) |
| `needs-triage`     | `#8a8172` | Unreviewed                      |
| `dependencies`     | `#575046` | Dependabot                      |
| `ci`               | `#575046` | Workflows                       |
| `breaking`         | `#d03b3b` | Breaking changes                |

## Discussions categories

Enable Discussions with:

1. **Announcements** — releases
2. **Q&A** — support
3. **Ideas** — feature brainstorming
4. **Show and tell** — deployments / forks

## Releases

- Tag `v0.1.0`, `v0.2.0`, … (semver)
- Generate notes from Conventional Commits
- Attach migration notes when schema changes

## Branch protection (`main`)

- Require PR reviews (1+)
- Require CI (`CI` workflow) to pass
- Disallow force pushes
