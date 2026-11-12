// tabs: one row per tab in the document's own SQLite (docs/specs/015-api/api.md "Storage"), placed in the document
// by `document_tabs`. Runs only inside the document's Durable Object, on `env.DOCUMENT_DB`
// (@liveworkspace/index-app item-db.ts). The reads and writes are @liveworkspace/index-app's (item-tab-reads.ts,
// item-tab-writes.ts, item-tab-order.ts); this binds them to the document's tables, its tab size cap, its stats, its
// image reference index and what a tab's delete takes with it here.

import {
  itemTabOrder,
  itemTabReads,
  itemTabWrites,
  type ItemTabBody,
} from '@liveworkspace/index-app';
import { DOCUMENT_OUTBOX } from '../document-room/document-outbox';
import { capElementActions, drawnCount, type Tab } from '@livehuddle/document';
import { rowToTab, type TabRow } from '../tab-row';
import { MAX_TAB_BYTES, TabTooLargeError, byteLength, logTabRefused } from '../limits';
import type { DocumentEnv, TabDTO } from '../types';
import { imageRefIds } from '@liveworkspace/api-kit/image-refs';
import { tabStatsOf, tabStatsStatement, type TabStats } from './tab-stats';
import { imageRefAddStatements, imageRefReplaceStatements } from './image-refs';

export {
  isTabRevStale,
  normalizeReorderEntry,
  readReorderEntries,
  revFromBatch,
  type DeletedTab,
} from '@liveworkspace/index-app';

// Every write of a tab's data meets this first (docs/specs/015-api/api.md "Tab size"): data over the
// cap would fail in D1 with a generic error (and pass locally, where the row cap isn't enforced), so
// it is refused here, logged, and nothing is written.
function assertTabDataFits(tabId: string, data: string, write: string): void {
  const bytes = byteLength(data);
  if (bytes <= MAX_TAB_BYTES) return;
  logTabRefused(write, tabId, bytes);
  throw new TabTooLargeError(tabId, bytes, write);
}

const db = (env: DocumentEnv) => env.DOCUMENT_DB;
const tables = { item: 'document', links: 'document_tabs', key: 'document_id' };

// A stored tab body with its id and its element count (null until known).
export type StoredTabBody = ItemTabBody;

// The element count backfill is migration 0059's. A page of bodies in order:
// docs/specs/024-agents/blueprints/document-views.md (VW47). A tab's row with its version backs the per-tab live
// image (docs/specs/013-workspace/live-image-share.md). A changeset or view naming a tab the document lacks
// (documentHasTab) is refused.
export const {
  getTab,
  tabIdsWithComments,
  tabBodiesInOrder,
  getTabBody,
  firstTabElementCount,
  stampTabElementCount,
  getTabRow,
  hasTab: documentHasTab,
} = itemTabReads<DocumentEnv, TabRow, TabDTO>({ db, tables, rowToTab, drawnCount });

// The writes. Action panel lists are bounded at the one place every tab write meets
// (docs/specs/012-collaboration/action-panel.md "The data"). The image reference index
// (docs/specs/009-elements/images.md, "Reference index") is replaced with every write: a reference a transaction
// missed is an image the media service may sweep (src/media.ts); its placement grants follow from the outbox
// (document-room/document-outbox.ts). A delete takes the tab's stats, image references, changesets and the documents
// it was shared with by the foreign keys, and its Suggestion Boxes' notes and Attendance below. A seed's `savedAt`:
// docs/specs/015-api/api.md "Document dates".
export const {
  tabWriteStatements,
  upsertTab,
  upsertTabAtRev,
  renameTab,
  seedTabs,
  deleteTabRow,
  swapTabData,
} = itemTabWrites<DocumentEnv, Tab, TabStats>({
  db,
  tables,
  outbox: () => DOCUMENT_OUTBOX,
  prepareTab: (tab) => ({ ...tab, elements: capElementActions(tab.elements) }),
  drawnCount,
  assertFits: assertTabDataFits,
  statsOf: tabStatsOf,
  statsStatement: tabStatsStatement,
  refsOnWrite: (env, tab) => imageRefReplaceStatements(env, tab.id, imageRefIds(tab.elements)),
  refsOnSwap: (env, tabId, body) =>
    imageRefAddStatements(
      env,
      tabId,
      imageRefIds(body.elements, (body as { pages?: unknown }).pages),
    ),
  onDelete: {
    afterBody: (env, documentId, tabId) => [
      // Its Suggestion Boxes' notes go with it (docs/specs/009-elements/team-pieces.md "Suggestion Box").
      env.DOCUMENT_DB.prepare('DELETE FROM suggestions WHERE document_id = ? AND tab_id = ?').bind(
        documentId,
        tabId,
      ),
      // And its Attendance (docs/specs/012-collaboration/tab-attendance.md "How long it is kept").
      env.DOCUMENT_DB.prepare('DELETE FROM tab_attendance WHERE tab_id = ?').bind(tabId),
    ],
  },
});

// Order and folder (docs/specs/006-document/tab-folders.md), cheap at the < 20-tab scale seen in practice
// (docs/specs/006-document/per-tab-storage.md "Risk").
export const { reorderTabs } = itemTabOrder<DocumentEnv>({ db, tables, savedAt: 'in-batch' });
