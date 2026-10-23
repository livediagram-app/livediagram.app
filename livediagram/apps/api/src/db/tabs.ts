// tabs — one row per tab in the document's own SQLite (docs/specs/015-api/api.md "Storage"), placed in the document
// by `document_tabs`. Runs only inside the document's Durable Object, on `env.DOCUMENT_DB`
// (document-room/document-db.ts).

import { capElementActions, drawnCount, type Tab } from '@livediagram/document';
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
import type { DocumentEnv, TabDTO } from '../types';
import { imageRefIds, imageRefIdsFromData } from '../image-refs/extract';
import { tabStatsOf, tabStatsStatement, type TabStats } from './tab-stats';
import { imageRefAddStatements, imageRefReplaceStatements } from './image-refs';

export async function getTab(
  env: DocumentEnv,
  documentId: string,
  tabId: string,
): Promise<TabDTO | null> {
  // Resolve via the document_tabs link, which carries the tab's place in the document.
  const row = await env.DOCUMENT_DB.prepare(
    `SELECT t.id, dt.document_id, t.name, dt.order_index, t.data, t.updated_at, t.rev, dt.folder
       FROM tabs t
       JOIN document_tabs dt ON dt.tab_id = t.id
      WHERE t.id = ? AND dt.document_id = ?`,
  )
    .bind(tabId, documentId)
    .first<TabRow>();
  return row ? rowToTab(row) : null;
}

// The document's tabs that hold a comment thread, in tab order (agent-presence PR21): the thread listing reads them
// one at a time rather than every body at once.
export async function tabIdsWithComments(env: DocumentEnv, documentId: string): Promise<string[]> {
  const { results } = await env.DOCUMENT_DB.prepare(
    `SELECT dt.tab_id FROM document_tabs dt JOIN tabs t ON t.id = dt.tab_id
      WHERE dt.document_id = ?
        AND instr(t.data, '"commentThread"') > 0
      ORDER BY dt.order_index, dt.tab_id`,
  )
    .bind(documentId)
    .all<{ tab_id: string }>();
  return results.map((r) => r.tab_id);
}

// A page of a document's tabs in order, bodies included: `overview` reads a document this way so it
// never holds more than `limit` bodies at once (docs/specs/024-agents/blueprints/document-views.md, VW47).
export async function tabBodiesInOrder(
  env: DocumentEnv,
  documentId: string,
  offset: number,
  limit: number,
): Promise<TabDTO[]> {
  const { results } = await env.DOCUMENT_DB.prepare(
    `SELECT t.id, dt.document_id, t.name, dt.order_index, t.data, t.updated_at, t.rev, dt.folder
       FROM tabs t
       JOIN document_tabs dt ON dt.tab_id = t.id
      WHERE dt.document_id = ?
      ORDER BY dt.order_index, t.id
      LIMIT ? OFFSET ?`,
  )
    .bind(documentId, limit, offset)
    .all<TabRow>();
  return results.map(rowToTab);
}

// A stored tab body with its id and its element count (null until known).
export type StoredTabBody = { id: string; data: string; elementCount: number | null };

