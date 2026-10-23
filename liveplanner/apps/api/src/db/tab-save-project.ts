// What a tab save needs of its project (docs/specs/015-api/api.md "Tab save"), in one query. The save ran the
// full getProject (the row with its share-code subquery, then the owner's participant and
// the tab summaries) and used eight fields of it, two sequential round trips before anything else on every
// autosave (~600 ms while someone edits). Live projects only, like every project read.

import type { ProjectDTO, PlanEnv } from '../types';

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

// Runs inside the plan's Durable Object: the row from D1, the tab count from the plan's own store.
export async function getProjectForSave(env: PlanEnv, id: string): Promise<TabSaveProject | null> {
  const [row, count] = await Promise.all([
    env.DB.prepare(
      `SELECT d.id, d.owner_id, d.team_id, d.name, d.created_at,
              p.name AS owner_name, p.color AS owner_color
         FROM projects d
         LEFT JOIN participants p ON p.id = d.owner_id
        WHERE d.id = ? AND d.trashed_at IS NULL`,
    )
      .bind(id)
      .first<Omit<Row, 'tab_count'>>(),
    env.PLAN_DB.prepare('SELECT COUNT(*) AS n FROM plan_tabs WHERE plan_id = ?')
      .bind(id)
      .first<{ n: number }>(),
  ]);
  if (!row) return null;
  return {
    id: row.id,
    ownerId: row.owner_id,
    teamId: row.team_id ?? null,
    name: row.name,
    createdAt: row.created_at,
    ownerName: row.owner_name ?? null,
    ownerColor: row.owner_color ?? null,
    tabCount: count?.n ?? 0,
  };
}
