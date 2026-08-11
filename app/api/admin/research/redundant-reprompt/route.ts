import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getSessionFromCookie } from '@/lib/auth';
import { query } from '@/lib/team/db';

export const dynamic = 'force-dynamic';

function parseDays(range: string | null): number {
  if (!range) return 30;
  const m = range.match(/^(\d+)d$/);
  return m ? Math.min(Math.max(1, Number(m[1])), 90) : 30;
}

export async function GET(req: NextRequest) {
  const cookieStore = await cookies();
  const session = getSessionFromCookie(cookieStore.toString());
  if (!session || session.role !== 'superadmin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const searchParams = req.nextUrl.searchParams;
  const days = parseDays(searchParams.get('range'));
  const org = searchParams.get('org');

  const pilotOrgId = process.env.ENABLE_REPROMPT_ANALYSIS_ORG_ID;

  // Study 5 is gated strictly to the pilot org
  if (!pilotOrgId || org !== pilotOrgId) {
    // Return pilot metadata for UI warning/labeling
    return NextResponse.json({
      pilotOnly: true,
      eligibleOrg: pilotOrgId || 'None configured (Set ENABLE_REPROMPT_ANALYSIS_ORG_ID)'
    });
  }

  try {
    const { rows } = await query(`
      SELECT 
        rre.session_id AS "sessionId",
        rre.turn_index AS "turnIndex",
        rre.similarity_score::float AS "similarityScore",
        rre.tokens_cost_of_following_turn AS "tokensCost",
        COALESCE((rre.tokens_cost_of_following_turn::float / NULLIF(ss.tokens_in + ss.tokens_out, 0)) * ss.api_cost, 0)::float AS "costWasted",
        rre.created_at AS "createdAt",
        ss.source AS tool,
        ss.model,
        COALESCE(m.display_name, 'Unknown User') AS "userName",
        COALESCE(t.name, 'Unknown Team') AS "projectName",
        st.prompt_text_sanitized AS "promptText",
        prev_st.prompt_text_sanitized AS "prevPromptText"
      FROM redundant_reprompt_events rre
      JOIN sync_sessions ss ON ss.session_id = rre.session_id
      LEFT JOIN members m ON m.id = ss.member_id
      LEFT JOIN teams t ON t.id = ss.team_id
      LEFT JOIN session_turns st ON st.session_id = rre.session_id 
        AND st.org_id = ss.team_id::text
        AND st.user_id = ss.member_id::text
        AND st.tool = ss.source
        AND st.turn_index = rre.turn_index 
        AND st.turn_role = 'user'
      LEFT JOIN session_turns prev_st ON prev_st.session_id = rre.session_id 
        AND prev_st.org_id = ss.team_id::text
        AND prev_st.user_id = ss.member_id::text
        AND prev_st.tool = ss.source
        AND prev_st.turn_index = rre.turn_index - 1 
        AND prev_st.turn_role = 'user'
      WHERE ss.team_id::text = $1
        AND ss.started_at >= NOW() - $2::int * INTERVAL '1 day'
      ORDER BY rre.tokens_cost_of_following_turn DESC
    `, [org, days]);

    return NextResponse.json({
      pilotOnly: false,
      eligibleOrg: pilotOrgId,
      events: rows
    });
  } catch (err: any) {
    console.error('[research-reprompt-error]', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
