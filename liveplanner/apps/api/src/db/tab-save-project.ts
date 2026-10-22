// What a tab save needs of its project (docs/specs/015-api/api.md "Tab save"), in one query. The save ran the
// full getProject (the row with its share-code subquery, then the owner's participant and
// the tab summaries) and used eight fields of it, two sequential round trips before anything else on every
// autosave (~600 ms while someone edits). Live projects only, like every project read.

import type { ProjectDTO, Env } from '../types';

export type TabSaveProject = Pick<
  ProjectDTO,
  'id' | 'ownerId' | 'teamId' | 'name' | 'createdAt' | 'ownerName' | 'ownerColor'
> & {
  // How many tabs the project holds: where a new tab lands.
  tabCount: number;
};

type Row = {
  id: string;
  owner_id: string;
  team_id: string | null;
  name: string;
  created_at: number;
  owner_name: string | null;
  owner_color: string | null;
  tab_count: number;
};

export async function getProjectForSave(env: Env, id: string): Promise<TabSaveProject | null> {
  const row = await env.DB.prepare(
    `SELECT d.id, d.owner_id, d.team_id, d.name, d.created_at,
            p.name AS owner_name, p.color AS owner_color,
            (SELECT COUNT(*) FROM project_tabs dt WHERE dt.project_id = d.id) AS tab_count
       FROM projects d
       LEFT JOIN participants p ON p.id = d.owner_id
      WHERE d.id = ? AND d.trashed_at IS NULL`,
  )
    .bind(id)
    .first<Row>();
  if (!row) return null;
  return {
    id: row.id,
    ownerId: row.owner_id,
    teamId: row.team_id ?? null,
    name: row.name,
    createdAt: row.created_at,
    ownerName: row.owner_name ?? null,
    ownerColor: row.owner_color ?? null,
    tabCount: row.tab_count,
  };
}
