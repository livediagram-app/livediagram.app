// The knowledgebase's page tree to every open editor (docs/specs/030-knowledgebase/knowledgebases-and-pages.md "The
// page tree"): the document's tabs as they stand, as an editor's own tree change sends them, after a write the api
// made (a page added or moved, a page renamed by its Title). Answers the document as read, or null when it is gone.
import { getDocument } from './db';
import { relayPages } from './room-client';
import type { DocumentDTO, DocumentEnv } from './types';

export async function relayDocumentTree(
  env: DocumentEnv,
  documentId: string,
  tag: string,
): Promise<DocumentDTO | null> {
  const after = await getDocument(env, documentId);
  if (!after) return null;
  await relayPages(
    env,
    documentId,
    [
      {
        kind: 'document-meta',
        name: after.name,
        tabs: after.tabs.map((t) => ({
          id: t.id,
          name: t.name,
          orderIndex: t.orderIndex,
          ...(t.folder ? { folder: t.folder } : {}),
          parent: t.parent ?? null,
        })),
      },
    ],
    tag,
  );
  return after;
}
