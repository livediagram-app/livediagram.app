// The newest projects of the teams a person has joined (docs/specs/019-marketing/returning-visitor.md):
// what `GET /api/projects?include=team-recent` adds beside the personal library, so the landing page's
// Welcome back and the /new page's Jump back in hold team projects too. Never one in the Trash, never
// an empty one (nothing drawn, nothing to come back to), and never a team they were only invited to.

import type { TeamRecentProject } from '@liveplanner/api-schema';
import type { Env } from '../types';
import { PROJECT_SUMMARY_COLS, rowToSummary, type SummaryRow } from './projects';
import { firstTabCountSql } from './tabs';

// Binds: ?1 = the person's owner id, ?2 = how many. `picked` finds the ids from the person's joined
// teams by team_members_user_idx and projects_team_idx, reading only each one's first-tab count;
// the full summary (share code, stats) is then drawn for those few alone.
// Exported for the query-plan guard in team-recent.test.ts.
export const TEAM_RECENT_SQL = `WITH
  my_teams(team_id) AS (
    SELECT team_id FROM team_members WHERE user_id = ?1 AND status = 'joined'
  ),
  picked(id) AS (
    SELECT id FROM (
      SELECT d.id, d.saved_at, ${firstTabCountSql('d.id')}
        FROM projects d
       WHERE d.team_id IN (SELECT team_id FROM my_teams) AND d.trashed_at IS NULL
    )
     WHERE COALESCE(first_tab_count, 0) <> 0
     ORDER BY saved_at DESC
     LIMIT ?2
  )
  SELECT ${PROJECT_SUMMARY_COLS},
         (SELECT name FROM teams WHERE teams.id = projects.team_id) AS team_name
    FROM projects
   WHERE projects.id IN (SELECT id FROM picked)
   ORDER BY projects.saved_at DESC`;

export async function listRecentTeamProjects(
  env: Env,
  personId: string,
  limit: number,
): Promise<TeamRecentProject[]> {
  const result = await env.DB.prepare(TEAM_RECENT_SQL)
    .bind(personId, limit)
    .all<SummaryRow & { team_name: string | null }>();
  return (result.results ?? []).map((row) => ({
    ...rowToSummary(row),
    teamName: row.team_name ?? '',
  }));
}
