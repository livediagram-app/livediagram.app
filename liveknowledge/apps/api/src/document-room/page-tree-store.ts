// The page tree in the document's storage (docs/specs/030-knowledgebase/blueprints/page-tree.md "Storage" and "The
// room's check"). A page's parent is in its tab's body (`$.parent`); its place among its siblings is the tab list's
// order. Every write that can change the tree meets one of the checks here first: the room's relay of an Editor's
// op, the whole-tab save and the metadata save. Reading stays forgiving (page-tree.ts): only a change is judged, so
// a tab whose stored place already breaks a limit still saves its writing.

import {
  MAX_KNOWLEDGEBASE_PAGES,
  pageCount,
  pageParents,
  pageTreeRefusal,
  parseTabParent,
  type PageTreeRefusal,
  type TreePage,
} from '@liveknowledge/document';
import type { DocumentEnv } from '../types';

/** The stored tree: each tab's id and parent, in the tab list's order. `connection` (true) marks a connected row
 *  (links-and-embeds.md "Connected files in the sidebar"), which is placed like a page but is no page. */
export type StoredPage = { id: string; parent?: string; connection?: true };

// A body that does not parse reads as a top-level page (and is never rewritten): one bad tab never fails the read.
const TREE_SQL = `SELECT t.id AS id,
                         CASE WHEN json_valid(t.data) THEN json_extract(t.data, '$.parent') END AS parent,
                         t.connection IS NOT NULL AS connected
                    FROM document_tabs dt JOIN tabs t ON t.id = dt.tab_id
                   WHERE dt.document_id = ? ORDER BY dt.order_index ASC`;

const storedPage = (row: { id: unknown; parent?: unknown; connected?: unknown }): StoredPage => {
  const parent = parseTabParent(row.parent);
  const page: StoredPage =
    parent === undefined ? { id: String(row.id) } : { id: String(row.id), parent };
  if (row.connected === 1 || row.connected === true) page.connection = true;
  return page;
};

/** The stored tree, read through the document's database. */
export async function readStoredPages(env: DocumentEnv, documentId: string): Promise<StoredPage[]> {
  const { results } = await env.DOCUMENT_DB.prepare(TREE_SQL)
    .bind(documentId)
    .all<{ id: string; parent: unknown; connected: unknown }>();
  return (results ?? []).map(storedPage);
}

/** The stored tree, read synchronously inside the room (its op relay cannot wait). */
export function readStoredPagesSync(
  sql: { exec: (query: string, ...bindings: unknown[]) => { toArray: () => unknown[] } },
  documentId: string,
): StoredPage[] {
  return (sql.exec(TREE_SQL, documentId).toArray() as { id: unknown; parent?: unknown }[]).map(
    storedPage,
  );
}

// A proposed tree judged whole: every page sits where it was asked to (its parent is a page of this knowledgebase,
// not itself, and closes no cycle), and the limits hold.
function proposedRefusal(next: readonly TreePage[]): PageTreeRefusal | null {
  // Only a page holds subpages: a parent that is a connected row is no page of this knowledgebase.
  const ids = new Set(next.filter((p) => p.connection !== true).map((p) => p.id));
  const read = pageParents(next);
  for (const page of next) {
    if (page.parent === undefined) continue;
    if (!ids.has(page.parent)) return 'unknown_page';
    if (read.get(page.id) !== page.parent) return 'own_subtree';
  }
  return pageTreeRefusal(next);
}

/**
 * Whether one tab may be written with this parent (a new tab, or a stored one moved), or why not. Null when the tab
 * is stored and its parent is unchanged: nothing of the tree is being changed, so nothing is judged.
 */
export function tabParentRefusal(
  stored: readonly StoredPage[],
  tabId: string,
  parent: unknown,
  // The write holds a connection: a new tab is a connected row, which never meets the page limit.
  connected = false,
): PageTreeRefusal | null {
  const asked = parent === undefined || parent === null ? undefined : parseTabParent(parent);
  // Anything that is no id (a number, an empty or overlong string) names no page.
  if (parent !== undefined && parent !== null && asked === undefined) return 'unknown_page';
  const held = stored.find((p) => p.id === tabId);
  if (held && held.parent === asked) return null;
  const isRow = connected || held?.connection === true;
  if (!held && !isRow && pageCount(stored) >= MAX_KNOWLEDGEBASE_PAGES) return 'page_limit';
  const placed: StoredPage = asked === undefined ? { id: tabId } : { id: tabId, parent: asked };
  if (isRow) placed.connection = true;
  const next = held ? stored.map((p) => (p.id === tabId ? placed : p)) : [...stored, placed];
  return proposedRefusal(next);
}

/** A request's tab list as the entries that may place a page: every object with a text id. */
export function placedEntries(raw: unknown): PlacedEntry[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter(
    (entry): entry is PlacedEntry =>
      !!entry && typeof entry === 'object' && typeof (entry as PlacedEntry).id === 'string',
  );
}

/** One entry of a tab list that may place its page: `parent` a string, null (the top level) or absent (as stored). */
export type PlacedEntry = { id: string; parent?: unknown };

