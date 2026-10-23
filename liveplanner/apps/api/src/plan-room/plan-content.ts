// The plan-level reads and writes of a plan's own SQLite (docs/specs/015-api/api.md "Storage") that the
// projects module used to make against D1: the tab outline a project read carries, the type catalogue, the plan
// row a create makes, and a copy's export and import. Runs inside the plan's Durable Object, on `env.PLAN_DB`.

import { itemIdsShownOnTab, readItemTypeCatalogue, type ItemTypeCatalogue } from '@liveplanner/items';
import type { TabItemElement } from '@liveplanner/items';
import { remapTabLinks, type Element } from '@liveplanner/project';
import { redactTabDataAuthors } from '../comments';
import { listItems } from '../db/items';
import { sheetRefIds } from '../db/sheet-refs';
import { tabStatsOfData, tabStatsStatement } from '../db/tab-stats';
import { rowToTabSummary, type TabRow } from '../tab-row';
import type { PlanEnv, TabSummaryDTO } from '../types';

// What a project read takes from the plan: its tabs in order (no body) and its type catalogue.
export type PlanOutline = {
  tabs: TabSummaryDTO[];
  itemTypes: ItemTypeCatalogue | null;
  itemTypesRev: number;
  // The plan's last save, ahead of D1's copy until the outbox pushes it.
  savedAt: number;
};

export async function readPlanOutline(env: PlanEnv, planId: string): Promise<PlanOutline> {
  const [tabs, plan] = await env.PLAN_DB.batch([
    env.PLAN_DB.prepare(
      `SELECT t.id, dt.plan_id, t.name, dt.order_index, '' AS data, t.updated_at, dt.folder
         FROM plan_tabs dt
         JOIN tabs t ON t.id = dt.tab_id
        WHERE dt.plan_id = ?
        ORDER BY dt.order_index ASC`,
    ).bind(planId),
    env.PLAN_DB.prepare('SELECT item_types, item_types_rev, saved_at FROM plan WHERE id = ?').bind(
      planId,
    ),
  ]);
  const head = (plan?.results?.[0] ?? null) as {
    item_types: string | null;
    item_types_rev: number;
    saved_at: number;
  } | null;
  return {
    tabs: ((tabs?.results ?? []) as TabRow[]).map(rowToTabSummary),
    itemTypes: readItemTypeCatalogue(head?.item_types ?? null),
    itemTypesRev: head?.item_types_rev ?? 0,
    savedAt: head?.saved_at ?? 0,
  };
}

// The plan's row, made with the plan: its dates and, on a genuine create, the type catalogue the create carries
// (docs/specs/026-plan/item-types.md "Storage and sync"). A re-commit of an existing plan keeps its catalogue.
export async function initPlan(
  env: PlanEnv,
  planId: string,
  d: { savedAt: number; createdAt: number; itemTypes?: ItemTypeCatalogue | null },
): Promise<void> {
  await env.PLAN_DB.prepare(
    `INSERT INTO plan (id, item_types, saved_at, created_at) VALUES (?1, ?2, ?3, ?4)
     ON CONFLICT (id) DO UPDATE SET
       item_types = COALESCE(plan.item_types, excluded.item_types),
       saved_at = excluded.saved_at`,
  )
    .bind(planId, d.itemTypes ? JSON.stringify(d.itemTypes) : null, d.savedAt, d.createdAt)
    .run();
}

// A plan's card types alone, for a snapshot that draws its cards. Null for a plan with no catalogue.
export async function getPlanItemTypes(
  env: PlanEnv,
  planId: string,
): Promise<ItemTypeCatalogue | null> {
  const row = await env.PLAN_DB.prepare('SELECT item_types FROM plan WHERE id = ?')
    .bind(planId)
    .first<{ item_types: string | null }>();
  return readItemTypeCatalogue(row?.item_types ?? null);
}

