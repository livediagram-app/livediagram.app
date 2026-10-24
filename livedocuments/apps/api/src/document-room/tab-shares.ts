// A tab shared between documents (docs/specs/006-document/tab-document-many-to-many.md), with each document's
// content in its own Durable Object (docs/specs/015-api/api.md "Storage"). The mechanism is
// @liveworkspace/index-app's (tab-shares.ts): every holder keeps its own copy under the same tab id, a write is sent
// to the others from a trigger-filled outbox, and the later write wins. This is livedocuments' part of it: how a tab
// taken in is stored, what a body keeps beside it, and the images a body may carry.

import { createTabShares } from '@liveworkspace/index-app';
import type { SharedTabsSummary } from '@livedocuments/api-schema';
import type { Tab } from '@livedocuments/document';
import { imageRefIdsFromData } from '../image-refs/extract';
import { imageRefReplaceStatements } from '../db/image-refs';
import { servableImageIds } from '../db/image-grants';
import { tabStatsOfData, tabStatsStatement } from '../db/tab-stats';
import { tabWriteStatements } from '../db/tabs';
import type { DocumentEnv } from '../types';

export type { ShareAnswer, ShareMessage, SharedTabCopy } from '@liveworkspace/index-app';

export const documentShares = createTabShares<DocumentEnv>({
  db: (env) => env.DOCUMENT_DB,
  linkTable: 'document_tabs',
  itemColumn: 'document_id',
  // A tab taken in is stored as any new tab is: body, place, stats, image references, saved time.
  insertTab: (env, documentId, tab, orderIndex) =>
    tabWriteStatements(
      env,
      documentId,
      { ...(JSON.parse(tab.data) as Omit<Tab, 'id' | 'name'>), id: tab.id, name: tab.name },
      orderIndex,
      { advance: true },
    ),
  // A later body keeps what a local write keeps beside it.
  bodyTaken: (env, documentId, tab, now) => {
    const { stats } = tabStatsOfData(tab.data);
    return [
      env.DOCUMENT_DB.prepare('UPDATE tabs SET element_count = ? WHERE id = ?').bind(
        stats.elementCount,
        tab.id,
      ),
      tabStatsStatement(env, tab.id, stats, now),
      ...imageRefReplaceStatements(env, tab.id, imageRefIdsFromData(tab.data)),
      env.DOCUMENT_DB.prepare('UPDATE document SET saved_at = ? WHERE id = ?').bind(
        now,
        documentId,
      ),
    ];
  },
  // The images the body places that the sending document may serve travel with it, and the holder taking it in is
  // granted those (docs/specs/009-elements/images.md "Placement grants"), as a copy is: a shared tab shows its
  // pictures in every document holding it, and an id pasted in reaches no image its sender could not show.
  extra: {
    read: async (env, documentId, tab) => {
      const placed = imageRefIdsFromData(tab.data);
      if (placed.length === 0) return undefined;
      const images = [...(await servableImageIds(env, documentId, placed))];
      return images.length > 0 ? { images } : undefined;
    },
    apply: async (env, _documentId, tab, extra, now) => {
      const placed = new Set(imageRefIdsFromData(tab.data));
      const images = ((extra as { images?: unknown }).images ?? []) as unknown[];
      const granted = images.filter((id): id is string => typeof id === 'string' && placed.has(id));
      if (granted.length === 0) return [];
      return [
        env.DOCUMENT_DB.prepare(
          'INSERT OR IGNORE INTO image_grants (image_id, created_at) SELECT value, ? FROM json_each(?)',
        ).bind(now, JSON.stringify(granted)),
      ];
    },
  },
});

// How many of the document's tabs are shared with other documents, and with how many documents: what deleting it
// or taking it offline leaves in those (the "Shared-tab notice").
export async function sharedTabsSummary(
  env: DocumentEnv,
  documentId: string,
): Promise<SharedTabsSummary> {
  const { tabs, items } = await documentShares.count(env, documentId);
  return { tabs, documents: items };
}
