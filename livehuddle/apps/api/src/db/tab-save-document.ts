// What a tab save needs of its document (docs/specs/015-api/api.md "Tab save"), in one query. The save ran the full
// getDocument (the owner's participant and the tab summaries) and used a handful of fields of it; this reads only the
// canvas's own row and its next tab place.

import { readDocumentMeta } from '../document-room/document-content';
import type { DocumentDTO, DocumentEnv } from '../types';

export type TabSaveDocument = Pick<
  DocumentDTO,
  'id' | 'ownerId' | 'teamId' | 'name' | 'createdAt'
> & {
  // Where a new tab lands: one past the highest place held (docs/specs/006-document/per-tab-storage.md
  // "New tabs and the tab order"). Not the count: after a tab leaves the middle, the count is the last tab's own
  // place.
  nextOrderIndex: number;
};

// Runs inside the canvas's Durable Object: what it knows of itself and its next tab place, both from its own store.
export async function getDocumentForSave(
  env: DocumentEnv,
  id: string,
): Promise<TabSaveDocument | null> {
  // Both reads start before either is awaited; the place is its own async step so a throw while preparing it
  // rejects with the meta read settled, never leaving that one unhandled.
  const nextPlace = async () =>
    env.DOCUMENT_DB.prepare(
      'SELECT COALESCE(MAX(order_index) + 1, 0) AS n FROM document_tabs WHERE document_id = ?',
    )
      .bind(id)
      .first<{ n: number }>();
  const [meta, next] = await Promise.all([readDocumentMeta(env, id), nextPlace()]);
  if (!meta) return null;
  return {
    id,
    ownerId: meta.ownerId,
    teamId: meta.teamId,
    name: meta.name,
    createdAt: meta.createdAt,
    nextOrderIndex: next?.n ?? 0,
  };
}
