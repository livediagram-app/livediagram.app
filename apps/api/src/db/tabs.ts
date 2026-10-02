// tabs — one row per tab, linked to documents through the
// document_tabs many-to-many table (migration 0011 / docs/specs/006-document/tab-document-many-to-many.md).

import { capElementActions, type Tab } from '@livediagram/document';
import { rowToTab, type TabRow } from '../tab-row';
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
import type { SharedTabsSummary } from '@livediagram/api-schema';
import type { Env, TabDTO } from '../types';
import { imageRefIds, imageRefIdsFromData } from '../image-refs/extract';
import { collabIndexStatements } from './collab-index';
import {
  imageRefAddStatements,
  imageRefPruneTabStatement,
  imageRefReplaceStatements,
} from './image-refs';

export async function getTab(env: Env, documentId: string, tabId: string): Promise<TabDTO | null> {
  // Resolve via the document_tabs link table (docs/specs/006-document/tab-document-many-to-many.md) so a
  // linked tab surfaces from every document that contains it. The link
  // also carries the per-document order_index, so the returned summary's
  // position is correct for whichever document the caller asked about.
  const row = await env.DB.prepare(
    `SELECT t.id, dt.document_id, t.name, dt.order_index, t.data, t.updated_at, dt.folder
       FROM tabs t
       JOIN document_tabs dt ON dt.tab_id = t.id
      WHERE t.id = ? AND dt.document_id = ?`,
  )
    .bind(tabId, documentId)
    .first<TabRow>();
  return row ? rowToTab(row) : null;
}

// The raw `tabs.data` JSON for a document's first tab (lowest
// order_index in the document_tabs link), or null when the document has
// no tabs. Used by the SVG snapshot render-cache (docs/specs/006-document/document-snapshots.md), which needs
// only the element body — never the full TabDTO hydration — so this
// reads the single `data` column rather than going through getTab.
// The `empty` column of a document list (docs/specs/006-document/document-snapshots.md): the element
// count of the document's first tab, or of `scopeTabSql`'s tab when that is not null. Reads the
// count each tab write binds (migration 0059), never a tab body. NULL = no tab, -1 = not yet known.
export function firstTabCountSql(documentIdSql: string, scopeTabSql: string | null = null): string {
  const scope = scopeTabSql ? ` AND (${scopeTabSql} IS NULL OR dt.tab_id = ${scopeTabSql})` : '';
  return `(SELECT COALESCE(t.element_count, -1)
             FROM document_tabs dt
             JOIN tabs t ON t.id = dt.tab_id
            WHERE dt.document_id = ${documentIdSql}${scope}
            ORDER BY dt.order_index ASC
            LIMIT 1) AS first_tab_count`;
}

// No tab, or a counted tab with no elements. A count not yet known is not empty: its thumbnail is asked for.
export function isEmptyCount(firstTabCount: number | null | undefined): boolean {
  return firstTabCount == null || firstTabCount === 0;
}

// A stored tab body with its id and its element count (null until known, migration 0059).
export type StoredTabBody = { id: string; data: string; elementCount: number | null };

// The document's first tab, or `tabId`'s tab when given, as the snapshot renderer reads it.
export async function getTabBody(
  env: Env,
  documentId: string,
  tabId: string | null = null,
): Promise<StoredTabBody | null> {
  const row = await env.DB.prepare(
    `SELECT t.id, t.data, t.element_count
       FROM document_tabs dt
       JOIN tabs t ON t.id = dt.tab_id
      WHERE dt.document_id = ?${tabId === null ? '' : ' AND dt.tab_id = ?'}
      ORDER BY dt.order_index ASC
      LIMIT 1`,
  )
    .bind(...(tabId === null ? [documentId] : [documentId, tabId]))
    .first<{ id: string; data: string; element_count: number | null }>();
  return row ? { id: row.id, data: row.data, elementCount: row.element_count ?? null } : null;
}

