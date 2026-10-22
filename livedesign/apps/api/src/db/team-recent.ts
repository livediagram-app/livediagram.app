// The newest documents of the teams a person has joined (docs/specs/019-marketing/returning-visitor.md):
// what `GET /api/documents?include=team-recent` adds beside the personal library, so the landing page's
// Welcome back and the /new page's Jump back in hold team documents too. Never one in the Trash, never
// an empty one (nothing drawn, nothing to come back to), and never a team they were only invited to.

import type { TeamRecentDocument } from '@livepages/api-schema';
import type { Env } from '../types';
import { DOCUMENT_SUMMARY_COLS, rowToSummary, type SummaryRow } from './documents';
import { firstTabCountSql } from './tabs';

// Binds: ?1 = the person's owner id, ?2 = how many. `picked` finds the ids from the person's joined
// teams by team_members_user_idx and documents_team_idx, reading only each one's first-tab count;
// the full summary (share code, stats) is then drawn for those few alone.
// Exported for the query-plan guard in team-recent.test.ts.
export const TEAM_RECENT_SQL = `WITH
  my_teams(team_id) AS (
    SELECT team_id FROM team_members WHERE user_id = ?1 AND status = 'joined'
  ),
  picked(id) AS (
    SELECT id FROM (
      SELECT d.id, d.saved_at, ${firstTabCountSql('d.id')}
        FROM documents d
       WHERE d.team_id IN (SELECT team_id FROM my_teams) AND d.trashed_at IS NULL
    )
     WHERE COALESCE(first_tab_count, 0) <> 0
     ORDER BY saved_at DESC
     LIMIT ?2
  )
  SELECT ${DOCUMENT_SUMMARY_COLS},
         (SELECT name FROM teams WHERE teams.id = documents.team_id) AS team_name
    FROM documents
   WHERE documents.id IN (SELECT id FROM picked)
   ORDER BY documents.saved_at DESC`;

export async function listRecentTeamDocuments(
  env: Env,
  personId: string,
  limit: number,
): Promise<TeamRecentDocument[]> {
  const result = await env.DB.prepare(TEAM_RECENT_SQL)
    .bind(personId, limit)
    .all<SummaryRow & { team_name: string | null }>();
  return (result.results ?? []).map((row) => ({
    ...rowToSummary(row),
    teamName: row.team_name ?? '',
  }));
}
