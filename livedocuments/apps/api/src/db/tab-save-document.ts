// What a tab save needs of its document (docs/specs/015-api/api.md "Tab save"): the document's own row and its next tab
// place, from its store, side by side. It runs on every autosave.

import type { DocumentDTO, DocumentEnv } from '../types';
import { readDocumentMeta } from '../document-room/document-content';

export type TabSaveDocument = Pick<
  DocumentDTO,
  'id' | 'ownerId' | 'teamId' | 'name' | 'createdAt'
> & {
  // Where a new tab lands: one past the highest place held (docs/specs/006-document/per-tab-storage.md
  // "New tabs and the tab order"). Not the count: after a tab leaves the middle, the count is the last tab's own
  // place.
  nextOrderIndex: number;
};

// Runs inside the document's Durable Object. Null for a document never started.
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
