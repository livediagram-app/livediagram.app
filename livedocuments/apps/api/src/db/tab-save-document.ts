// What a tab save needs of its document (docs/specs/015-api/api.md "Tab save"): the document's own row and its tab
// count, from its store, side by side. It runs on every autosave.

import type { DocumentDTO, DocumentEnv } from '../types';
import { readDocumentMeta } from '../document-room/document-content';

export type TabSaveDocument = Pick<
  DocumentDTO,
  'id' | 'ownerId' | 'teamId' | 'name' | 'createdAt'
> & {
  // How many tabs the document holds: where a new tab lands.
  tabCount: number;
};

// Runs inside the document's Durable Object. Null for a document never started.
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
