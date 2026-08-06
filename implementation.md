# Implementation Spec: Token & Prompt Research Analytics (Superadmin)

**Audience:** this doc is written as build instructions for an autonomous coding agent (Antigravity). Read it fully before writing code. Where a decision isn't specified, match the existing codebase's conventions rather than introducing a new pattern.

**Do not start writing code until you've read the "Constraints" and "Guardrails" sections below in full.**

---

## 1. Context

Token Tracer (AgentVis) already tracks token usage from Claude Code, Cursor, and Codex, syncing via a local daemon into Neon Postgres. The existing `/admin` console handles config, pricing overrides, and migrations. This spec adds a new **Research Analytics** section to `/admin` that answers behavioral questions — not just "how much did we spend" but "does token/prompt behavior predict outcome, and which model/tool is actually efficient, not just cheap."

Five studies to build, in this priority order:

1. Prompt Specificity → Token Efficiency & Outcome
2. Verbosity Elasticity Fingerprint per Model
3. Context Saturation & Behavioral Drift
4. Task-Normalized Cost-Performance Frontier (depends on 1 & 2)
5. Prompt-Chain Semantic Drift ("redundant re-prompting") — pilot on one org only, ship last

## 2. Constraints (do not deviate without flagging)

- **Stack:** Next.js App Router, route handlers under `app/api/...`, vanilla JS/CSS (no Tailwind, no new frontend framework), custom SVG charts, `pg` against Neon Postgres, JWT auth via `lib/auth.ts` with `user`/`admin`/`superadmin` roles.
- **This entire feature is superadmin-only.** Gate every route and page behind the existing `superadmin` role check — do not create a new auth pattern.
- **Read from rollups/analytical tables, never raw ingest tables live.** Same principle as the existing `/admin` cost/pipeline dashboards.
- **No new charting library.** Extend the existing SVG chart components (`app.js` / `admin/admin.js` style) rather than pulling in Chart.js, Recharts, D3, etc.
- **No new heavyweight ML.** Rule-based/regex classification and simple linear regression only, unless a study explicitly calls for more (only Study 5 does, and it's scoped down — see below).

## 3. Data Model

Add these as a new migration, following the existing idempotent auto-migration pattern already used for the rollup tables.

### 3.1 `session_turns` — turn-level analytical table (core dependency for all 5 studies)

```sql
CREATE TABLE session_turns (
  id BIGSERIAL PRIMARY KEY,
  session_id TEXT NOT NULL,
  org_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  tool TEXT NOT NULL,                    -- 'claude_code' | 'cursor' | 'codex'
  model TEXT NOT NULL,
  turn_index INT NOT NULL,
  turn_role TEXT NOT NULL,               -- 'user' | 'assistant'
  input_tokens INT DEFAULT 0,
  output_tokens INT DEFAULT 0,
  cache_read_tokens INT DEFAULT 0,
  cache_write_tokens INT DEFAULT 0,
  cumulative_input_tokens INT,           -- running total within session (for context-fill %)
  prompt_text_sanitized TEXT,            -- user turns only, post-daemon-sanitization
  prompt_char_len INT,
  has_code_block BOOLEAN DEFAULT FALSE,
  has_file_path BOOLEAN DEFAULT FALSE,
  has_traceback BOOLEAN DEFAULT FALSE,
  intent_category TEXT,                  -- 'bug_fix' | 'feature' | 'refactor' | 'explain' | 'test' | 'other'
  files_touched INT DEFAULT 0,
  lines_added INT DEFAULT 0,
  lines_removed INT DEFAULT 0,
  tool_call_count INT DEFAULT 0,
  tool_call_valid_count INT DEFAULT 0,   -- tool calls that referenced a real file/line
  tool_error_flag BOOLEAN DEFAULT FALSE,
  rework_flag BOOLEAN DEFAULT FALSE,
  revert_flag BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX idx_session_turns_session ON session_turns(session_id, turn_index);
CREATE INDEX idx_session_turns_org_model ON session_turns(org_id, model, tool);
```

**Population:** extend the existing ingest path (wherever turns are currently parsed and written for the personal-dashboard trajectory replay) to also write this row. Do not build a second parser — hook into the one that already exists.

**Regex/rule-based feature extraction** (run at ingest time, not query time):
- `has_code_block`: fenced code block pattern in prompt text
- `has_file_path`: path-like pattern (`src/...`, `*.ts`, `*.py`, etc.)
- `has_traceback`: stack-trace-shaped pattern (`at .*:\d+`, `Traceback`, `Error:` near a file:line)
- `intent_category`: keyword/rule classifier — e.g. "fix"/"bug"/"error" → `bug_fix`; "add"/"implement" → `feature`; "refactor"/"clean up" → `refactor`; "explain"/"why"/"what does" → `explain`; "test"/"write tests" → `test`; else `other`. Keep this as an isolated, swappable function — it's the one piece likely to need iteration.

**Check with the sanitization step in `sync-daemon.mjs` before relying on `prompt_text_sanitized`, `has_file_path`, or `has_traceback`.** If file paths or tracebacks are stripped for privacy before reaching the server, these features must be computed *client-side in the daemon* before sanitization and sent as booleans, not reconstructed server-side from already-scrubbed text. Flag this explicitly if it's the case — it changes where this logic lives.

### 3.2 `model_context_limits`

```sql
CREATE TABLE model_context_limits (
  model TEXT PRIMARY KEY,
  max_context_tokens INT NOT NULL
);
```
Seed with known values for every model currently seen in ingest data. Used to compute context-fill % in Study 3.

### 3.3 `session_outcomes` — session-level rollup

```sql
CREATE TABLE session_outcomes (
  session_id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL,
  tool TEXT NOT NULL,
  model TEXT NOT NULL,
  intent_category TEXT,
  total_input_tokens INT,
  total_output_tokens INT,
  total_cost NUMERIC(12,4),
  files_touched INT,
  lines_changed INT,
  tool_call_count INT,
  had_rework BOOLEAN,
  had_revert BOOLEAN,
  had_tool_error BOOLEAN,
  success BOOLEAN,               -- NOT (had_rework OR had_revert OR had_tool_error)
  complexity_score NUMERIC        -- derived, see Study 4
);
```
Computed nightly from `session_turns`, same cron pattern as the existing rollup jobs.

### 3.4 `redundant_reprompt_events` (Study 5 only)

```sql
CREATE TABLE redundant_reprompt_events (
  id BIGSERIAL PRIMARY KEY,
  session_id TEXT NOT NULL,
  turn_index INT NOT NULL,
  similarity_score NUMERIC,
  tokens_cost_of_following_turn INT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE prompt_embeddings (
  turn_id BIGINT REFERENCES session_turns(id) PRIMARY KEY,
  embedding VECTOR(384)
);
```
Requires the `pgvector` extension on Neon (`CREATE EXTENSION IF NOT EXISTS vector;`). Confirm it's available on the current Neon plan before building this table — if not, store embeddings as a `FLOAT8[]` column and compute cosine similarity in application code instead of in SQL.

---

## 4. Study-by-Study Build Instructions

### Study 1 — Prompt Specificity → Token Efficiency & Outcome

- **Compute:** bucket sessions into specificity tiers using `has_code_block`, `has_file_path`, `has_traceback` (e.g. 0 signals = "vague", 1 = "partial", 2+ = "specific").
- **Metric per tier, per complexity bucket** (complexity bucket = tertile of `session_outcomes.complexity_score`): mean tokens-per-accepted-line, rework rate, revert rate.
- **API:** `GET /api/admin/research/prompt-specificity?range=&org=&tool=&model=`
- **Response shape:** array of `{ tier, complexityBucket, sessionCount, avgTokensPerLine, reworkRate, revertRate }`.

### Study 2 — Verbosity Elasticity Fingerprint per Model

- **Compute:** simple linear regression of `output_tokens ~ input_tokens + files_touched`, fit **per model per intent_category**, on turn-level data.
- **API:** `GET /api/admin/research/verbosity-elasticity?range=&model=&intent=`
- **Response shape:** array of `{ model, intentCategory, slope, intercept, r2, sampleSize }` plus the raw scatter points (capped/sampled, e.g. max 500 points per series) for client-side rendering.

### Study 3 — Context Saturation & Behavioral Drift

- **Compute:** for every turn, `contextFillPct = cumulative_input_tokens / model_context_limits.max_context_tokens`. Bin into 10% buckets. Per bucket, compute tool-error rate (`tool_error_flag` true / total) and `tool_call_valid_count / tool_call_count`.
- Detect inflection point: simplest viable approach is the bucket where error rate first exceeds 1.5x the 0–20% baseline rate — don't build anything fancier than that initially.
- **API:** `GET /api/admin/research/context-saturation?range=&model=&tool=`
- **Response shape:** array of `{ fillBucket, model, toolErrorRate, validToolCallRate, sampleSize }` plus a top-level `inflectionPoint` per model if detected.

### Study 4 — Task-Normalized Cost-Performance Frontier

- **Depends on Studies 1 & 2** for `intent_category` and `complexity_score`. Build last among 1–4.
- **`complexity_score`** (compute once, store on `session_outcomes`): normalized combination of `files_touched`, `lines_changed`, `tool_call_count` — z-score each and sum. Document the exact formula used in code comments; this number gets referenced by other studies.
- **Compute:** within each `intent_category`, plot `total_cost` vs `success` rate per model; trace Pareto frontier (points not dominated by another point with both lower cost and higher success rate).
- **API:** `GET /api/admin/research/cost-performance-frontier?range=&intent=`
- **Response shape:** `{ intentCategory, points: [{ model, avgCost, successRate, sessionCount, isPareto }] }`.

### Study 5 — Prompt-Chain Semantic Drift (pilot scope, build last)

- **Scope this to a single org behind a feature flag** (`ENABLE_REPROMPT_ANALYSIS_ORG_ID` env var or equivalent config row) — do not run platform-wide on first build.
- **Embedding model:** use a small local embedding model (no per-prompt external API calls — this runs at ingest volume and must stay cheap). If none is already available in the stack, flag this as a new dependency before adding it, rather than silently pulling one in.
- **Compute:** for consecutive user turns in a session, cosine similarity of embeddings. Similarity above a threshold (start at 0.85, make configurable) → write a `redundant_reprompt_events` row with the token cost of the turn that followed.
- **API:** `GET /api/admin/research/redundant-reprompt?range=&org=` — only returns data for the pilot org; return an explicit `{ pilotOnly: true, eligibleOrg: "..." }` flag so the UI can label it correctly rather than silently showing an empty state for everyone else.

---

## 5. UI/UX

### 5.1 Design system — extend, don't reinvent

Before writing any new CSS, read the existing `admin/admin.js` and its stylesheet. Reuse:
- existing HSL custom-property color tokens
- existing glassmorphism card style
- existing SVG chart primitives (axes, gridlines, tooltips) — extract shared pieces into reusable functions if they're currently duplicated per-chart, rather than copy-pasting a fourth time

If a genuinely new chart type is needed (e.g. scatter plot with regression line, which likely doesn't exist yet), build it as a new SVG component following the same visual language (same stroke widths, same tooltip behavior, same color tokens) as existing charts — it should look like it belongs, not like a bolted-on library.

### 5.2 Navigation

Add a **"Research"** nav item inside `/admin`, gated the same way the rest of `/admin` is gated (superadmin role). Landing page at `/admin/research`.

### 5.3 Landing page (`/admin/research`)

Five cards, one per study, in priority order (1, 2, 3, 4, 5). Each card shows:
- Study name + one-line question it answers (use the "Question:" line from the study definitions above)
- A live headline stat once data exists (e.g. "Specific prompts use 38% fewer tokens/line" for Study 1) — compute this from the same API the detail page uses, don't hardcode
- A sample-size badge (see 5.5)
- Study 5's card is visually marked **"Pilot — [org name] only"** with a distinct badge style (not an error state, just a clear scope label)

Clicking a card navigates to that study's detail route.

### 5.4 Shared filter bar

One filter component reused across all 5 detail pages: date range picker, org multi-select (superadmin sees all orgs), tool toggle (Claude Code / Cursor / Codex), model multi-select. Filters persist in the URL query string so a filtered view is shareable/bookmarkable — match whatever pattern the existing `/team` dashboard already uses for its filters, if one exists.

### 5.5 Sample-size / confidence handling (apply to every chart, all 5 studies)

This dataset is young — surface that honestly instead of showing confident-looking charts on thin data:
- Every chart/series carries its `sampleSize` from the API response.
- Below a configurable threshold (default: n < 30 at session level, n < 200 at turn level), render the series in a muted/desaturated style with a small "Low confidence — n=X" label near it, rather than hiding it or showing it identically to well-supported data.
- Above threshold, render normally.
- Don't make this a blocking empty state — a superadmin should still be able to see thin data, just not be misled about how solid it is.

### 5.6 Per-study detail pages

**`/admin/research/prompt-specificity`**
Grouped bar chart: x-axis = specificity tier, grouped bars = complexity bucket, y-axis toggle between "tokens per accepted line" and "rework rate" (a simple tab/toggle above the chart, not two separate pages).

**`/admin/research/verbosity-elasticity`**
Small-multiples grid: one scatter plot per intent category, input tokens (x) vs output tokens (y), points colored by model, regression line per model overlaid. Model color legend shared across the grid. Clicking a point opens the existing session-trajectory replay (reuse the personal dashboard's replay view — do not rebuild it) in a side panel or modal.

**`/admin/research/context-saturation`**
Line chart: x-axis = context-fill % (0–100), y-axis = tool-error rate, one line per model (toggleable via legend checkboxes). Shade/annotate the detected inflection point per model with a vertical marker + label.

**`/admin/research/cost-performance-frontier`**
Tabs across the top for `intent_category`. Within each tab: scatter plot, x = avg cost, y = success rate, one point per model, Pareto-frontier points connected with a line and visually distinct (filled) from dominated points (outlined/muted).

**`/admin/research/redundant-reprompt`**
Top-line summary card ("~$X wasted to redundant re-prompting this week, pilot org"), followed by a table of flagged events (session link, similarity score, token cost) sorted by cost descending. Table rows link into the session replay view at the flagged turn.

---

## 6. Build Order

1. Migration: `session_turns`, `model_context_limits`, `session_outcomes` + backfill/ingest hook
2. Nightly rollup job for `session_outcomes`
3. Study 1 API + detail page
4. Study 2 API + detail page
5. Study 3 API + detail page
6. `complexity_score` computation + Study 4 API + detail page
7. Landing page (`/admin/research`) wiring all headline stats from the above
8. Study 5 — pilot org flag, embedding pipeline, table, API, detail page

Studies 1–3 can be built in parallel once the migration lands; each only depends on `session_turns`, not on each other. Study 4 must come after 1 and 2. Study 5 is independent but intentionally sequenced last given its added infra (embeddings, pilot scoping).

## 7. Guardrails / Non-Goals

- No new charting or ML library without flagging it first — this includes embedding models for Study 5.
- No platform-wide run of Study 5 on first build — pilot org only, explicit flag in both API and UI.
- No live aggregation queries against raw ingest tables from any `/admin/research/*` route — everything reads from `session_turns` / `session_outcomes` or further-aggregated views.
- Don't hide low-sample-size data — mark it, don't suppress it.
- If the sanitization step turns out to strip file paths/tracebacks before they reach the server, stop and flag it rather than silently building feature extraction on already-scrubbed text — this affects Study 1 and Study 3's `has_file_path`/`has_traceback` signals directly.

## 8. Definition of Done

- [ ] `session_turns`, `model_context_limits`, `session_outcomes` tables exist and are populated from real ingest data, verified against a handful of known sessions by hand
- [ ] All 5 study APIs return correct shapes with real data, including `sampleSize` on every series
- [ ] `/admin/research` landing page shows live headline stats, not placeholders
- [ ] All 5 detail pages render, respect the shared filter bar, and correctly mute/label low-confidence series
- [ ] Study 5 is inert (returns `pilotOnly` empty state) for every org except the configured pilot org
- [ ] No new frontend framework or charting library introduced
- [ ] Every new route is gated behind the existing superadmin role check