/**
 * The tree a tab list asks for, over the stored one: the list's order, each page under the parent its entry names
 * (as stored when the entry names none), then the stored pages it does not name. `changed` is false when no entry moves a page under another parent.
 */
export function treeFromEntries(
  stored: readonly StoredPage[],
  entries: readonly PlacedEntry[],
): { next: StoredPage[]; changed: boolean; invalid: boolean } {
  const held = new Map(stored.map((p) => [p.id, p]));
  let changed = false;
  let invalid = false;
  const next = entries.map((entry): StoredPage => {
    const was = held.get(entry.id);
    if (!Object.hasOwn(entry, 'parent')) return was ?? { id: entry.id };
    const parent = entry.parent === null ? undefined : parseTabParent(entry.parent);
    if (entry.parent !== null && parent === undefined) invalid = true;
    if ((was?.parent ?? undefined) !== parent) changed = true;
    const placed: StoredPage = parent === undefined ? { id: entry.id } : { id: entry.id, parent };
    // A connected row stays one, wherever the list places it.
    if (was?.connection) placed.connection = true;
    return placed;
  });
  // A page the list does not name keeps its place after the ones it does, where a reorder leaves it.
  const named = new Set(entries.map((entry) => entry.id));
  for (const page of stored) if (!named.has(page.id)) next.push(page);
  return { next, changed, invalid };
}

/** Whether a tab list may be taken (a metadata save, a `document-meta` op), or why not. Null when it moves no page
 *  under another parent: an order alone is always taken. */
export function tabListRefusal(
  stored: readonly StoredPage[],
  entries: readonly PlacedEntry[],
): PageTreeRefusal | null {
  // Only the tabs the document stores: an entry for any other places nothing (the save writes none for it either).
  const known = new Set(stored.map((p) => p.id));
  const { next, changed, invalid } = treeFromEntries(
    stored,
    entries.filter((entry) => known.has(entry.id)),
  );
  if (invalid) return 'unknown_page';
  return changed ? proposedRefusal(next) : null;
}

/**
 * What an Editor's room op would do to the tree, or null when it may be relayed: a whole `tab`, a `tab-meta` patch
 * that sets or clears `parent`, or a `document-meta` list. Any other op is not the tree's.
 */
export function treeOpRefusal(stored: readonly StoredPage[], op: unknown): PageTreeRefusal | null {
  const o = (op ?? {}) as Record<string, unknown>;
  if (o.kind === 'tab') {
    const tab = (o.tab ?? {}) as Record<string, unknown>;
    const id = typeof o.tabId === 'string' ? o.tabId : tab.id;
    const connected = typeof tab.connection === 'object' && tab.connection !== null;
    return typeof id === 'string' ? tabParentRefusal(stored, id, tab.parent, connected) : null;
  }
  if (o.kind === 'tab-meta') {
    if (typeof o.tabId !== 'string') return null;
    const patch = (o.patch ?? {}) as Record<string, unknown>;
    const cleared = Array.isArray(o.clear) && o.clear.includes('parent');
    if (!Object.hasOwn(patch, 'parent') && !cleared) return null;
    // A patch for a tab the room has not stored yet is its first save's to judge.
    if (!stored.some((p) => p.id === o.tabId)) return null;
    return tabParentRefusal(stored, o.tabId, Object.hasOwn(patch, 'parent') ? patch.parent : null);
  }
  if (o.kind === 'document-meta' && Array.isArray(o.tabs)) {
    return tabListRefusal(stored, placedEntries(o.tabs));
  }
  return null;
}

/**
 * The metadata save's parents (the tab list's entries that carry `parent`), written into each tab's body where it
 * differs. One statement a moved page; none when nothing moved. The caller has checked `tabListRefusal`.
 */
export async function writeTabParents(
  env: DocumentEnv,
  stored: readonly StoredPage[],
  entries: readonly PlacedEntry[],
): Promise<number> {
  const held = new Map(stored.map((p) => [p.id, p]));
  const db = env.DOCUMENT_DB;
  // A write of a tab's body advances its revision (the `tabs_rev_advances` trigger), as a rename does.
  const now = Date.now();
  const writes = [];
  for (const entry of entries) {
    const was = held.get(entry.id);
    if (!was || !Object.hasOwn(entry, 'parent')) continue;
    const parent = entry.parent === null ? undefined : parseTabParent(entry.parent);
    if (was.parent === parent) continue;
    writes.push(
      parent === undefined
        ? db
            .prepare(
              `UPDATE tabs SET data = json_remove(data, '$.parent'), rev = rev + 1, updated_at = ?
                WHERE id = ? AND json_valid(data)`,
            )
            .bind(now, entry.id)
        : db
            .prepare(
              `UPDATE tabs SET data = json_set(data, '$.parent', ?), rev = rev + 1, updated_at = ?
                WHERE id = ? AND json_valid(data)`,
            )
            .bind(parent, now, entry.id),
    );
  }
  if (writes.length > 0) await db.batch(writes);
  return writes.length;
}