// The lazy backfill (migration 0059): a reader that has parsed a body whose count is still unknown
// records it. Only ever fills a null, so it can never undo a write's own count.
export async function stampTabElementCount(env: Env, tabId: string, count: number): Promise<void> {
  await env.DB.prepare('UPDATE tabs SET element_count = ? WHERE id = ? AND element_count IS NULL')
    .bind(count, tabId)
    .run();
}

// The raw `tabs.data` JSON for a SPECIFIC tab in a document, or null when
// that tab isn't part of the document. Resolved through the document_tabs
// link (like getTab) so a tab id only renders for a document that
// actually contains it — a share code for document A can never coax out
// a tab that lives only in document B. Backs the per-tab live image
// (docs/specs/013-workspace/live-image-share.md); mirrors getFirstTabData but keyed by tab id instead of the
// lowest order_index.
export async function getTabData(
  env: Env,
  documentId: string,
  tabId: string,
): Promise<string | null> {
  const row = await env.DB.prepare(
    `SELECT t.data
       FROM document_tabs dt
       JOIN tabs t ON t.id = dt.tab_id
      WHERE dt.document_id = ? AND dt.tab_id = ?
      LIMIT 1`,
  )
    .bind(documentId, tabId)
    .first<{ data: string }>();
  return row?.data ?? null;
}

// Full upsert for a single tab. Splits the live-app's Tab type into
// columns + a `data` JSON blob (everything except id + name) so list
// queries can return summaries without parsing element trees.
export async function upsertTab(
  env: Env,
  documentId: string,
  input: Tab,
  orderIndex: number,
): Promise<void> {
  // Action panel lists are bounded here, the one place every tab write
  // meets (docs/specs/012-collaboration/action-panel.md "The data").
  const tab = { ...input, elements: capElementActions(input.elements) };
  const { id, name, ...rest } = tab;
  const data = JSON.stringify(rest);
  assertTabDataFits(id, data, 'upsertTab');
  const now = Date.now();
  // The body goes to `tabs`, this document's position to its `document_tabs`
  // link (docs/specs/006-document/tab-document-many-to-many.md). The two writes
  // are independent — even if the link upsert no-ops (existing entry)
  // the tab body still gets updated.
  // One DB.batch instead of three sequential round trips: this runs
  // once per 600ms per active editor (the autosave), so the two extra
  // serial D1 hops were the single largest latency item on the path.
  await env.DB.batch([
    env.DB.prepare(
      `INSERT INTO tabs (id, name, data, updated_at, element_count)
       VALUES (?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET
         name = excluded.name,
         data = excluded.data,
         updated_at = excluded.updated_at,
         element_count = excluded.element_count`,
    ).bind(id, name, data, now, tab.elements.length),
    env.DB.prepare(
      `INSERT INTO document_tabs (document_id, tab_id, order_index, added_at)
       VALUES (?, ?, ?, ?)
       ON CONFLICT (document_id, tab_id) DO UPDATE SET order_index = excluded.order_index`,
    ).bind(documentId, id, orderIndex, now),
    // Bump the document's saved_at so the Explorer's "Updated X ago"
    // line stays accurate. Pure metadata write — no element JSON.
    env.DB.prepare('UPDATE documents SET saved_at = ? WHERE id = ?').bind(now, documentId),
    // The collaboration index (docs/specs/013-workspace/activity-page.md §2.1): the tab's action + thread
    // rows, replaced in the SAME batch as the blob they mirror so the two
    // can never drift. After the tabs upsert, which the rows' FK needs.
    ...collabIndexStatements(env, id, tab.elements),
    // The image reference index (docs/specs/009-elements/images.md, "Reference index"), for the same
    // reason: a reference this batch missed is an image the retention sweep reaps.
    ...imageRefReplaceStatements(env, id, imageRefIds(tab.elements)),
  ]);
}