// Type catalogue write (docs/specs/026-plan/item-types.md "Storage and sync"): its own statement, so no meta save
// can rewrite it. `itemTypes` is already validated; null puts back the default types. Raises the catalogue's
// revision; with `expectedRev` it lands only while the stored revision is that one. Returns the new revision, or
// null when the stored one had moved on.
export async function setPlanItemTypes(
  env: PlanEnv,
  planId: string,
  itemTypes: ItemTypeCatalogue | null,
  expectedRev?: number,
): Promise<number | null> {
  const row = await env.PLAN_DB.prepare(
    `UPDATE plan SET item_types = ?, item_types_rev = item_types_rev + 1, saved_at = ?
      WHERE id = ? AND (? IS NULL OR item_types_rev = ?) RETURNING item_types_rev`,
  )
    .bind(
      itemTypes ? JSON.stringify(itemTypes) : null,
      Date.now(),
      planId,
      expectedRev ?? null,
      expectedRev ?? null,
    )
    .first<{ item_types_rev: number }>();
  return row?.item_types_rev ?? null;
}

// ---------- Copies --------------------------------------------------------------------------------------------

// A plan's content as one Durable Object hands it to another for a copy (docs/specs/015-api/api.md "Copies"):
// tabs under fresh ids (their links re-pointed), the items, and the copied tabs' sheets with their cells. Sent as
// one RPC message, so a plan past the 32 MiB a message may carry cannot be copied this way (the follow-up is to
// stream it in pages).
export type PlanCopy = {
  itemTypes: string | null;
  itemsRev: number;
  itemsNextKey: number;
  tabs: { id: string; name: string; orderIndex: number; folder: string | null; data: string; elementCount: number | null }[];
  items: Record<string, unknown>[];
  sheets: Record<string, unknown>[];
  cells: Record<string, unknown>[];
};

// The source side of a copy. `onlyTabId`: a tab-scoped visitor's copy takes that tab only (and the items it shows).
// `redactAuthorsFor`: anyone but the owner copies the comments as the tab read serves them to them.
export async function exportPlanCopy(
  env: PlanEnv,
  planId: string,
  onlyTabId: string | null,
  redactAuthorsFor: string | null,
): Promise<PlanCopy | null> {
  const plan = await env.PLAN_DB.prepare(
    'SELECT item_types, items_rev, items_next_key FROM plan WHERE id = ?',
  )
    .bind(planId)
    .first<{ item_types: string | null; items_rev: number; items_next_key: number }>();
  const tabRows = await env.PLAN_DB.prepare(
    `SELECT t.id, t.name, dt.order_index, dt.folder, t.data, t.element_count
       FROM plan_tabs dt
       JOIN tabs t ON t.id = dt.tab_id
      WHERE dt.plan_id = ?${onlyTabId === null ? '' : ' AND dt.tab_id = ?'}
      ORDER BY dt.order_index ASC`,
  )
    .bind(...(onlyTabId === null ? [planId] : [planId, onlyTabId]))
    .all<{
      id: string;
      name: string;
      order_index: number;
      folder: string | null;
      data: string;
      element_count: number | null;
    }>();
  const rows = tabRows.results ?? [];
  // Every fresh tab id minted up front, so a tab or element link on one tab can be re-pointed at its sibling's copy.
  const tabIdMap = new Map(rows.map((row) => [row.id, crypto.randomUUID()]));
  const tabs = rows.map((row) => {
    const remapped = remapTabDataLinks(row.data, tabIdMap);
    return {
      id: tabIdMap.get(row.id)!,
      name: row.name,
      orderIndex: row.order_index,
      folder: row.folder,
      data: redactAuthorsFor !== null ? redactTabDataAuthors(remapped, redactAuthorsFor) : remapped,
      // Link remapping rewrites ids inside elements, never their number, so the count carries over.
      elementCount: row.element_count,
    };
  });
  const itemIds = await copiedItemIds(env, planId, rows, onlyTabId);
  const items = await env.PLAN_DB.prepare(
    `SELECT id, type, item_key, rank, fields, rev, created_at, updated_at, created_by, updated_by
       FROM items WHERE plan_id = ?${itemIds === null ? '' : ' AND id IN (SELECT value FROM json_each(?))'}`,
  )
    .bind(...(itemIds === null ? [planId] : [planId, JSON.stringify(itemIds)]))
    .all<Record<string, unknown>>();
  // The copied tabs' sheets keep their ids (the copy's Sheet elements still frame them), under the tab's new id.
  const sourceTabs = JSON.stringify([...tabIdMap.keys()]);
  const sheets = await env.PLAN_DB.prepare(
    `SELECT id, tab_id, title, layout, cell_count, cell_bytes, created_at, updated_by
       FROM sheets WHERE plan_id = ? AND tab_id IN (SELECT value FROM json_each(?))`,
  )
    .bind(planId, sourceTabs)
    .all<Record<string, unknown>>();
  const cells = await env.PLAN_DB.prepare(
    `SELECT c.sheet_id, c.row_id, c.col_id, c.input, c.format
       FROM sheet_cells c JOIN sheets s ON s.plan_id = c.plan_id AND s.id = c.sheet_id
      WHERE c.plan_id = ? AND s.tab_id IN (SELECT value FROM json_each(?))`,
  )
    .bind(planId, sourceTabs)
    .all<Record<string, unknown>>();
  return {
    itemTypes: plan?.item_types ?? null,
    itemsRev: plan?.items_rev ?? 0,
    itemsNextKey: plan?.items_next_key ?? 1,
    tabs,
    items: items.results ?? [],
    sheets: (sheets.results ?? []).map((s) => ({ ...s, tab_id: tabIdMap.get(String(s.tab_id)) })),
    cells: cells.results ?? [],
  };
}

