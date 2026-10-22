// The Inbox's Form Responses (docs/specs/030-forms/forms.md "Hearing about responses", docs/specs/013-workspace/
// inbox.md): each live form, in a project the reader owns or reaches through a team, with responses the reader has
// not seen. Unseen is counted by response number (form_reads), so the read touches no card.
import type { ActivityFormResponses } from '@liveplanner/api-schema';
import { VISIBLE_PROJECTS_CTES } from './project-visibility';

// From the reader's projects to their form links (the link's project index), then each link's read row.
export const FORM_RESPONSES_SQL = `WITH ${VISIBLE_PROJECTS_CTES}
  SELECT l.code, v.id AS project_id, v.name AS project_name, v.team_id AS project_team_id, v.via,
         l.tab_id, t.name AS tab_name,
         json_extract(t.data, '$.form.heading') AS heading,
         COALESCE(json_extract(t.data, '$.form.sheet.tabId'), json_extract(t.data, '$.form.destination.tabId')) AS board_tab_id,
         l.responses - COALESCE(r.seen_number, 0) AS unseen,
         COALESCE(l.last_response_at, l.created_at) AS latest_at
    FROM visible v
    CROSS JOIN form_links l ON l.project_id = v.id
    JOIN tabs t ON t.id = l.tab_id
    LEFT JOIN form_reads r ON r.code = l.code AND r.owner_id = ?1
   WHERE v.via <> 'shared'
     AND l.suspended_at IS NULL
     AND l.deleted_at IS NULL
     AND l.responses > COALESCE(r.seen_number, 0)
   ORDER BY latest_at DESC
   LIMIT ?3`;

export type FormResponsesRow = {
  code: string;
  project_id: string;
  project_name: string;
  project_team_id: string | null;
  via: 'own' | 'team';
  tab_id: string;
  tab_name: string;
  heading: string | null;
  board_tab_id: string | null;
  unseen: number;
  latest_at: number;
};

export function formResponsesFromRows(rows: FormResponsesRow[]): ActivityFormResponses[] {
  return rows.map((r) => ({
    projectId: r.project_id,
    projectName: r.project_name,
    teamId: r.project_team_id,
    via: r.via,
    tabId: r.tab_id,
    heading: typeof r.heading === 'string' && r.heading ? r.heading : r.tab_name,
    boardTabId: typeof r.board_tab_id === 'string' ? r.board_tab_id : null,
    unseen: r.unseen,
    latestAt: r.latest_at,
  }));
}
