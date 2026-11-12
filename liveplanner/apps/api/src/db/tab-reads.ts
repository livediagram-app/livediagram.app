// Reading a plan's tabs (tabs.ts): one tab, its body, its row with its version, the bodies a read across the plan
// needs, and the lazy backfill of a body's element count. Inside the plan's Durable Object only, on `env.PLAN_DB`.
// The reads every item has are @liveworkspace/index-app's; the board and Dashboard reads are the plan's own.

import { itemTabReads, type ItemTabBody } from '@liveworkspace/index-app';
import { drawnCount } from '@liveplanner/project';
import { rowToTab, type TabRow } from '../tab-row';
import type { PlanEnv, TabDTO } from '../types';

const db = (env: PlanEnv) => env.PLAN_DB;
const tables = { item: 'plan', links: 'plan_tabs', key: 'plan_id' };

// The shared reads (@liveworkspace/index-app item-tab-reads.ts) on the plan's tables. A comment lives in a thread or
// a sheet's cell comments. A page of bodies in order: docs/specs/024-agents/blueprints/project-views.md (VW47). A
// tab's row with its version backs the per-tab live image (docs/specs/013-workspace/live-image-share.md). Whether the
// plan holds a tab: a workbench ticket naming a tab the plan lacks is refused
// (docs/specs/013-workspace/blueprints/workbench-embeds.md "The ticket mint").
export const {
  getTab,
  tabIdsWithComments,
  tabBodiesInOrder,
  getTabBody,
  firstTabElementCount,
  stampTabElementCount,
  getTabRow,
  hasTab: planHasTab,
} = itemTabReads<PlanEnv, TabRow, TabDTO>({
  db,
  tables,
  rowToTab,
  drawnCount,
  commentMarkers: ['"commentThread"', '"cellComments"'],
});

// A stored tab body with its id and its element count (null until known).
export type StoredTabBody = ItemTabBody;

// A page of the project's tabs that hold a Plan board, in tab order, bodies included: the plan route
// (docs/specs/026-plan/plan-agents.md "Cost") never parses a tab without a board.
export async function tabBodiesWithBoards(
  env: PlanEnv,
  projectId: string,
  offset: number,
  limit: number,
): Promise<TabDTO[]> {
  const { results } = await env.PLAN_DB.prepare(
    `SELECT t.id, dt.plan_id, t.name, dt.order_index, t.data, t.updated_at, t.rev, dt.folder
       FROM tabs t
       JOIN plan_tabs dt ON dt.tab_id = t.id
      WHERE dt.plan_id = ? AND instr(t.data, '"plan-board"') > 0
      ORDER BY dt.order_index, t.id
      LIMIT ? OFFSET ?`,
  )
    .bind(projectId, limit, offset)
    .all<TabRow>();
  return results.map(rowToTab);
}

// The tabs a Dashboard's image draws from (docs/specs/013-workspace/live-image-share.md "A Dashboard"): those its slots
// show (`slotTabIds`) and those holding a Plan board (whose columns name the statuses its charts count by), in tab
// order, at most `limit` of them. One query, bodies included.
export async function dashboardSourceTabs(
  env: PlanEnv,
  projectId: string,
  slotTabIds: readonly string[],
  limit: number,
): Promise<TabDTO[]> {
  const shown = slotTabIds.length
    ? ` OR dt.tab_id IN (${slotTabIds.map(() => '?').join(', ')})`
    : '';
  const { results } = await env.PLAN_DB.prepare(
    `SELECT t.id, dt.plan_id, t.name, dt.order_index, t.data, t.updated_at, t.rev, dt.folder
       FROM tabs t
       JOIN plan_tabs dt ON dt.tab_id = t.id
      WHERE dt.plan_id = ? AND (instr(t.data, '"plan-board"') > 0${shown})
      ORDER BY dt.order_index, t.id
      LIMIT ?`,
  )
    .bind(projectId, ...slotTabIds, limit)
    .all<TabRow>();
  return results.map(rowToTab);
}

// A tab's revision alone, or null when the plan lacks it: the room's scoped-structure check reads the stored body
// only when this has moved on (room-scoped-structure.ts).
export async function getTabRev(
  env: PlanEnv,
  projectId: string,
  tabId: string,
): Promise<number | null> {
  const row = await env.PLAN_DB.prepare(
    `SELECT t.rev FROM tabs t JOIN plan_tabs dt ON dt.tab_id = t.id WHERE t.id = ? AND dt.plan_id = ?`,
  )
    .bind(tabId, projectId)
    .first<{ rev: number }>();
  return row?.rev ?? null;
}