// The items a copy takes: all of them, or for a tab-scoped copy the items its one tab shows.
async function copiedItemIds(
  env: PlanEnv,
  planId: string,
  rows: { data: string }[],
  onlyTabId: string | null,
): Promise<string[] | null> {
  if (onlyTabId === null) return null;
  const elements = rows.flatMap((row) => {
    try {
      const parsed = JSON.parse(row.data) as { elements?: unknown };
      return Array.isArray(parsed.elements) ? (parsed.elements as TabItemElement[]) : [];
    } catch {
      return [];
    }
  });
  return [...itemIdsShownOnTab(elements, await listItems(env, planId))];
}

// Re-point the tab / element links inside one tab's stored `data` JSON at the copy's tab ids. The data is only
// parsed when it mentions a tab id, so the common link-free tab is copied byte for byte.
export function remapTabDataLinks(data: string, tabIdMap: Map<string, string>): string {
  // A tab or element link, or a Tab Window's tab: nothing to re-point without one.
  if (!data.includes('"tabId"') && !data.includes('"windowTabId"')) return data;
  try {
    const parsed = JSON.parse(data) as { elements?: Element[] };
    if (!Array.isArray(parsed.elements)) return data;
    return JSON.stringify({ ...parsed, elements: remapTabLinks(parsed.elements, tabIdMap) });
  } catch {
    return data;
  }
}

// Rows per bulk insert: each chunk is one JSON parameter, kept under the 2 MB a Durable Object SQLite string
// may hold.
const CHUNK_BYTES = 1_000_000;

function chunksOf(rows: readonly Record<string, unknown>[]): string[] {
  const out: string[] = [];
  let current: string[] = [];
  let size = 2;
  for (const row of rows) {
    const json = JSON.stringify(row);
    if (current.length > 0 && size + json.length + 1 > CHUNK_BYTES) {
      out.push(`[${current.join(',')}]`);
      current = [];
      size = 2;
    }
    current.push(json);
    size += json.length + 1;
  }
  if (current.length > 0) out.push(`[${current.join(',')}]`);
  return out;
}

