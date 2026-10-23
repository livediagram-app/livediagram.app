// What a tab save needs of its document (docs/specs/015-api/api.md "Tab save"), in one query. The save ran the
// full getDocument (the row with its share-code subquery, then the owner's profile and
// the tab summaries) and used eight fields of it, two sequential round trips before anything else on every
// autosave (~600 ms while someone edits). Live documents only, like every document read.

import type { DocumentDTO, DocumentEnv } from '../types';

export type TabSaveDocument = Pick<
  DocumentDTO,
  'id' | 'ownerId' | 'teamId' | 'name' | 'createdAt'
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
  tab_count: number;
};

// Runs inside the document's Durable Object: the row from D1, the tab count from the document's own store.
export async function getDocumentForSave(
  env: DocumentEnv,
  id: string,
): Promise<TabSaveDocument | null> {
  const [row, count] = await Promise.all([
    env.DB.prepare(
      `SELECT d.id, d.owner_id, d.team_id, d.name, d.created_at
         FROM documents d
        WHERE d.id = ? AND d.trashed_at IS NULL`,
    )
      .bind(id)
      .first<Omit<Row, 'tab_count'>>(),
    env.DOCUMENT_DB.prepare('SELECT COUNT(*) AS n FROM document_tabs WHERE document_id = ?')
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
    tabCount: count?.n ?? 0,
  };
}
