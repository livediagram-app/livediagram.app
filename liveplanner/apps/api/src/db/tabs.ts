// tabs: one row per tab in the plan's own SQLite (docs/specs/015-api/api.md "Storage"), placed in the plan by
// `plan_tabs`. Runs only inside the plan's Durable Object, on `env.PLAN_DB` (plan-room/plan-db.ts). The writes are
// @liveworkspace/index-app's (item-tab-writes.ts, item-tab-order.ts), and so are most reads (tab-reads.ts); this
// binds them to the plan's tables, its tab size cap, its stats and its sheet reference index.

import { itemTabOrder, itemTabWrites } from '@liveworkspace/index-app';
import { PLAN_OUTBOX } from '../plan-room/plan-outbox';
import { capElementActions, drawnCount, type Tab } from '@liveplanner/project';
import { MAX_TAB_BYTES, TabTooLargeError, byteLength, logTabRefused } from '../limits';

// Every write of a tab's data meets this first (docs/specs/015-api/api.md "Tab size"): data over the
// cap would fail in D1 with a generic error (and pass locally, where the row cap isn't enforced), so
// it is refused here, logged, and nothing is written.
function assertTabDataFits(tabId: string, data: string, write: string): void {
  const bytes = byteLength(data);
  if (bytes <= MAX_TAB_BYTES) return;
  logTabRefused(write, tabId, bytes);
  throw new TabTooLargeError(tabId, bytes, write);
}
import type { PlanEnv } from '../types';
import { storedTabStatsOf, tabStatsStatement, type StoredTabStats } from './tab-stats';
import { sheetRefIds, sheetRefReplaceStatements, sheetSettleStatements } from './sheet-refs';
export {
  type StoredTabBody,
  getTab,
  tabIdsWithComments,
  tabBodiesWithBoards,
  tabBodiesInOrder,
  dashboardSourceTabs,
  getTabBody,
  firstTabElementCount,
  stampTabElementCount,
  getTabRow,
  getTabRev,
  planHasTab,
} from './tab-reads';
export {
  isTabRevStale,
  normalizeReorderEntry,
  readReorderEntries,
  revFromBatch,
  type DeletedTab,
} from '@liveworkspace/index-app';

const db = (env: PlanEnv) => env.PLAN_DB;
const tables = { item: 'plan', links: 'plan_tabs', key: 'plan_id' };

// The writes. Action panel lists are bounded at the one place every tab write meets
// (docs/specs/012-collaboration/action-panel.md "The data"). The sheet reference index
// (docs/specs/029-sheets/sheet-store.md "Deleting a sheet") is replaced with every write, after the tabs and
// plan_tabs upserts, which the rows' FK and the settling triggers read; a write whose references are unchanged
// touches no row, so the triggers cost it nothing. A seed's sheets come after its tabs (routes/projects.ts), so they
// find these references on create. A delete takes the tab's stats, references and changesets by the foreign keys,
// and the plan's sheets settle in the same transaction. A seed's `savedAt`: docs/specs/015-api/api.md "Project
// dates".
export const {
  tabWriteStatements,
  upsertTab,
  upsertTabAtRev,
  renameTab,
  seedTabs,
  deleteTabRow,
  swapTabData,
} = itemTabWrites<PlanEnv, Tab, StoredTabStats>({
  db,
  tables,
  outbox: () => PLAN_OUTBOX,
  prepareTab: (tab) => ({ ...tab, elements: capElementActions(tab.elements) }),
  drawnCount,
  assertFits: assertTabDataFits,
  statsOf: storedTabStatsOf,
  statsStatement: tabStatsStatement,
  refsOnWrite: (env, tab) => sheetRefReplaceStatements(env, tab.id, sheetRefIds(tab.elements)),
  onDelete: {
    // The tab's references are gone with it, so the plan's sheets settle here.
    afterBody: (env, projectId) => sheetSettleStatements(env, projectId, Date.now()),
  },
});

// Order and folder (docs/specs/006-project/tab-folders.md), per project: moving a tab here leaves its place in
// every other project, and its body, untouched. Cheap at the < 20-tab scale seen in practice
// (docs/specs/006-project/per-tab-storage.md "Risk").
export const { reorderTabs } = itemTabOrder<PlanEnv>({ db, tables, savedAt: 'after' });
