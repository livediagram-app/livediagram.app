// What a tab save needs of its document (docs/specs/015-api/api.md "Tab save"), in one query. The save ran the
// full getDocument (the row with its share-code subquery, then the owner's participant and
// the tab summaries) and used eight fields of it, two sequential round trips before anything else on every
// autosave (~600 ms while someone edits). Live documents only, like every document read.

import type { DocumentDTO, Env } from '../types';

export type TabSaveDocument = Pick<
  DocumentDTO,
  'id' | 'ownerId' | 'teamId' | 'name' | 'createdAt' | 'ownerName' | 'ownerColor'
> & {
  // How many tabs the document holds: where a new tab lands.
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

export async function getDocumentForSave(env: Env, id: string): Promise<TabSaveDocument | null> {
  const row = await env.DB.prepare(
    `SELECT d.id, d.owner_id, d.team_id, d.name, d.created_at,
            p.name AS owner_name, p.color AS owner_color,
            (SELECT COUNT(*) FROM document_tabs dt WHERE dt.document_id = d.id) AS tab_count
       FROM documents d
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