// Bulk-seed a fresh document's tabs in one batch (create path). The
// per-tab upsertTab does three sequential writes each (tab body,
// link row, and a redundant saved_at bump), so seeding K tabs that
// way costs ~3K serial round trips. Here we collect every insert and
// submit one batch, then bump saved_at exactly once. Same ON CONFLICT
// semantics as upsertTab so a retried create stays idempotent.
// `savedAt`: the document's last-modified date after seeding, its own when a create carried one
// (docs/specs/015-api/api.md "Document dates"); absent, now.
export async function seedTabs(
  env: Env,
  documentId: string,
  tabs: Tab[],
  savedAt?: number,
): Promise<void> {
  if (tabs.length === 0) return;
  const now = Date.now();
  const capped = tabs.map((t) => ({ ...t, elements: capElementActions(t.elements) }));
  // Every tab measured before any is written: a create seeds all or none.
  for (const { id, name: _name, ...rest } of capped) {
    assertTabDataFits(id, JSON.stringify(rest), 'seedTabs');
  }
  const stmts = capped.flatMap((tab, idx) => {
    const { id, name, ...rest } = tab;
    const data = JSON.stringify(rest);
    return [
      env.DB.prepare(
        `INSERT INTO tabs (id, name, data, updated_at, element_count)
         VALUES (?, ?, ?, ?, ?)
         ON CONFLICT(id) DO UPDATE SET
           name = excluded.name,
           data = excluded.data,
           updated_at = excluded.updated_at,
           element_count = excluded.element_count`,
      ).bind(id, name, data, now, tab.elements.length),
      env.DB.prepare(
        `INSERT INTO document_tabs (document_id, tab_id, order_index, added_at)
         VALUES (?, ?, ?, ?)
         ON CONFLICT (document_id, tab_id) DO UPDATE SET order_index = excluded.order_index`,
      ).bind(documentId, id, idx, now),
    ];
  });
  stmts.push(
    env.DB.prepare('UPDATE documents SET saved_at = ? WHERE id = ?').bind(
      savedAt ?? now,
      documentId,
    ),
  );
  // Index rows for every seeded tab (docs/specs/013-workspace/activity-page.md §2.1): a JSON import or a
  // copy from a share link can carry actions and threads in on create.
  for (const tab of capped) {
    stmts.push(...collabIndexStatements(env, tab.id, tab.elements));
    stmts.push(...imageRefReplaceStatements(env, tab.id, imageRefIds(tab.elements)));
  }
  await env.DB.batch(stmts);
}

// Which of `tabIds` already name a tab that is NOT in `documentId`: a create
// seeding one of those would write into a tab another document holds, so the
// create re-mints it (docs/specs/006-document/offline-mode.md, "Shared tabs fork").
// A tab already in this document is a retried create and keeps its id.
export async function tabIdsHeldElsewhere(
  env: Env,
  documentId: string,
  tabIds: string[],
): Promise<Set<string>> {
  if (tabIds.length === 0) return new Set();
  const rows = await env.DB.prepare(
    `SELECT id FROM tabs
      WHERE id IN (SELECT value FROM json_each(?))
        AND NOT EXISTS (SELECT 1 FROM document_tabs dt WHERE dt.document_id = ? AND dt.tab_id = tabs.id)`,
  )
    .bind(JSON.stringify(tabIds), documentId)
    .all<{ id: string }>();
  return new Set((rows.results ?? []).map((r) => r.id));
}

// Remove the tab from this document (drops the `document_tabs` link
// row). The underlying `tabs` row only goes away when no other
// document still references it: linked tabs (per docs/specs/006-document/tab-document-many-to-many.md) survive
// an unlink from one of their containing documents so the body
// stays readable from the rest. Legacy single-link tabs end up
// fully deleted, matching the prior contract.
//
// change_log entries follow the tabs row: they live on the tab id
// (per #14 in docs/specs/006-document/tab-document-many-to-many.md), so they get dropped only when the tab
// itself goes away. Cascading the log on every unlink would wipe
// the audit panel for every other document that still surfaces the
// shared tab.
export async function deleteTabRow(env: Env, documentId: string, tabId: string): Promise<void> {
  await env.DB.prepare('DELETE FROM document_tabs WHERE document_id = ? AND tab_id = ?')
    .bind(documentId, tabId)
    .run();
  const remaining = await env.DB.prepare('SELECT COUNT(*) AS n FROM document_tabs WHERE tab_id = ?')
    .bind(tabId)
    .first<{ n: number }>();
  if ((remaining?.n ?? 0) === 0) {
    // image_refs has no FK to cascade from `tabs`, so its rows go explicitly.
    await env.DB.batch([
      imageRefPruneTabStatement(env, tabId),
      env.DB.prepare('DELETE FROM tabs WHERE id = ?').bind(tabId),
      env.DB.prepare('DELETE FROM change_log WHERE tab_id = ?').bind(tabId),
    ]);
  }
}

