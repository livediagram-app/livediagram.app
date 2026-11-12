// tabs: one row per tab in the design's own SQLite (docs/specs/015-api/api.md "Storage"), placed in the design by
// `design_tabs`. Runs only inside the design's Durable Object, on `env.DESIGN_DB` (design-room/design-db.ts). The
// reads and writes are @liveworkspace/index-app's (item-tab-reads.ts, item-tab-writes.ts, item-tab-order.ts); this
// binds them to the design's tables, its tab size cap, its stats, and its image and component reference indexes.

import {
  itemTabOrder,
  itemTabReads,
  itemTabWrites,
  type ItemTabBody,
} from '@liveworkspace/index-app';
import { DESIGN_OUTBOX } from '../design-room/design-outbox';
import { capElementActions, componentRefIds, drawnCount, type Tab } from '@livedesign/design';
import { rowToTab, type TabRow } from '../tab-row';
import { MAX_TAB_BYTES, TabTooLargeError, byteLength, logTabRefused } from '../limits';
import type { DesignEnv, TabDTO } from '../types';
import { imageRefIds } from '@liveworkspace/api-kit/image-refs';
import { tabStatsOf, tabStatsStatement, type TabStats } from './tab-stats';
import {
  imageRefAddStatements,
  imageRefPruneTabStatement,
  imageRefReplaceStatements,
} from './image-refs';
import {
  componentRefAddStatements,
  componentRefPruneTabStatement,
  componentRefReplaceStatements,
} from './components';

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

const db = (env: DesignEnv) => env.DESIGN_DB;
const tables = { item: 'design', links: 'design_tabs', key: 'design_id' };

// A stored tab body with its id and its element count (null until known).
export type StoredTabBody = ItemTabBody;

// The element count backfill is the baseline migration's. A page of bodies in order:
// docs/specs/024-agents/blueprints/design-views.md (VW47). A tab's row with its version backs the per-tab live image
// (docs/specs/013-workspace/live-image-share.md). Whether the design holds a tab: a workbench ticket naming a tab the
// design lacks is refused (docs/specs/013-workspace/blueprints/workbench-embeds.md "The ticket mint").
export const {
  getTab,
  tabIdsWithComments,
  tabBodiesInOrder,
  getTabBody,
  stampTabElementCount,
  getTabRow,
  hasTab: designHasTab,
} = itemTabReads<DesignEnv, TabRow, TabDTO>({ db, tables, rowToTab, drawnCount });

// The writes. Action panel lists are bounded at the one place every tab write meets
// (docs/specs/012-collaboration/assigned-actions.md). The image reference index (docs/specs/009-elements/images.md,
// "Reference index") and the mains its instances use (docs/specs/009-elements/components.md) are replaced with every
// write: a reference a batch missed is an image the retention sweep reaps. A delete takes the tab's stats and
// changesets by the foreign keys, and its image, component and photo references below (no foreign key cascades
// them; the outbox triggers tell the media service the design no longer shows its images,
// design-room/design-outbox.ts); its body goes even while another design still links it. A seed's `savedAt`:
// docs/specs/015-api/api.md "Design dates".
export const {
  tabWriteStatements,
  upsertTab,
  upsertTabAtRev,
  renameTab,
  seedTabs,
  deleteTabRow,
  swapTabData,
} = itemTabWrites<DesignEnv, Tab, TabStats>({
  db,
  tables,
  outbox: () => DESIGN_OUTBOX,
  prepareTab: (tab) => ({ ...tab, elements: capElementActions(tab.elements) }),
  drawnCount,
  assertFits: assertTabDataFits,
  statsOf: tabStatsOf,
  statsStatement: tabStatsStatement,
  refsOnWrite: (env, tab) => [
    ...imageRefReplaceStatements(env, tab.id, imageRefIds(tab.elements, tab.pages)),
    ...componentRefReplaceStatements(env, tab.id, componentRefIds(tab.elements)),
  ],
  refsOnSwap: (env, tabId, body) => [
    ...imageRefAddStatements(env, tabId, imageRefIds(body.elements, body.pages)),
    ...componentRefAddStatements(env, tabId, componentRefIds(body.elements)),
  ],
  onDelete: {
    afterLeft: (env, _designId, tabId) => [
      imageRefPruneTabStatement(env, tabId),
      componentRefPruneTabStatement(env, tabId),
      env.DESIGN_DB.prepare('DELETE FROM photo_blob_refs WHERE tab_id = ?').bind(tabId),
    ],
    bodyEvenIfLinked: true,
  },
});

// Order and folder (docs/specs/006-design/tab-folders.md), per design: moving a tab here leaves its place in every
// other design, and its body, untouched. Cheap at the < 20-tab scale seen in practice
// (docs/specs/006-design/per-tab-storage.md "Risk").
export const { reorderTabs } = itemTabOrder<DesignEnv>({ db, tables, savedAt: 'after' });
