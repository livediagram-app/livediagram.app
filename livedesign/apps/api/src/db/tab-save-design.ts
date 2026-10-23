// What a tab save needs of its design (docs/specs/015-api/api.md "Tab save"), in one query. The save ran the
// full getDesign (the row with its share-code subquery, then the owner's participant and
// the tab summaries) and used a handful of fields of it, two sequential round trips before anything else on
// every autosave (~600 ms while someone edits). Live designs only, like every design read. The writer's name
// and colour, for the comments the save stamps, are their liveworkspace profile (accounts/profiles.ts).

import type { DesignDTO, Env } from '../types';

export type TabSaveDesign = Pick<DesignDTO, 'id' | 'ownerId' | 'teamId' | 'name' | 'createdAt'> & {
  // How many tabs the design holds: where a new tab lands.
  tabCount: number;
};

type Row = {
  id: string;
  owner_id: string;
  team_id: string | null;
  name: string;
  created_at: number;
  tab_count: number;
};

export async function getDesignForSave(env: Env, id: string): Promise<TabSaveDesign | null> {
  const row = await env.DB.prepare(
    `SELECT d.id, d.owner_id, d.team_id, d.name, d.created_at,
            (SELECT COUNT(*) FROM design_tabs dt WHERE dt.design_id = d.id) AS tab_count
       FROM designs d
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
    tabCount: row.tab_count,
  };
}
