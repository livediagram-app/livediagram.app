// A tab shared between plans (docs/specs/006-project/tab-project-many-to-many.md), with each plan's content in its
// own Durable Object (docs/specs/015-api/api.md "Storage"). The mechanism is @liveworkspace/index-app's
// (tab-shares.ts): every holder keeps its own copy under the same tab id, a write is sent to the others from a
// trigger-filled outbox, and the later write wins. This is liveplanner's part of it: how a tab taken in is stored and
// what a body keeps beside it. A body is the tab alone: a board's cards and a Sheet's cells are rows of the plan, and
// stay with it.

import { createTabShares } from '@liveworkspace/index-app';
import type { SharedTabsSummary } from '@liveplanner/api-schema';
import type { Element, Tab } from '@liveplanner/project';
import { sheetRefIds, sheetRefReplaceStatements } from '../db/sheet-refs';
import { tabStatsOfData, tabStatsStatement } from '../db/tab-stats';
import { tabWriteStatements } from '../db/tabs';
import type { PlanEnv } from '../types';

export type { ShareAnswer, ShareMessage, SharedTabCopy } from '@liveworkspace/index-app';

// The sheet ids a stored body's elements reference.
function sheetRefIdsOfData(data: string): string[] {
  try {
    const elements = (JSON.parse(data) as { elements?: unknown }).elements;
    return Array.isArray(elements) ? sheetRefIds(elements as Element[]) : [];
  } catch {
    return [];
  }
}

export const planShares = createTabShares<PlanEnv>({
  db: (env) => env.PLAN_DB,
  linkTable: 'plan_tabs',
  itemColumn: 'plan_id',
  // A tab taken in is stored as any new tab is: body, place, stats, sheet references, saved time.
  insertTab: (env, planId, tab, orderIndex) =>
    tabWriteStatements(
      env,
      planId,
      { ...(JSON.parse(tab.data) as Omit<Tab, 'id' | 'name'>), id: tab.id, name: tab.name },
      orderIndex,
      { advance: true },
    ),
  // A later body keeps what a local write keeps beside it.
  bodyTaken: (env, planId, tab, now) => {
    const { stats } = tabStatsOfData(tab.data);
    return [
      env.PLAN_DB.prepare('UPDATE tabs SET element_count = ? WHERE id = ?').bind(
        stats.elementCount,
        tab.id,
      ),
      tabStatsStatement(env, tab.id, stats, now),
      ...sheetRefReplaceStatements(env, tab.id, sheetRefIdsOfData(tab.data)),
      env.PLAN_DB.prepare('UPDATE plan SET saved_at = ? WHERE id = ?').bind(now, planId),
    ];
  },
});

// How many of the plan's tabs are shared with other plans, and with how many plans: what taking it offline leaves in
// those (the "Shared-tab notice").
export async function sharedTabsSummary(env: PlanEnv, planId: string): Promise<SharedTabsSummary> {
  const { tabs, items } = await planShares.count(env, planId);
  return { tabs, projects: items };
}
