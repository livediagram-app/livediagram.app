// An item's tab order and folders inside its Durable Object (item-tab-tables.ts; each product's
// docs/specs/006-*/tab-folders.md). Order and folder live on the link row, never in the per-tab content write, so a
// content save can't clobber them, and moving a tab leaves its body (and its place in any other item) untouched.

import { checkItemTabTables, type ItemTabTables } from './item-tab-tables';

// One position in a reorder request: the tab id plus its folder in this item. `null` or omitted is loose. A plain
// string is the legacy (pre-folder) payload shape, treated as loose.
export type ReorderEntry = string | { id: string; folder?: string | null };

const isReorderEntry = (e: unknown): e is ReorderEntry => {
  if (typeof e === 'string') return true;
  if (!e || typeof e !== 'object') return false;
  const { id, folder } = e as { id?: unknown; folder?: unknown };
  return typeof id === 'string' && (folder == null || typeof folder === 'string');
};

// A request's reorder entries, or null when any is not one (a tab id, or an id with a text or null folder): the
// caller refuses the request before it writes anything.
export function readReorderEntries(raw: unknown[]): ReorderEntry[] | null {
  return raw.every(isReorderEntry) ? raw : null;
}

// Normalise one reorder entry to its (id, folder) form: legacy string entries are loose, and empty or whitespace
// folder names collapse to NULL so a blank folder can never persist.
export function normalizeReorderEntry(entry: ReorderEntry): { id: string; folder: string | null } {
  if (typeof entry === 'string') return { id: entry, folder: null };
  const trimmed = entry.folder?.trim();
  return { id: entry.id, folder: trimmed ? trimmed : null };
}

export type ItemTabOrderConfig<Env> = {
  db: (env: Env) => D1Database;
  tables: ItemTabTables;
  /**
   * `in-batch` writes the item's `saved_at` in the reorder's own batch; `after` writes it on its own once the batch
   * (skipped when it moves nothing) has run.
   */
  savedAt: 'in-batch' | 'after';
};

export function itemTabOrder<Env>(config: ItemTabOrderConfig<Env>) {
  const { db } = config;
  const { item, links, key } = checkItemTabTables(config.tables);

  // Update tab order and folder membership. The caller passes the entries in their new positions; every order_index
  // (and folder) is rewritten in one batch, cheap at the tab counts an item holds.
  async function reorderTabs(env: Env, itemId: string, entries: ReorderEntry[]): Promise<void> {
    const now = Date.now();
    // Only the item's own tabs, each once at the last place the request names it (what writing every entry in turn
    // left): ids it lacks would update nothing, and a body of a million of them was a statement each.
    const { results } = await db(env)
      .prepare(`SELECT tab_id FROM ${links} WHERE ${key} = ?`)
      .bind(itemId)
      .all<{ tab_id: string }>();
    const held = new Set(results.map((r) => r.tab_id));
    const placed = new Map<string, { idx: number; folder: string | null }>();
    entries.forEach((entry, idx) => {
      const { id, folder } = normalizeReorderEntry(entry);
      if (held.has(id)) placed.set(id, { idx, folder });
    });
    const batch = [...placed].map(([tabId, { idx, folder }]) =>
      db(env)
        .prepare(`UPDATE ${links} SET order_index = ?, folder = ? WHERE ${key} = ? AND tab_id = ?`)
        .bind(idx, folder, itemId, tabId),
    );
    const savedAt = db(env)
      .prepare(`UPDATE ${item} SET saved_at = ? WHERE id = ?`)
      .bind(now, itemId);
    if (config.savedAt === 'in-batch') {
      batch.push(savedAt);
      await db(env).batch(batch);
      return;
    }
    if (batch.length > 0) await db(env).batch(batch);
    await savedAt.run();
  }

  return { reorderTabs };
}
