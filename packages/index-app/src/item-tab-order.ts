// An item's tab order and folders inside its Durable Object (item-tab-tables.ts; each product's
// docs/specs/006-*/tab-folders.md). Order, folder and the folder's colour live on the link row, never in the per-tab
// content write, so a content save can't clobber them, and moving a tab leaves its body (and its place in any other
// item) untouched.

import {
  isTabFolderColour,
  type TabFolderColour,
} from '@liveworkspace/api-schema/tab-folder-colour';
import { checkItemTabTables, type ItemTabTables } from './item-tab-tables';

// The link table's folder colour column (tab-folders.md "Folder colour"), its own schema step in each product's
// room: a hue name, or NULL for Automatic. Every row already there reads as Automatic. A plain ALTER, run once by the
// room's version row, so it never goes into the room's first step.
export function tabFolderColourSchema(links: string): string {
  checkItemTabTables({ item: links, links, key: 'tab_id' });
  return `ALTER TABLE ${links} ADD COLUMN folder_color TEXT NULL;`;
}

// The same as a room's schema step: it asks before the ALTER (SQLite has no ADD COLUMN IF NOT EXISTS), so it is safe
// however far a room got, a rerun included.
export function tabFolderColourStep(
  links: string,
): (exec: (query: string) => { toArray(): Record<string, unknown>[] }) => void {
  const alter = tabFolderColourSchema(links);
  return (exec) => {
    const columns = exec(`PRAGMA table_info(${links})`).toArray();
    if (!columns.some((c) => c.name === 'folder_color')) exec(alter);
  };
}

// One position in a reorder request: the tab id plus its folder in this item, and that folder's colour. A folder
// `null` or omitted is loose. A colour `null` is Automatic; omitted keeps what is stored (reorderTabs). A plain
// string is the legacy (pre-folder) payload shape, treated as loose.
export type ReorderEntry =
  string | { id: string; folder?: string | null; folderColor?: TabFolderColour | null };

const isReorderEntry = (e: unknown): e is ReorderEntry => {
  if (typeof e === 'string') return true;
  if (!e || typeof e !== 'object') return false;
  const { id, folder, folderColor } = e as {
    id?: unknown;
    folder?: unknown;
    folderColor?: unknown;
  };
  return (
    typeof id === 'string' &&
    (folder == null || typeof folder === 'string') &&
    (folderColor == null || isTabFolderColour(folderColor))
  );
};

// A request's reorder entries, or null when any is not one (a tab id, or an id with a text or null folder and a hue
// name or null colour): the caller refuses the request before it writes anything.
export function readReorderEntries(raw: unknown[]): ReorderEntry[] | null {
  return raw.every(isReorderEntry) ? raw : null;
}

// One reorder entry in its (id, folder, colour) form: legacy string entries are loose, and empty or whitespace
// folder names collapse to NULL so a blank folder can never persist. `folderColor` stays undefined when the entry
// left it out, so the write can tell "keep it" from "Automatic" (null).
export function normalizeReorderEntry(entry: ReorderEntry): {
  id: string;
  folder: string | null;
  folderColor?: TabFolderColour | null;
} {
  if (typeof entry === 'string') return { id: entry, folder: null };
  const trimmed = entry.folder?.trim();
  const folder = trimmed ? trimmed : null;
  return entry.folderColor === undefined
    ? { id: entry.id, folder }
    : { id: entry.id, folder, folderColor: entry.folderColor };
}

type Stored = { folder: string | null; colour: string | null };
type Placed = { idx: number; folder: string | null; folderColor?: TabFolderColour | null };

// Each placed tab's colour (tab-folders.md "Persistence & realtime"): sent, it is written as sent; left out, the
// stored one is kept, unless the request moves the tab into another folder, where it takes the colour of that
// folder's other members (their colour in the request, else as stored), the first such member in order. A loose tab
// has none. Pure, so the rule is tested without a database.
export function resolveFolderColours(
  placed: ReadonlyMap<string, Placed>,
  stored: ReadonlyMap<string, Stored>,
): Map<string, string | null> {
  const colours = new Map<string, string | null>();
  const adopters: string[] = [];
  for (const [id, p] of placed) {
    if (p.folder === null) colours.set(id, null);
    else if (p.folderColor !== undefined) colours.set(id, p.folderColor);
    else if (stored.get(id)?.folder === p.folder) colours.set(id, stored.get(id)?.colour ?? null);
    else adopters.push(id);
  }
  if (adopters.length === 0) return colours;
  // The colour each folder's settled members hold, by order: the first non-null one.
  const byFolder = new Map<string, string>();
  [...placed]
    .filter(([id]) => colours.has(id))
    .sort((a, b) => a[1].idx - b[1].idx)
    .forEach(([id, p]) => {
      const colour = colours.get(id);
      if (p.folder !== null && colour && !byFolder.has(p.folder)) byFolder.set(p.folder, colour);
    });
  for (const id of adopters) colours.set(id, byFolder.get(placed.get(id)!.folder!) ?? null);
  return colours;
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

  // Update tab order, folder membership and folder colours. The caller passes the entries in their new positions;
  // every order_index (and folder and colour) is rewritten in one batch, cheap at the tab counts an item holds.
  async function reorderTabs(env: Env, itemId: string, entries: ReorderEntry[]): Promise<void> {
    const now = Date.now();
    // Only the item's own tabs, each once at the last place the request names it (what writing every entry in turn
    // left): ids it lacks would update nothing, and a body of a million of them was a statement each. The same read
    // gives each tab's stored folder and colour, for the colours a request leaves out.
    const { results } = await db(env)
      .prepare(`SELECT tab_id, folder, folder_color FROM ${links} WHERE ${key} = ?`)
      .bind(itemId)
      .all<{ tab_id: string; folder: string | null; folder_color: string | null }>();
    const stored = new Map<string, Stored>(
      results.map((r) => [r.tab_id, { folder: r.folder, colour: r.folder_color }]),
    );
    const placed = new Map<string, Placed>();
    entries.forEach((entry, idx) => {
      const { id, folder, folderColor } = normalizeReorderEntry(entry);
      if (stored.has(id)) placed.set(id, { idx, folder, folderColor });
    });
    const colours = resolveFolderColours(placed, stored);
    const batch = [...placed].map(([tabId, { idx, folder }]) =>
      db(env)
        .prepare(
          `UPDATE ${links} SET order_index = ?, folder = ?, folder_color = ? WHERE ${key} = ? AND tab_id = ?`,
        )
        .bind(idx, folder, colours.get(tabId) ?? null, itemId, tabId),
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
