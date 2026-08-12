import { NextRequest, NextResponse } from 'next/server';
import pg from 'pg';
import { requireDatabaseUrl } from '@/lib/team/env';

export const dynamic = 'force-dynamic';

const { Pool } = pg;
let pool: pg.Pool | null = null;

function getPoolInstance(): pg.Pool {
  if (!pool) {
    let url = requireDatabaseUrl();
    url = url.replace(/[\?&]sslmode=[^&]+/g, '');
    pool = new Pool({
      connectionString: url,
      ssl: { rejectUnauthorized: false },
    });
  }
  return pool;
}

export async function GET(req: NextRequest) {
  try {
    const db = getPoolInstance();
    
    // 1. Query Daily Tool-Error Rate Series
    const { rows: series } = await db.query(`
      WITH daily AS (
        SELECT
          ss.started_at::date AS day,
          COUNT(*) FILTER (WHERE st.turn_role = 'assistant')::int AS "totalTurns",
          COUNT(*) FILTER (WHERE st.turn_role = 'assistant' AND st.tool_error_flag)::int AS "errorTurns"
        FROM session_turns st
        JOIN sync_sessions ss ON ss.session_id = st.session_id
                             AND st.org_id = ss.team_id::text
                             AND st.user_id = ss.member_id::text
                             AND st.tool = ss.source
        GROUP BY 1
      )
      SELECT
        day,
        "totalTurns",
        "errorTurns",
        (CASE WHEN "totalTurns" = 0 THEN 0 ELSE "errorTurns"::float / "totalTurns" END) AS "errorRate",
        AVG(CASE WHEN "totalTurns" = 0 THEN 0 ELSE "errorTurns"::float / "totalTurns" END)
          OVER (ORDER BY day ROWS BETWEEN 7 PRECEDING AND 1 PRECEDING) AS "rollingMean",
        STDDEV(CASE WHEN "totalTurns" = 0 THEN 0 ELSE "errorTurns"::float / "totalTurns" END)
          OVER (ORDER BY day ROWS BETWEEN 7 PRECEDING AND 1 PRECEDING) AS "rollingStddev"
      FROM daily
      ORDER BY day DESC
      LIMIT 15
    `);

    // 2. Query Outcomes Summary
    const { rows: outcomes } = await db.query(`
      SELECT 
        intent_category,
        COUNT(*)::int AS "totalSessions",
        ROUND(AVG(total_input_tokens + total_output_tokens), 0) AS "avgTokens",
        ROUND(AVG(complexity_score)::numeric, 3) AS "avgComplexity",
        ROUND((COUNT(*) FILTER (WHERE success = true)::float / COUNT(*))::numeric * 100, 2) AS "successRatePercent"
      FROM session_outcomes
      GROUP BY 1
    `);

    return NextResponse.json({
      ok: true,
      series,
      outcomes
    });
  } catch (err: any) {
    return NextResponse.json({
      ok: false,
      error: err.message,
      stack: err.stack
    });
  }
}