// The target side of a copy: the plan's row and everything the export carried, in one transaction, so a copy
// lands whole or not at all. The collaboration index and listing summary follow from the outbox.
export async function importPlanCopy(
  env: PlanEnv,
  planId: string,
  copy: PlanCopy,
  now = Date.now(),
): Promise<void> {
  const db = env.PLAN_DB;
  // A copy makes a new plan: one that already holds content keeps it, and nothing is written. Read and write
  // run back to back in the plan's own object, so nothing lands between them.
  const held = await db
    .prepare(
      `SELECT EXISTS (SELECT 1 FROM plan_tabs WHERE plan_id = ?1)
           OR EXISTS (SELECT 1 FROM items WHERE plan_id = ?1) AS held`,
    )
    .bind(planId)
    .first<{ held: number }>();
  if (held?.held) throw new Error('plan_not_empty');
  const stmts: D1PreparedStatement[] = [
    db
      .prepare(
        `INSERT INTO plan (id, item_types, items_rev, items_next_key, saved_at, created_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?5)
         ON CONFLICT (id) DO UPDATE SET item_types = excluded.item_types, items_rev = excluded.items_rev,
           items_next_key = excluded.items_next_key, saved_at = excluded.saved_at`,
      )
      .bind(planId, copy.itemTypes, copy.itemsRev, copy.itemsNextKey, now),
  ];
  for (const tab of copy.tabs) {
    stmts.push(
      db
        .prepare(
          'INSERT INTO tabs (id, name, data, updated_at, element_count, rev) VALUES (?, ?, ?, ?, ?, 1)',
        )
        .bind(tab.id, tab.name, tab.data, now, tab.elementCount ?? null),
      db
        .prepare(
          'INSERT INTO plan_tabs (plan_id, tab_id, order_index, added_at, folder) VALUES (?, ?, ?, ?, ?)',
        )
        .bind(planId, tab.id, tab.orderIndex, now, tab.folder),
      // From the copied body itself (docs/specs/013-workspace/explorer-details-view.md).
      tabStatsStatement(env, tab.id, tabStatsOfData(tab.data).stats, now),
    );
  }
  for (const chunk of chunksOf(copy.items)) {
    stmts.push(
      db
        .prepare(
          `INSERT INTO items (plan_id, id, type, item_key, rank, fields, rev, created_at, updated_at, created_by, updated_by)
           SELECT ?1, value ->> '$.id', value ->> '$.type', value ->> '$.item_key', value ->> '$.rank',
                  value ->> '$.fields', value ->> '$.rev', value ->> '$.created_at', value ->> '$.updated_at',
                  value ->> '$.created_by', value ->> '$.updated_by'
             FROM json_each(?2)`,
        )
        .bind(planId, chunk),
    );
  }
  for (const chunk of chunksOf(copy.sheets)) {
    stmts.push(
      db
        .prepare(
          `INSERT INTO sheets (plan_id, id, tab_id, title, layout, rev, cell_count, cell_bytes, created_at, updated_at, updated_by)
           SELECT ?1, value ->> '$.id', value ->> '$.tab_id', value ->> '$.title', value ->> '$.layout', 0,
                  value ->> '$.cell_count', value ->> '$.cell_bytes', value ->> '$.created_at', ?2,
                  value ->> '$.updated_by'
             FROM json_each(?3)`,
        )
        .bind(planId, now, chunk),
    );
  }
  for (const chunk of chunksOf(copy.cells)) {
    stmts.push(
      db
        .prepare(
          `INSERT INTO sheet_cells (plan_id, sheet_id, row_id, col_id, input, format)
           SELECT ?1, value ->> '$.sheet_id', value ->> '$.row_id', value ->> '$.col_id', value ->> '$.input',
                  value ->> '$.format'
             FROM json_each(?2)`,
        )
        .bind(planId, chunk),
    );
  }
  // The copy's Sheets reference the copied sheets, after the sheets, so the reference triggers find them.
  for (const tab of copy.tabs) {
    const ids = sheetRefsOfData(tab.data);
    if (ids.length === 0) continue;
    stmts.push(
      db
        .prepare('INSERT OR IGNORE INTO sheet_refs (tab_id, sheet_id) SELECT ?, value FROM json_each(?)')
        .bind(tab.id, JSON.stringify(ids)),
    );
  }
  await db.batch(stmts);
}

function sheetRefsOfData(data: string): string[] {
  if (!data.includes('"plan-sheet"')) return [];
  try {
    const parsed = JSON.parse(data) as { elements?: Element[] };
    return Array.isArray(parsed.elements) ? sheetRefIds(parsed.elements) : [];
  } catch {
    return [];
  }
}

// Owe D1 a tab's derived rows again (plan-outbox.ts), for a D1 row made outside the plan that carries them: a new
// form link takes its tab's name and heading from the next drain.
export async function resendPlanTab(env: PlanEnv, tabId: string): Promise<void> {
  const rows = "SELECT plan_id, 'tab', tab_id FROM plan_tabs WHERE tab_id = ?1";
  await env.PLAN_DB.batch([
    env.PLAN_DB.prepare(`DELETE FROM outbox WHERE (plan_id, kind, key) IN (${rows})`).bind(tabId),
    env.PLAN_DB.prepare(`INSERT INTO outbox (plan_id, kind, key) ${rows}`).bind(tabId),
  ]);
}
