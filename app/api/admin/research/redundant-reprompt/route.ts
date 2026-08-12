import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/team/db';
import { parseRangeDays, requireSuperadminApi } from '@/lib/team/researchQuery';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const forbidden = requireSuperadminApi(req);
  if (forbidden) return forbidden;

  const searchParams = req.nextUrl.searchParams;
  const days = parseRangeDays(searchParams.get('range'));
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