// The document's first tab, or `tabId`'s tab when given, as the snapshot renderer reads it.
export async function getTabBody(
  env: DocumentEnv,
  documentId: string,
  tabId: string | null = null,
): Promise<StoredTabBody | null> {
  const row = await env.DOCUMENT_DB.prepare(
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

// How much the document's first tab has to draw (drawnCount): its stored count, or a parse of its body while the count is
// not yet known (migration 0059). Zero with no tab or an unreadable body. Needs no snapshot store, unlike a render.
export async function firstTabElementCount(env: DocumentEnv, documentId: string): Promise<number> {
  const body = await getTabBody(env, documentId);
  if (!body) return 0;
  if (body.elementCount !== null) return body.elementCount;
  try {
    return drawnCount(JSON.parse(body.data) as { elements?: unknown; form?: unknown });
  } catch {
    return 0;
  }
}

// The lazy backfill (migration 0059): a reader that has parsed a body whose count is still unknown
// records it. Only ever fills a null, so it can never undo a write's own count.
export async function stampTabElementCount(
  env: DocumentEnv,
  tabId: string,
  count: number,
): Promise<void> {
  await env.DOCUMENT_DB.prepare(
    'UPDATE tabs SET element_count = ? WHERE id = ? AND element_count IS NULL',
  )
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
  env: DocumentEnv,
  documentId: string,
  tabId: string,
): Promise<string | null> {
  const row = await env.DOCUMENT_DB.prepare(
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

// How a tab write moves the revision (docs/specs/024-agents/agent-changesets.md "The tab revision"):
// `advance` from whatever is stored, or to exactly `expected + 1`, which the trigger
// `tabs_rev_advances` turns into a compare-and-swap (CS3).
type TabRevWrite = { advance: true } | { expected: number };

// The statements of one tab write. Splits the live-app's Tab type into columns + a `data` JSON
// blob (everything except id + name) so list queries can return summaries without parsing element
// trees. The body goes to `tabs` (RETURNING its new `rev`, always first), its position to its
// `document_tabs` row, the document's `saved_at`, and the image reference index, replaced in the SAME
// transaction as the blob it mirrors so they can never drift. Exported so a changeset batches its
// record beside the write: a lost compare-and-swap then aborts the whole batch.
export function tabWriteStatements(
  env: DocumentEnv,
  documentId: string,
  input: Tab,
  orderIndex: number,
  revision: TabRevWrite,
  now = Date.now(),
): D1PreparedStatement[] {
  // Action panel lists are bounded here, the one place every tab write
  // meets (docs/specs/012-collaboration/action-panel.md "The data").
  const tab = { ...input, elements: capElementActions(input.elements) };
  const { id, name, ...rest } = tab;
  const data = JSON.stringify(rest);
  assertTabDataFits(id, data, 'upsertTab');
  const advance = 'advance' in revision;
  const insertRev = advance ? 1 : revision.expected + 1;
  return [
    env.DOCUMENT_DB.prepare(
      `INSERT INTO tabs (id, name, data, updated_at, element_count, rev)
       VALUES (?, ?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET
         name = excluded.name,
         data = excluded.data,
         updated_at = excluded.updated_at,
         element_count = excluded.element_count,
         rev = ${advance ? 'tabs.rev + 1' : 'excluded.rev'}
       RETURNING rev`,
    ).bind(id, name, data, now, drawnCount(tab), insertRev),
    env.DOCUMENT_DB.prepare(
      `INSERT INTO document_tabs (document_id, tab_id, order_index, added_at)
       VALUES (?, ?, ?, ?)
       ON CONFLICT (document_id, tab_id) DO UPDATE SET order_index = excluded.order_index`,
    ).bind(documentId, id, orderIndex, now),
    // The Details view's numbers (docs/specs/013-workspace/explorer-details-view.md), from the body
    // just stored, after the tabs upsert, which the row's FK needs.
    tabStatsStatement(env, id, tabStatsOf(rest, data), now),
    // The Explorer's "Updated X ago" line. Pure metadata write — no element JSON. The collaboration
    // index (docs/specs/013-workspace/inbox.md §2.1) and the listing summary follow from the outbox the
    // triggers fill in this same transaction (document-room/document-outbox.ts).
    env.DOCUMENT_DB.prepare('UPDATE document SET saved_at = ? WHERE id = ?').bind(now, documentId),
    // The image reference index (docs/specs/009-elements/images.md, "Reference index"), after the tabs upsert,
    // which the rows' FK needs: a reference this transaction missed is an image the media service may sweep
    // (src/media.ts). Its placement grants follow from the outbox (document-room/document-outbox.ts).
    ...imageRefReplaceStatements(env, id, imageRefIds(tab.elements)),
  ];
}

// The revision the first statement of a tabWriteStatements batch returned.
export function revFromBatch(results: readonly unknown[]): number {
  const first = results[0] as { results?: { rev?: unknown }[] } | undefined;
  const rev = first?.results?.[0]?.rev;
  if (typeof rev !== 'number') throw new Error('tab write returned no revision');
  return rev;
}

// A batch the trigger aborted because the tab moved since it was read.
export function isTabRevStale(err: unknown): boolean {
  return err instanceof Error && err.message.includes('tab_rev_stale');
}

// Full upsert for a single tab, advancing its revision from whatever is stored. One batch: the
// extra serial D1 hops were once the largest latency item on a save. Answers the new revision.
export async function upsertTab(
  env: DocumentEnv,
  documentId: string,
  input: Tab,
  orderIndex: number,
): Promise<number> {
  const results = await env.DOCUMENT_DB.batch(
    tabWriteStatements(env, documentId, input, orderIndex, { advance: true }),
  );
  return revFromBatch(results);
}

// A tab write at the revision the caller read: lands as `expectedRev + 1`, or throws
// `tab_rev_stale` (isTabRevStale) and writes nothing when the tab moved since (CS3, CS4).
export async function upsertTabAtRev(
  env: DocumentEnv,
  documentId: string,
  input: Tab,
  orderIndex: number,
  expectedRev: number,
): Promise<number> {
  const results = await env.DOCUMENT_DB.batch(
    tabWriteStatements(env, documentId, input, orderIndex, { expected: expectedRev }),
  );
  return revFromBatch(results);
}

// A tab rename (docs/specs/024-agents/agent-changesets.md "Whole-tab saves and tab renames"): the
// name column only, advancing the revision (CS42). Answers the new revision, or null for no tab.
export async function renameTab(
  env: DocumentEnv,
  tabId: string,
  name: string,
): Promise<number | null> {
  const row = await env.DOCUMENT_DB.prepare(
    'UPDATE tabs SET name = ?, rev = rev + 1, updated_at = ? WHERE id = ? RETURNING rev',
  )
    .bind(name, Date.now(), tabId)
    .first<{ rev: number }>();
  return row?.rev ?? null;
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
  env: DocumentEnv,
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
      env.DOCUMENT_DB.prepare(
        `INSERT INTO tabs (id, name, data, updated_at, element_count, rev)
         VALUES (?, ?, ?, ?, ?, 1)
         ON CONFLICT(id) DO UPDATE SET
           name = excluded.name,
           data = excluded.data,
           updated_at = excluded.updated_at,
           element_count = excluded.element_count,
           rev = tabs.rev + 1`,
      ).bind(id, name, data, now, drawnCount(tab)),
      env.DOCUMENT_DB.prepare(
        `INSERT INTO document_tabs (document_id, tab_id, order_index, added_at)
         VALUES (?, ?, ?, ?)
         ON CONFLICT (document_id, tab_id) DO UPDATE SET order_index = excluded.order_index`,
      ).bind(documentId, id, idx, now),
      tabStatsStatement(env, id, tabStatsOf(rest, data), now),
    ];
  });
  stmts.push(
    env.DOCUMENT_DB.prepare('UPDATE document SET saved_at = ? WHERE id = ?').bind(
      savedAt ?? now,
      documentId,
    ),
  );
  // The collaboration index of every seeded tab follows from the outbox (document-room/document-outbox.ts): a
  // JSON import or a copy from a share link can carry actions and threads in on create.
  for (const tab of capped) {
    stmts.push(...imageRefReplaceStatements(env, tab.id, imageRefIds(tab.elements)));
  }
  await env.DOCUMENT_DB.batch(stmts);
}

// Remove the tab from the document: its `document_tabs` row and its body (its stats, image references and
// changesets go with it by the foreign keys), in one transaction.
//
// Answers the tab's stored body as it was removed (null when this document did not hold it), read
// by the delete itself so a comment written a moment before cannot slip between a read and the
// delete: the caller retracts the tab's comment events from this document's feed with it.
export async function deleteTabRow(
  env: DocumentEnv,
  documentId: string,
  tabId: string,
): Promise<string | null> {
  const [unlinked] = await env.DOCUMENT_DB.batch([
    env.DOCUMENT_DB.prepare(
      `DELETE FROM document_tabs WHERE document_id = ? AND tab_id = ?
        RETURNING (SELECT t.data FROM tabs t WHERE t.id = document_tabs.tab_id) AS data`,
    ).bind(documentId, tabId),
    env.DOCUMENT_DB.prepare(
      'DELETE FROM tabs WHERE id = ? AND NOT EXISTS (SELECT 1 FROM document_tabs WHERE tab_id = ?)',
    ).bind(tabId, tabId),
  ]);
  const row = (unlinked as { results?: { data?: string | null }[] } | undefined)?.results?.[0];
  return row?.data ?? null;
}

// One position in a reorder request: the tab id plus its per-document
// folder (docs/specs/006-document/tab-folders.md). Folder rides this path — never the per-tab content
// PUT — so a content save can't clobber membership. `null`/omitted =
// loose. A plain `string` is accepted for the legacy (pre-folder)
// payload shape and treated as loose.
type ReorderEntry = string | { id: string; folder?: string | null };

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
  env: DocumentEnv,
  documentId: string,
  entries: ReorderEntry[],
): Promise<void> {
  const now = Date.now();
  // Order and folder live on the link, so moving a tab leaves its body untouched.
  const batch = entries.map((entry, idx) => {
    const { id: tabId, folder } = normalizeReorderEntry(entry);
    return env.DOCUMENT_DB.prepare(
      'UPDATE document_tabs SET order_index = ?, folder = ? WHERE document_id = ? AND tab_id = ?',
    ).bind(idx, folder, documentId, tabId);
  });
  batch.push(
    env.DOCUMENT_DB.prepare('UPDATE document SET saved_at = ? WHERE id = ?').bind(now, documentId),
  );
  await env.DOCUMENT_DB.batch(batch);
}

