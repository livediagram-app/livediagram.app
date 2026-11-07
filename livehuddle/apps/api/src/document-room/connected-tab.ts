// A connected tab the index adds to this Space (liveworkspace/docs/specs/004-index/connected-tabs.md "Both ways"):
// the reverse of a connection made both ways, written through the internal door (routes/internal-items.ts) with the
// app's INDEX_KEY. The kit appends it (@liveworkspace/index-app connected-tabs.ts): an empty tab, loose, at the end of
// the tab bar, holding the connection in its column; this is how livehuddle stores the tab, and the document-meta
// op that shows it to everyone with the Space open.

import { appendConnectedTab, type ConnectedTabOutcome } from '@liveworkspace/index-app';
import type { ConnectedTabWrite } from '@liveworkspace/index-client';
import type { RoomOp } from '@livehuddle/api-schema';
import { tabWriteStatements } from '../db/tabs';
import type { DocumentEnv } from '../types';
import { readDocumentMeta, readDocumentOutline } from './document-content';

// The reverse write, or `not_found` for a Space not started.
export async function addConnectedDocumentTab(
  env: DocumentEnv,
  documentId: string,
  write: ConnectedTabWrite,
): Promise<ConnectedTabOutcome> {
  if (!(await readDocumentMeta(env, documentId))) return 'not_found';
  return appendConnectedTab(env.DOCUMENT_DB, documentId, write, {
    linkTable: 'document_tabs',
    itemColumn: 'document_id',
    // Stored as any new tab is: an empty body, its place, its stats and the Space's save time.
    insertTab: (tabId, name, orderIndex) =>
      tabWriteStatements(env, documentId, { id: tabId, name, elements: [] }, orderIndex, {
        advance: true,
      }),
  });
}

// The Space's tabs as an editor's own tab add sends them, so open editors place the new tab where it is.
export async function connectedTabArrival(
  env: DocumentEnv,
  documentId: string,
): Promise<RoomOp | null> {
  const outline = await readDocumentOutline(env, documentId);
  if (!outline.meta) return null;
  return {
    kind: 'document-meta',
    name: outline.meta.name,
    tabs: outline.tabs.map((t) => ({
      id: t.id,
      name: t.name,
      orderIndex: t.orderIndex,
      ...(t.folder ? { folder: t.folder } : {}),
      ...(t.connection ? { connection: t.connection } : {}),
    })),
  };
}
