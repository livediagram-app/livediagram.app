// A knowledgebase's page Trash in its Durable Object's SQLite (docs/specs/030-knowledgebase/knowledgebases-and-pages.md
// "The page Trash"; blueprint page-tree.md "The page Trash"). A page leaves the tree by losing its link row
// (`document_tabs`) and keeps its `tabs` row, so every table keyed on the tab (threads, approval, editors, authors,
// answers, versions, image references, changesets) keeps its rows, and every read that places a tab in the
// knowledgebase (they all join `document_tabs`) stops seeing it. `page_trash` remembers where it stood and who put it
// there. Linking the tab again (a restore, an Undo's save, a snapshot's seed) takes it out of the Trash by a trigger.
//
// Purged as the Trash is read or written: past PAGE_TRASH_DAYS, and past the newest MAX_TRASHED_PAGES. Removing a
// trashed page for good is `DELETE FROM tabs`, which takes the rest by the foreign keys, as a delete always has.
import {
  MAX_KNOWLEDGEBASE_PAGES,
  MAX_PAGE_DEPTH,
  pageCount,
  pageDepth,
  parseTabParent,
} from '@liveknowledge/document';
import {
  MAX_TRASHED_PAGES,
  PAGE_TRASH_DAYS,
  type PageRestoreResponse,
  type TrashedPage,
} from '@liveknowledge/api-schema';
import type { DeletedTab } from '../db/tabs';
import type { DocumentEnv } from '../types';
import { readStoredPages } from './page-tree-store';

type Exec = (query: string) => unknown;

const DAY_MS = 24 * 60 * 60 * 1000;

// The page's index is marked behind its tab when its link comes or goes (knowledge-schema.ts `knowledge_dirty`): the
// settle reads only a linked tab (knowledge-index.ts settlePage), so an unlink settles as the page gone from search,
// Ask, links and trust in the same transaction, and a relink indexes it again.
const markLinked = (row: 'NEW' | 'OLD') =>
  `INSERT INTO knowledge_dirty (tab)
     SELECT ${row}.tab_id WHERE NOT EXISTS (SELECT 1 FROM knowledge_dirty WHERE tab = ${row}.tab_id)`;

/** The schema step (document-schema.ts STEPS, step 37). Additive, IF NOT EXISTS. */
export function pageTrashSchemaStep(exec: Exec): void {
  exec(`CREATE TABLE IF NOT EXISTS page_trash (
    tab_id          TEXT    PRIMARY KEY REFERENCES tabs (id) ON DELETE CASCADE,
    document_id     TEXT    NOT NULL,
    parent          TEXT    NULL,
    order_index     INTEGER NOT NULL,
    trashed_at      INTEGER NOT NULL,
    trashed_by      TEXT    NOT NULL DEFAULT '',
    trashed_by_name TEXT    NOT NULL DEFAULT ''
  )`);
  exec('CREATE INDEX IF NOT EXISTS page_trash_at ON page_trash (document_id, trashed_at)');
  exec(`CREATE TRIGGER IF NOT EXISTS page_trash_relinked AFTER INSERT ON document_tabs
    BEGIN DELETE FROM page_trash WHERE tab_id = NEW.tab_id; END`);
  exec(`CREATE TRIGGER IF NOT EXISTS knowledge_tab_linked AFTER INSERT ON document_tabs
    BEGIN ${markLinked('NEW')}; END`);
  exec(`CREATE TRIGGER IF NOT EXISTS knowledge_tab_unlinked AFTER DELETE ON document_tabs
    BEGIN ${markLinked('OLD')}; END`);
}

/** Who put a page in the Trash: their participant id and their name then. */
export type Trasher = { id: string; name: string };

const NOT_LINKED = 'NOT EXISTS (SELECT 1 FROM document_tabs l WHERE l.tab_id = tabs.id)';

/** The purge, as statements a write's batch runs after it: every page past its 30 days, and every one past the
 *  newest 500. Never a page linked again. */
export function purgeStatements(
  env: DocumentEnv,
  documentId: string,
  now: number,
): D1PreparedStatement[] {
  const db = env.DOCUMENT_DB;
  return [
    db
      .prepare(
        `DELETE FROM tabs WHERE id IN (SELECT tab_id FROM page_trash WHERE document_id = ?1 AND trashed_at < ?2)
           AND ${NOT_LINKED}`,
      )
      .bind(documentId, now - PAGE_TRASH_DAYS * DAY_MS),
    db
      .prepare(
        `DELETE FROM tabs WHERE id IN (SELECT tab_id FROM page_trash WHERE document_id = ?1
                                        ORDER BY trashed_at DESC, order_index ASC LIMIT -1 OFFSET ?2)
           AND ${NOT_LINKED}`,
      )
      .bind(documentId, MAX_TRASHED_PAGES),
  ];
}

