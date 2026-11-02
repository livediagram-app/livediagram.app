// What a tab save needs of its document (docs/specs/015-api/api.md "Tab save"), in one query. The save ran the
// full getDocument (the owner's participant and the tab summaries) and used a handful of fields of it; this reads
// only the canvas's own row and its tab count.

import { readDocumentMeta } from '../document-room/document-content';
import type { DocumentDTO, DocumentEnv } from '../types';

export type TabSaveDocument = Pick<
  DocumentDTO,
  'id' | 'ownerId' | 'teamId' | 'name' | 'createdAt'
> & {
  // How many tabs the document holds: where a new tab lands.
  tabCount: number;
};

// Runs inside the canvas's Durable Object: what it knows of itself and its tab count, both from its own store.
export async function getDocumentForSave(
  env: DocumentEnv,
  id: string,
): Promise<TabSaveDocument | null> {
  // Both reads start before either is awaited; the count is its own async step so a throw while preparing it
  // rejects with the meta read settled, never leaving that one unhandled.
  const countTabs = async () =>
    env.DOCUMENT_DB.prepare('SELECT COUNT(*) AS n FROM document_tabs WHERE document_id = ?')
      .bind(id)
      .first<{ n: number }>();
  const [meta, count] = await Promise.all([readDocumentMeta(env, id), countTabs()]);
  if (!meta) return null;
  return {
    id,
    ownerId: meta.ownerId,
    teamId: meta.teamId,
    name: meta.name,
    createdAt: meta.createdAt,
    tabCount: count?.n ?? 0,
  };
}
