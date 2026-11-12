// Reading an item's tabs inside its Durable Object (item-tab-tables.ts): one tab, the tabs holding comments, a page of
// bodies in order, the first (or a named) body for the snapshot renderer, a row with its version, and the lazy
// backfill of a body's element count. Each product's `db/tabs.ts` binds these to its tables and its row mapper.

import { checkItemTabTables, type ItemTabTables } from './item-tab-tables';

/** A stored tab body with its id and its element count (null until known). */
export type ItemTabBody = { id: string; data: string; elementCount: number | null };

/** A tab's stored body with its version (`rev`, `updated_at`), which a compare-and-swap guards on. */
export type ItemTabRow = { data: string; rev: number; updatedAt: number };

export type ItemTabReadsConfig<Env, Row, Dto> = {
  db: (env: Env) => D1Database;
  tables: ItemTabTables;
  /** The product's mapper from a joined row (tab columns plus the link's) to its wire shape. */
  rowToTab: (row: Row) => Dto;
  /** How much a parsed body has to draw, for a body whose stored count is not yet known. */
  drawnCount: (body: { elements?: unknown; form?: unknown }) => number;
  /** The text a body holding a comment thread contains; default the `"commentThread"` key alone. */
  commentMarkers?: readonly string[];
};

export function itemTabReads<Env, Row, Dto>(config: ItemTabReadsConfig<Env, Row, Dto>) {
  const { db, rowToTab, drawnCount } = config;
  const { links, key } = checkItemTabTables(config.tables);
  const markers = config.commentMarkers ?? ['"commentThread"'];
  if (markers.length === 0 || markers.some((m) => m.includes("'"))) {
    throw new Error('item tab reads: a comment marker must be quotable');
  }
  const commentTest = markers.map((m) => `instr(t.data, '${m}') > 0`).join(' OR ');
  const hasComments = markers.length === 1 ? commentTest : `(${commentTest})`;
  const summary = `SELECT t.id, dt.${key}, t.name, dt.order_index, t.data, t.updated_at, t.rev, dt.folder, t.connection
       FROM tabs t
       JOIN ${links} dt ON dt.tab_id = t.id`;

  // Resolved through the link table, which carries the tab's place in the item: a linked tab surfaces from every
  // item that holds it, at that item's position.
  async function getTab(env: Env, itemId: string, tabId: string): Promise<Dto | null> {
    const row = await db(env)
      .prepare(
        `${summary}
      WHERE t.id = ? AND dt.${key} = ?`,
      )
      .bind(tabId, itemId)
      .first<Row>();
    return row ? rowToTab(row) : null;
  }

  // The item's tabs that hold a comment thread, in tab order (agent-presence PR21): the thread listing reads them
  // one at a time rather than every body at once.
  async function tabIdsWithComments(env: Env, itemId: string): Promise<string[]> {
    const { results } = await db(env)
      .prepare(
        `SELECT dt.tab_id FROM ${links} dt JOIN tabs t ON t.id = dt.tab_id
      WHERE dt.${key} = ?
        AND ${hasComments}
      ORDER BY dt.order_index, dt.tab_id`,
      )
      .bind(itemId)
      .all<{ tab_id: string }>();
    return results.map((r) => r.tab_id);
  }

  // A page of the item's tabs in order, bodies included: `overview` reads an item this way so it never holds more
  // than `limit` bodies at once (VW47).
  async function tabBodiesInOrder(
    env: Env,
    itemId: string,
    offset: number,
    limit: number,
  ): Promise<Dto[]> {
    const { results } = await db(env)
      .prepare(
        `${summary}
      WHERE dt.${key} = ?
      ORDER BY dt.order_index, t.id
      LIMIT ? OFFSET ?`,
      )
      .bind(itemId, limit, offset)
      .all<Row>();
    return results.map(rowToTab);
  }

  // The item's first tab, or `tabId`'s tab when given, as the snapshot renderer reads it.
  async function getTabBody(
    env: Env,
    itemId: string,
    tabId: string | null = null,
  ): Promise<ItemTabBody | null> {
    const row = await db(env)
      .prepare(
        `SELECT t.id, t.data, t.element_count
       FROM ${links} dt
       JOIN tabs t ON t.id = dt.tab_id
      WHERE dt.${key} = ?${tabId === null ? '' : ' AND dt.tab_id = ?'}
      ORDER BY dt.order_index ASC
      LIMIT 1`,
      )
      .bind(...(tabId === null ? [itemId] : [itemId, tabId]))
      .first<{ id: string; data: string; element_count: number | null }>();
    return row ? { id: row.id, data: row.data, elementCount: row.element_count ?? null } : null;
  }

  // How much the item's first tab has to draw: its stored count, or a parse of its body while the count is not yet
  // known. Zero with no tab or an unreadable body. Needs no snapshot store, unlike a render.
  async function firstTabElementCount(env: Env, itemId: string): Promise<number> {
    const body = await getTabBody(env, itemId);
    if (!body) return 0;
    if (body.elementCount !== null) return body.elementCount;
    try {
      return drawnCount(JSON.parse(body.data) as { elements?: unknown; form?: unknown });
    } catch {
      return 0;
    }
  }

  // The lazy backfill of `tabs.element_count`: a reader that has parsed a body whose count is still unknown records
  // it. Only ever fills a null, so it can never undo a write's own count.
  async function stampTabElementCount(env: Env, tabId: string, count: number): Promise<void> {
    await db(env)
      .prepare('UPDATE tabs SET element_count = ? WHERE id = ? AND element_count IS NULL')
      .bind(count, tabId)
      .run();
  }

  // The raw `tabs.data` JSON of a SPECIFIC tab in the item, or null when the item does not hold it. Resolved through
  // the link (like getTab) so a share code for item A can never coax out a tab that lives only in item B (the per-tab
  // live image, docs/specs/013-workspace/live-image-share.md). With the row's version.
  async function getTabRow(env: Env, itemId: string, tabId: string): Promise<ItemTabRow | null> {
    const row = await db(env)
      .prepare(
        `SELECT t.data, t.rev, t.updated_at
       FROM ${links} dt
       JOIN tabs t ON t.id = dt.tab_id
      WHERE dt.${key} = ? AND dt.tab_id = ?
      LIMIT 1`,
      )
      .bind(itemId, tabId)
      .first<{ data: string; rev: number; updated_at: number }>();
    return row ? { data: row.data, rev: row.rev, updatedAt: row.updated_at } : null;
  }

  // Does the item hold this tab? A ticket, changeset or view naming a tab the item lacks is refused.
  async function hasTab(env: Env, itemId: string, tabId: string): Promise<boolean> {
    const row = await db(env)
      .prepare(`SELECT 1 AS present FROM ${links} WHERE ${key} = ? AND tab_id = ?`)
      .bind(itemId, tabId)
      .first<{ present: number }>();
    return row !== null;
  }

  return {
    getTab,
    tabIdsWithComments,
    tabBodiesInOrder,
    getTabBody,
    firstTabElementCount,
    stampTabElementCount,
    getTabRow,
    hasTab,
  };
}