/** Whether a tab goes to the Trash when it is deleted: a page is; a connected file's row (no page) and a tab shared
 *  with another item (whose other holders must hear it left) are deleted as before. Null when the tab is not here. */
export async function goesToTrash(env: DocumentEnv, tabId: string): Promise<boolean | null> {
  const row = await env.DOCUMENT_DB.prepare(
    `SELECT t.connection IS NOT NULL AND t.connection != '' AS connected,
            EXISTS (SELECT 1 FROM tab_shares s WHERE s.tab_id = t.id) AS shared
       FROM tabs t WHERE t.id = ?`,
  )
    .bind(tabId)
    .first<{ connected: number; shared: number }>();
  if (!row) return null;
  return !row.connected && !row.shared;
}

/**
 * Put one page in the Trash: its link goes, its body and everything keyed on it stay. `keepLast` (a token's delete)
 * refuses the knowledgebase's last tab, counted inside the write as `deleteTabRow` counts it. Answers the body as a
 * delete does, null when the page is not in this knowledgebase, `last` when it was refused as the last.
 */
export async function trashPage(
  env: DocumentEnv,
  documentId: string,
  tabId: string,
  by: Trasher,
  opts: { keepLast?: boolean; now?: number } = {},
): Promise<DeletedTab | null | 'last'> {
  const db = env.DOCUMENT_DB;
  const now = opts.now ?? Date.now();
  const keep = opts.keepLast ? 1 : 0;
  const results = await db.batch([
    db
      .prepare(
        `INSERT INTO page_trash (tab_id, document_id, parent, order_index, trashed_at, trashed_by, trashed_by_name)
           SELECT dt.tab_id, dt.document_id,
                  CASE WHEN json_valid(t.data) AND json_type(t.data, '$.parent') = 'text'
                       THEN json_extract(t.data, '$.parent') END,
                  dt.order_index, ?3, ?4, ?5
             FROM document_tabs dt JOIN tabs t ON t.id = dt.tab_id
            WHERE dt.document_id = ?1 AND dt.tab_id = ?2
              AND (?6 = 0 OR (SELECT COUNT(*) FROM document_tabs c WHERE c.document_id = ?1) > 1)
         ON CONFLICT (tab_id) DO UPDATE SET document_id = excluded.document_id, parent = excluded.parent,
           order_index = excluded.order_index, trashed_at = excluded.trashed_at,
           trashed_by = excluded.trashed_by, trashed_by_name = excluded.trashed_by_name`,
      )
      .bind(documentId, tabId, now, by.id, by.name, keep),
    db
      .prepare(
        `DELETE FROM document_tabs WHERE document_id = ?1 AND tab_id = ?2
           AND EXISTS (SELECT 1 FROM page_trash p WHERE p.tab_id = ?2 AND p.trashed_at = ?3)
         RETURNING (SELECT t.data FROM tabs t WHERE t.id = document_tabs.tab_id) AS data`,
      )
      .bind(documentId, tabId, now),
    db.prepare('UPDATE document SET saved_at = ? WHERE id = ?').bind(now, documentId),
    ...purgeStatements(env, documentId, now),
  ]);
  const row = (results[1] as { results?: { data?: string | null }[] } | undefined)?.results?.[0];
  if (row) return row.data == null ? null : { data: row.data };
  if (!keep) return null;
  const held = await db
    .prepare('SELECT 1 AS held FROM document_tabs WHERE document_id = ? AND tab_id = ?')
    .bind(documentId, tabId)
    .first('held');
  return held ? 'last' : null;
}

type TrashRow = {
  tab_id: string;
  parent: string | null;
  order_index: number;
  trashed_at: number;
  trashed_by_name: string;
  name: string;
  connected: number;
};

async function trashRows(env: DocumentEnv, documentId: string): Promise<TrashRow[]> {
  const { results } = await env.DOCUMENT_DB.prepare(
    `SELECT p.tab_id, p.parent, p.order_index, p.trashed_at, p.trashed_by_name, t.name,
            t.connection IS NOT NULL AND t.connection != '' AS connected
       FROM page_trash p JOIN tabs t ON t.id = p.tab_id
      WHERE p.document_id = ? AND NOT EXISTS (SELECT 1 FROM document_tabs l WHERE l.tab_id = p.tab_id)
      ORDER BY p.trashed_at DESC, p.order_index ASC LIMIT ?`,
  )
    .bind(documentId, MAX_TRASHED_PAGES)
    .all<TrashRow>();
  return results ?? [];
}

