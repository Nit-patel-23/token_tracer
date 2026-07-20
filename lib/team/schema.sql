-- Team analytics schema (Neon Postgres)

CREATE TABLE IF NOT EXISTS teams (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  display_name TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('admin', 'member')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS member_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id UUID NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  key_hash TEXT NOT NULL UNIQUE,
  label TEXT NOT NULL DEFAULT 'default',
  last_used_at TIMESTAMPTZ,
  revoked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS sync_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  member_id UUID NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  source TEXT NOT NULL,
  session_id TEXT NOT NULL,
  agent TEXT,
  label TEXT,
  model TEXT,
  started_at TIMESTAMPTZ,
  ended_at TIMESTAMPTZ,
  tokens_in BIGINT NOT NULL DEFAULT 0,
  tokens_out BIGINT NOT NULL DEFAULT 0,
  tokens_cache_read BIGINT NOT NULL DEFAULT 0,
  tokens_cache_write BIGINT NOT NULL DEFAULT 0,
  api_cost DOUBLE PRECISION,
  priced BOOLEAN NOT NULL DEFAULT false,
  edits INT NOT NULL DEFAULT 0,
  additions INT NOT NULL DEFAULT 0,
  deletions INT NOT NULL DEFAULT 0,
  changed_lines INT NOT NULL DEFAULT 0,
  files_touched INT NOT NULL DEFAULT 0,
  tool_calls INT NOT NULL DEFAULT 0,
  tool_errors INT NOT NULL DEFAULT 0,
  rework_loops INT NOT NULL DEFAULT 0,
  corrections INT NOT NULL DEFAULT 0,
  abandoned BOOLEAN NOT NULL DEFAULT false,
  payload_hash TEXT NOT NULL,
  synced_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (team_id, member_id, source, session_id)
);

CREATE TABLE IF NOT EXISTS sync_session_tools (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sync_session_id UUID NOT NULL REFERENCES sync_sessions(id) ON DELETE CASCADE,
  tool_name TEXT NOT NULL,
  call_count INT NOT NULL DEFAULT 0,
  UNIQUE (sync_session_id, tool_name)
);

CREATE TABLE IF NOT EXISTS sync_session_files (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sync_session_id UUID NOT NULL REFERENCES sync_sessions(id) ON DELETE CASCADE,
  path TEXT NOT NULL,
  edits INT NOT NULL DEFAULT 0,
  additions INT NOT NULL DEFAULT 0,
  deletions INT NOT NULL DEFAULT 0,
  UNIQUE (sync_session_id, path)
);

CREATE TABLE IF NOT EXISTS ingest_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  member_id UUID NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  session_count INT NOT NULL DEFAULT 0,
  accepted INT NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'ok',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_sync_sessions_team_member ON sync_sessions(team_id, member_id);
CREATE INDEX IF NOT EXISTS idx_sync_sessions_ended ON sync_sessions(ended_at);
CREATE INDEX IF NOT EXISTS idx_ingest_events_member ON ingest_events(member_id, created_at DESC);