// Link an existing tab into another document (docs/specs/006-document/tab-document-many-to-many.md). Inserts a
// `document_tabs` row at the end of the target document's order,
// idempotent on conflict so re-linking the same pair returns 200
// without double-counting. The `tabs` row itself is untouched: the
// tab body lives in one place and edits propagate to every document
// that references it. Returns true when a fresh link was created,
// false when the link already existed (idempotent path).
export async function linkTabToDocument(
  env: Env,
  documentId: string,
  tabId: string,
): Promise<boolean> {
  const existing = await env.DB.prepare(
    'SELECT 1 AS present FROM document_tabs WHERE document_id = ? AND tab_id = ?',
  )
    .bind(documentId, tabId)
    .first<{ present: number }>();
  if (existing) return false;
  const count = await env.DB.prepare(
    'SELECT COUNT(*) AS n FROM document_tabs WHERE document_id = ?',
  )
    .bind(documentId)
    .first<{ n: number }>();
  const orderIndex = count?.n ?? 0;
  const now = Date.now();
  await env.DB.prepare(
    `INSERT INTO document_tabs (document_id, tab_id, order_index, added_at)
     VALUES (?, ?, ?, ?)
     ON CONFLICT (document_id, tab_id) DO NOTHING`,
  )
    .bind(documentId, tabId, orderIndex, now)
    .run();
  await env.DB.prepare('UPDATE documents SET saved_at = ? WHERE id = ?')
    .bind(now, documentId)
    .run();
  return true;
}

// The link endpoint's authorisation check in one query: is this tab
// linked into at least one document owned by `ownerId`? Replaces the
// old "list every containing document id, then getDocument() each in a
// loop" pattern (N full document hydrations to read one column). The
// JOIN + LIMIT 1 stops at the first owned match.
export async function tabLinkedToOwnedDocument(
  env: Env,
  tabId: string,
  ownerId: string,
): Promise<boolean> {
  const row = await env.DB.prepare(
    `SELECT 1 AS present
       FROM document_tabs dt
       JOIN documents d ON d.id = dt.document_id
      WHERE dt.tab_id = ? AND d.owner_id = ? AND d.trashed_at IS NULL
      LIMIT 1`,
  )
    .bind(tabId, ownerId)
    .first<{ present: number }>();
  return row !== null;
}

// How many of this document's tabs are shared (also linked into another
// document), and across how many other documents: what deleting or taking the
// document offline leaves behind (docs/specs/006-document/tab-document-many-to-many.md,
// "Shared-tab notice").
export async function sharedTabsSummary(env: Env, documentId: string): Promise<SharedTabsSummary> {
  const row = await env.DB.prepare(
    `SELECT COUNT(DISTINCT dt.tab_id) AS tabs, COUNT(DISTINCT o.document_id) AS documents
       FROM document_tabs dt
       JOIN document_tabs o ON o.tab_id = dt.tab_id AND o.document_id <> dt.document_id
      WHERE dt.document_id = ?`,
  )
    .bind(documentId)
    .first<SharedTabsSummary>();
  return { tabs: row?.tabs ?? 0, documents: row?.documents ?? 0 };
}