// Each trashed row's trashed children, in their old order; a connected row is never one (it is no page).
function childrenOf(rows: readonly TrashRow[]): Map<string, TrashRow[]> {
  const ids = new Set(rows.map((r) => r.tab_id));
  const children = new Map<string, TrashRow[]>();
  for (const row of rows) {
    const parent = parseTabParent(row.parent);
    if (parent === undefined || parent === row.tab_id || !ids.has(parent)) continue;
    const list = children.get(parent);
    if (list) list.push(row);
    else children.set(parent, [row]);
  }
  for (const list of children.values()) list.sort((a, b) => a.order_index - b.order_index);
  return children;
}

// A root and every trashed page under it, the root first, in tree order. A cycle is cut where it closes.
function subtreeOf(root: TrashRow, children: ReadonlyMap<string, TrashRow[]>): TrashRow[] {
  const out: TrashRow[] = [];
  const seen = new Set<string>();
  const walk = (row: TrashRow) => {
    if (seen.has(row.tab_id)) return;
    seen.add(row.tab_id);
    out.push(row);
    for (const child of children.get(row.tab_id) ?? []) walk(child);
  };
  walk(root);
  return out;
}

// The rows a person sees as one each: a trashed page whose parent is not itself in the Trash. A page whose parent is
// trashed rides that parent's row.
function rootsOf(rows: readonly TrashRow[], children: ReadonlyMap<string, TrashRow[]>): TrashRow[] {
  const under = new Set<string>();
  for (const list of children.values()) for (const row of list) under.add(row.tab_id);
  const roots = rows.filter((r) => !under.has(r.tab_id) && !r.connected);
  // A cycle of trashed pages has no root: its first row stands for it.
  const reached = new Set<string>();
  for (const root of roots) for (const row of subtreeOf(root, children)) reached.add(row.tab_id);
  for (const row of rows) {
    if (reached.has(row.tab_id) || row.connected) continue;
    roots.push(row);
    for (const r of subtreeOf(row, children)) reached.add(r.tab_id);
  }
  return roots;
}

/** The Trash as a person sees it, newest first; purged first, so nothing past its days is listed. */
export async function listTrash(
  env: DocumentEnv,
  documentId: string,
  now = Date.now(),
): Promise<TrashedPage[]> {
  await env.DOCUMENT_DB.batch(purgeStatements(env, documentId, now));
  const rows = await trashRows(env, documentId);
  const children = childrenOf(rows);
  return rootsOf(rows, children).map((root) => ({
    id: root.tab_id,
    name: root.name,
    trashedAt: root.trashed_at,
    trashedBy: root.trashed_by_name || null,
    subpages: subtreeOf(root, children)
      .slice(1)
      .filter((r) => !r.connected)
      .map((r) => ({ id: r.tab_id, name: r.name })),
  }));
}

export type RestoreOutcome = PageRestoreResponse | 'not_in_trash' | 'page_limit';

/**
 * Put a trashed page and every trashed page under it back where it stood: under its old parent, at its old place.
 * When that parent is gone (or the place would pass MAX_PAGE_DEPTH) the page comes back at the top level.
 */