// Compare-and-swap one tab's `data` blob (docs/specs/012-collaboration/qa-board.md). Writes `nextData` only
// if the row still holds exactly `expectedData`, the string the caller read,
// and reports whether it did. The Q&A board's endpoint loops on this so a
// room voting in the same second can't lose a vote to the read-modify-write
// race a plain upsert would have.
//
// Only `data` and `updated_at` move: a board write never renames, reorders or
// relinks the tab, and it touches no action or thread, so the collaboration
// index (docs/specs/013-workspace/inbox.md) has nothing to mirror. The
// image reference index is only ever ADDED to here: the swap can lose to a
// concurrent save, and a delete would then drop references the winner wrote.
export async function swapTabData(
  env: DocumentEnv,
  documentId: string,
  tabId: string,
  expectedData: string,
  nextData: string,
  // `nextData`'s stats (tabStatsOf), from the tab the caller parsed to build it; its element count
  // is also the tab's element_count (migration 0059).
  nextStats: TabStats,
): Promise<boolean> {
  assertTabDataFits(tabId, nextData, 'swapTabData');
  const now = Date.now();
  const [res] = await env.DOCUMENT_DB.batch([
    env.DOCUMENT_DB.prepare(
      'UPDATE tabs SET data = ?, updated_at = ?, element_count = ?, rev = rev + 1 WHERE id = ? AND data = ?',
    ).bind(nextData, now, nextStats.elementCount, tabId, expectedData),
    // Only if the swap above won: then the tab stores exactly `nextData`.
    tabStatsStatement(env, tabId, nextStats, now, nextData),
    // Add only, so harmless when the swap lost: the references are a superset, which keeps bytes.
    ...imageRefAddStatements(env, tabId, imageRefIdsFromData(nextData)),
  ]);
  if ((res?.meta?.changes ?? 0) === 0) return false;
  await env.DOCUMENT_DB.prepare('UPDATE document SET saved_at = ? WHERE id = ?')
    .bind(now, documentId)
    .run();
  return true;
}

// Does the document hold this tab? A workbench ticket naming a tab the document lacks is refused
// (docs/specs/013-workspace/blueprints/workbench-embeds.md "The ticket mint").
export async function documentHasTab(
  env: DocumentEnv,
  documentId: string,
  tabId: string,
): Promise<boolean> {
  const row = await env.DOCUMENT_DB.prepare(
    'SELECT 1 AS present FROM document_tabs WHERE document_id = ? AND tab_id = ?',
  )
    .bind(documentId, tabId)
    .first<{ present: number }>();
  return row !== null;
}
