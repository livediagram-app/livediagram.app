// Reading a plan's tabs (tabs.ts): one tab, its body, its row with its version, the bodies a read across the plan
// needs, and the lazy backfill of a body's element count. Inside the plan's Durable Object only, on `env.PLAN_DB`.

import { drawnCount } from '@liveplanner/project';
import { rowToTab, type TabRow } from '../tab-row';
import type { PlanEnv, TabDTO } from '../types';
import type { StoredTabRow } from '@liveworkspace/api-kit/tab-swap';

export async function getTab(
  env: PlanEnv,
  projectId: string,
  tabId: string,
): Promise<TabDTO | null> {
  // Resolve via the plan_tabs link table so a
  // linked tab surfaces from every project that contains it. The link
  // also carries the per-project order_index, so the returned summary's
  // position is correct for whichever project the caller asked about.
  const row = await env.PLAN_DB.prepare(
    `SELECT t.id, dt.plan_id, t.name, dt.order_index, t.data, t.updated_at, t.rev, dt.folder, t.connection
       FROM tabs t
       JOIN plan_tabs dt ON dt.tab_id = t.id
      WHERE t.id = ? AND dt.plan_id = ?`,
  )
    .bind(tabId, projectId)
    .first<TabRow>();
  return row ? rowToTab(row) : null;
}

// The project's tabs that hold a comment thread, in tab order (agent-presence PR21): the thread listing reads them
// one at a time rather than every body at once.
export async function tabIdsWithComments(env: PlanEnv, projectId: string): Promise<string[]> {
  const { results } = await env.PLAN_DB.prepare(
    `SELECT dt.tab_id FROM plan_tabs dt JOIN tabs t ON t.id = dt.tab_id
      WHERE dt.plan_id = ?
        AND (instr(t.data, '"commentThread"') > 0 OR instr(t.data, '"cellComments"') > 0)
      ORDER BY dt.order_index, dt.tab_id`,
  )
    .bind(projectId)
    .all<{ tab_id: string }>();
  return results.map((r) => r.tab_id);
}

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

// A page of a project's tabs in order, bodies included: `overview` reads a project this way so it
// never holds more than `limit` bodies at once (docs/specs/024-agents/blueprints/project-views.md, VW47).
export async function tabBodiesInOrder(
  env: PlanEnv,
  projectId: string,
  offset: number,
  limit: number,
): Promise<TabDTO[]> {
  const { results } = await env.PLAN_DB.prepare(
    `SELECT t.id, dt.plan_id, t.name, dt.order_index, t.data, t.updated_at, t.rev, dt.folder, t.connection
       FROM tabs t
       JOIN plan_tabs dt ON dt.tab_id = t.id
      WHERE dt.plan_id = ?
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

// A stored tab body with its id and its element count (null until known).
export type StoredTabBody = { id: string; data: string; elementCount: number | null };

// The project's first tab, or `tabId`'s tab when given, as the snapshot renderer reads it.
export async function getTabBody(
  env: PlanEnv,
  projectId: string,
  tabId: string | null = null,
): Promise<StoredTabBody | null> {
  const row = await env.PLAN_DB.prepare(
    `SELECT t.id, t.data, t.element_count
       FROM plan_tabs dt
       JOIN tabs t ON t.id = dt.tab_id
      WHERE dt.plan_id = ?${tabId === null ? '' : ' AND dt.tab_id = ?'}
      ORDER BY dt.order_index ASC
      LIMIT 1`,
  )
    .bind(...(tabId === null ? [projectId] : [projectId, tabId]))
    .first<{ id: string; data: string; element_count: number | null }>();
  return row ? { id: row.id, data: row.data, elementCount: row.element_count ?? null } : null;
}

// How much the project's first tab has to draw (drawnCount): its stored count, or a parse of its body while the count is
// not yet known. Zero with no tab or an unreadable body. Needs no snapshot store, unlike a render.
export async function firstTabElementCount(env: PlanEnv, projectId: string): Promise<number> {
  const body = await getTabBody(env, projectId);
  if (!body) return 0;
  if (body.elementCount !== null) return body.elementCount;
  try {
    return drawnCount(JSON.parse(body.data) as { elements?: unknown; form?: unknown });
  } catch {
    return 0;
  }
}

// The lazy backfill of tabs.element_count: a reader that has parsed a body whose count is still unknown
// records it. Only ever fills a null, so it can never undo a write's own count.
export async function stampTabElementCount(
  env: PlanEnv,
  tabId: string,
  count: number,
): Promise<void> {
  await env.PLAN_DB.prepare(
    'UPDATE tabs SET element_count = ? WHERE id = ? AND element_count IS NULL',
  )
    .bind(count, tabId)
    .run();
}

// The raw `tabs.data` JSON for a SPECIFIC tab in a project, or null when
// that tab isn't part of the project. Resolved through the plan_tabs
// link (like getTab) so a tab id only renders for a project that
// actually contains it: a share code for project A can never coax out
// a tab that lives only in project B. Backs the per-tab live image
// (docs/specs/013-workspace/live-image-share.md); mirrors getFirstTabData but keyed by tab id instead of the
// lowest order_index. With the row's version (`rev`, `updated_at`), which a compare-and-swap guards on.
export async function getTabRow(
  env: PlanEnv,
  projectId: string,
  tabId: string,
): Promise<StoredTabRow | null> {
  const row = await env.PLAN_DB.prepare(
    `SELECT t.data, t.rev, t.updated_at
       FROM plan_tabs dt
       JOIN tabs t ON t.id = dt.tab_id
      WHERE dt.plan_id = ? AND dt.tab_id = ?
      LIMIT 1`,
  )
    .bind(projectId, tabId)
    .first<{ data: string; rev: number; updated_at: number }>();
  return row ? { data: row.data, rev: row.rev, updatedAt: row.updated_at } : null;
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

// Does the plan hold this tab? A workbench ticket naming a tab the plan lacks is refused
// (docs/specs/013-workspace/blueprints/workbench-embeds.md "The ticket mint").
export async function planHasTab(env: PlanEnv, projectId: string, tabId: string): Promise<boolean> {
  const row = await env.PLAN_DB.prepare(
    'SELECT 1 AS present FROM plan_tabs WHERE plan_id = ? AND tab_id = ?',
  )
    .bind(projectId, tabId)
    .first<{ present: number }>();
  return row !== null;
}