export async function restorePages(
  env: DocumentEnv,
  documentId: string,
  tabId: string,
  now = Date.now(),
): Promise<RestoreOutcome> {
  const rows = await trashRows(env, documentId);
  const root = rows.find((r) => r.tab_id === tabId);
  if (!root) return 'not_in_trash';
  const children = childrenOf(rows);
  const pages = subtreeOf(root, children);
  const linked = await readStoredPages(env, documentId);
  const restoring = pages.filter((r) => !r.connected).length;
  if (pageCount(linked) + restoring > MAX_KNOWLEDGEBASE_PAGES) return 'page_limit';
  // How deep the restored pages run under their root (the root is 1).
  const depthBelow = new Map<string, number>([[root.tab_id, 1]]);
  let deepest = 1;
  for (const row of pages.slice(1)) {
    const parent = parseTabParent(row.parent);
    const depth = (parent ? (depthBelow.get(parent) ?? 1) : 1) + 1;
    depthBelow.set(row.tab_id, depth);
    deepest = Math.max(deepest, depth);
  }
  const parent = parseTabParent(root.parent);
  const parentHere = parent
    ? linked.find((p) => p.id === parent && p.connection !== true)
    : undefined;
  const topLevel =
    parent !== undefined &&
    (!parentHere || pageDepth(linked, parentHere.id) + deepest > MAX_PAGE_DEPTH);
  const db = env.DOCUMENT_DB;
  const at = root.order_index;
  const statements: D1PreparedStatement[] = [];
  if (topLevel)
    statements.push(
      db
        .prepare(
          `UPDATE tabs SET data = json_remove(data, '$.parent'), rev = rev + 1, updated_at = ?
            WHERE id = ? AND json_valid(data)`,
        )
        .bind(now, root.tab_id),
    );
  statements.push(
    db
      .prepare(
        'UPDATE document_tabs SET order_index = order_index + ? WHERE document_id = ? AND order_index >= ?',
      )
      .bind(pages.length, documentId, at),
    ...pages.map((row, i) =>
      db
        .prepare(
          'INSERT OR IGNORE INTO document_tabs (document_id, tab_id, order_index, added_at) VALUES (?, ?, ?, ?)',
        )
        .bind(documentId, row.tab_id, at + i, now),
    ),
    db.prepare('UPDATE document SET saved_at = ? WHERE id = ?').bind(now, documentId),
  );
  await db.batch(statements);
  return { restored: pages.filter((r) => !r.connected).map((r) => r.tab_id), topLevel };
}

/** Remove a trashed page and the trashed pages under it for good. False when it is not in the Trash. */
export async function deleteForever(
  env: DocumentEnv,
  documentId: string,
  tabId: string,
): Promise<boolean> {
  const rows = await trashRows(env, documentId);
  const root = rows.find((r) => r.tab_id === tabId);
  if (!root) return false;
  const ids = subtreeOf(root, childrenOf(rows)).map((r) => r.tab_id);
  await env.DOCUMENT_DB.prepare(
    `DELETE FROM tabs WHERE id IN (SELECT value FROM json_each(?)) AND ${NOT_LINKED}`,
  )
    .bind(JSON.stringify(ids))
    .run();
  return true;
}

/** Remove every page in the Trash for good. */
export async function emptyTrash(env: DocumentEnv, documentId: string): Promise<void> {
  await env.DOCUMENT_DB.prepare(
    `DELETE FROM tabs WHERE id IN (SELECT tab_id FROM page_trash WHERE document_id = ?) AND ${NOT_LINKED}`,
  )
    .bind(documentId)
    .run();
}

/**
 * The pages an Undo brings back by the tab list alone: a metadata save that lists a page this caller put in the
 * Trash links it again (a page never opened has no body in the editor to save), where the list puts it. A page
 * someone else trashed is left there: a peer's list that had not heard of the delete yet never undoes it.
 */
export async function relinkListedPages(
  env: DocumentEnv,
  documentId: string,
  listed: readonly string[],
  caller: string,
  now = Date.now(),
): Promise<string[]> {
  if (listed.length === 0 || !caller) return [];
  const db = env.DOCUMENT_DB;
  const { results } = await db
    .prepare(
      `SELECT tab_id FROM page_trash WHERE document_id = ? AND trashed_by = ?
          AND tab_id IN (SELECT value FROM json_each(?))`,
    )
    .bind(documentId, caller, JSON.stringify(listed))
    .all<{ tab_id: string }>();
  const ids = (results ?? []).map((r) => r.tab_id);
  if (ids.length === 0) return [];
  await db.batch(
    ids.map((id) =>
      db
        .prepare(
          'INSERT OR IGNORE INTO document_tabs (document_id, tab_id, order_index, added_at) VALUES (?, ?, ?, ?)',
        )
        .bind(documentId, id, listed.indexOf(id), now),
    ),
  );
  return ids;
}

/**
 * A whole-tab save of a page in the Trash (an Undo's, or a peer's who was still writing in it when it was deleted):
 * the page is linked again at its old place first, so the save lands on the stored page (its revision, its threads)
 * rather than racing it, and no writing is lost, as a save always brought a deleted page back. Answers whether it
 * linked one.
 */
export async function relinkTrashedTab(
  env: DocumentEnv,
  documentId: string,
  tabId: string,
  now = Date.now(),
): Promise<boolean> {
  const row = await env.DOCUMENT_DB.prepare(
    `INSERT OR IGNORE INTO document_tabs (document_id, tab_id, order_index, added_at)
       SELECT document_id, tab_id, order_index, ? FROM page_trash WHERE document_id = ? AND tab_id = ?
     RETURNING tab_id`,
  )
    .bind(now, documentId, tabId)
    .first<{ tab_id: string }>();
  return row !== null;
}