// Look up every document id that links the given tab. Used by the
// link endpoint's auth check (caller must own at least one of
// them) and would also drive a future "this tab is shared with N
// documents" indicator.
export async function documentsContainingTab(env: Env, tabId: string): Promise<string[]> {
  const rows = await env.DB.prepare('SELECT document_id FROM document_tabs WHERE tab_id = ?')
    .bind(tabId)
    .all<{ document_id: string }>();
  return (rows.results ?? []).map((r) => r.document_id);
}

// One position in a reorder request: the tab id plus its per-document
// folder (docs/specs/006-document/tab-folders.md). Folder rides this path — never the per-tab content
// PUT — so a content save can't clobber membership. `null`/omitted =
// loose. A plain `string` is accepted for the legacy (pre-folder)
// payload shape and treated as loose.
type ReorderEntry = string | { id: string; folder?: string | null };

// Normalise one reorder entry to its (id, folder) form: legacy string
// entries are loose, and empty / whitespace folder names collapse to
// NULL so a blank folder can never persist. Pure + exported for tests.
export function normalizeReorderEntry(entry: ReorderEntry): { id: string; folder: string | null } {
  if (typeof entry === 'string') return { id: entry, folder: null };
  const trimmed = entry.folder?.trim();
  return { id: entry.id, folder: trimmed ? trimmed : null };
}

// Update tab order + folder membership. Caller passes the entries in
// their new positions; we rewrite every order_index (and folder) in
// one batch. Cheap given the < 20-tab scale we see in practice (see
// docs/specs/006-document/per-tab-storage.md "Risk"). Empty / whitespace folder names normalise to NULL
// so a blank folder can never persist.
export async function reorderTabs(
  env: Env,
  documentId: string,
  entries: ReorderEntry[],
): Promise<void> {
  const now = Date.now();
  // Order and folder live on the link, per document
  // (docs/specs/006-document/tab-document-many-to-many.md): moving a tab here
  // leaves its place in every other document, and its body, untouched.
  const batch = entries.map((entry, idx) => {
    const { id: tabId, folder } = normalizeReorderEntry(entry);
    return env.DB.prepare(
      'UPDATE document_tabs SET order_index = ?, folder = ? WHERE document_id = ? AND tab_id = ?',
    ).bind(idx, folder, documentId, tabId);
  });
  if (batch.length > 0) await env.DB.batch(batch);
  await env.DB.prepare('UPDATE documents SET saved_at = ? WHERE id = ?')
    .bind(now, documentId)
    .run();
}

// Compare-and-swap one tab's `data` blob (docs/specs/012-collaboration/qa-board.md). Writes `nextData` only
// if the row still holds exactly `expectedData`, the string the caller read,
// and reports whether it did. The Q&A board's endpoint loops on this so a
// room voting in the same second can't lose a vote to the read-modify-write
// race a plain upsert would have.
//
// Only `data` and `updated_at` move: a board write never renames, reorders or
// relinks the tab, and it touches no action or thread, so the collaboration
// index (docs/specs/013-workspace/activity-page.md) has nothing to mirror. The
// image reference index is only ever ADDED to here: the swap can lose to a
// concurrent save, and a delete would then drop references the winner wrote.
export async function swapTabData(
  env: Env,
  documentId: string,
  tabId: string,
  expectedData: string,
  nextData: string,
  // `nextData`'s element count, from the tab the caller parsed to build it (migration 0059).
  nextElementCount: number,
): Promise<boolean> {
  assertTabDataFits(tabId, nextData, 'swapTabData');
  const now = Date.now();
  const [res] = await env.DB.batch([
    env.DB.prepare(
      'UPDATE tabs SET data = ?, updated_at = ?, element_count = ? WHERE id = ? AND data = ?',
    ).bind(nextData, now, nextElementCount, tabId, expectedData),
    ...imageRefAddStatements(env, tabId, imageRefIdsFromData(nextData)),
  ]);
  if ((res?.meta?.changes ?? 0) === 0) return false;
  await env.DB.prepare('UPDATE documents SET saved_at = ? WHERE id = ?')
    .bind(now, documentId)
    .run();
  return true;
}
