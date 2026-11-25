// A connected tab the index adds to this document (liveworkspace/docs/specs/004-index/connected-tabs.md "Both ways"):
// the reverse of a connection made both ways, written through the internal door (routes/internal-items.ts) with the
// app's INDEX_KEY. The kit appends it (@liveworkspace/index-app connected-tabs.ts): an empty tab, loose, at the end of
// the tab bar, holding the connection in its column; this is how liveknowledge stores the tab, and the document-meta
// op that shows it to everyone with the document open.

import {
  appendConnectedTab,
  removeConnectedTabOf,
  type ConnectedTabOutcome,
  type DisconnectedTabOutcome,
} from '@liveworkspace/index-app';
import type { ConnectedTabWrite } from '@liveworkspace/index-client';
import type { RoomOp } from '@liveknowledge/api-schema';
import { deleteTabRow, tabWriteStatements } from '../db/tabs';
import type { DocumentEnv } from '../types';
import { readDocumentMeta, readDocumentOutline } from './document-content';

// The reverse write, or `not_found` for a document not started.
export async function addConnectedDocumentTab(
  env: DocumentEnv,
  documentId: string,
  write: ConnectedTabWrite,
): Promise<ConnectedTabOutcome> {
  if (!(await readDocumentMeta(env, documentId))) return 'not_found';
  return appendConnectedTab(env.DOCUMENT_DB, documentId, write, {
    linkTable: 'document_tabs',
    itemColumn: 'document_id',
    // Stored as any new tab is: an empty body, its place, its stats and the document's save time.
    insertTab: (tabId, name, orderIndex) =>
      tabWriteStatements(env, documentId, { id: tabId, name, elements: [] }, orderIndex, {
        advance: true,
      }),
  });
}

// Connect as tabs (liveworkspace/docs/specs/004-index/connected-tabs.md "Linked from a Send to"): the linked tab whose
// pair was removed in the other file goes here too, deleted as any tab is (an item's last tab kept), or `not_found`
// for an item not started.
export async function removeConnectedDocumentTab(
  env: DocumentEnv,
  documentId: string,
  connectionId: string,
): Promise<DisconnectedTabOutcome> {
  if (!(await readDocumentMeta(env, documentId))) return 'not_found';
  return removeConnectedTabOf(env.DOCUMENT_DB, documentId, connectionId, {
    linkTable: 'document_tabs',
    itemColumn: 'document_id',
    deleteTab: (tabId) => deleteTabRow(env, documentId, tabId, { keepLast: true }),
  });
}

// The document's tabs as an editor's own tab add sends them, so open editors place the new tab where it is.
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
      parent: t.parent ?? null,
      ...(t.folder ? { folder: t.folder } : {}),
      ...(t.connection ? { connection: t.connection } : {}),
    })),
  };
}
