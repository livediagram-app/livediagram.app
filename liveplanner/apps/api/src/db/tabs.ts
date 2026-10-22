// tabs — one row per tab, linked to projects through the
// project_tabs many-to-many table (docs/specs/006-project/tab-project-many-to-many.md).

import { capElementActions, drawnCount, type Tab } from '@liveplanner/project';
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
import type { SharedTabsSummary } from '@liveplanner/api-schema';
import type { Env, TabDTO } from '../types';
import { tabStatsOf, tabStatsStatement, type TabStats } from './tab-stats';
import { collabIndexStatements } from './collab-index';
import { sheetRefIds, sheetRefReplaceStatements, sheetSettleStatements } from './sheet-refs';

// Whether `tabId` is a tab that exists but is not one of `projectId`'s: a save must never adopt it. A save
// upserts by tab id, so without this a tab id seen elsewhere (a share link) could
// overwrite that tab and link it into the caller's own project. Linking an existing tab has its own route.
export async function tabBelongsElsewhere(
  env: Env,
  tabId: string,
  projectId: string,
): Promise<boolean> {
  const row = await env.DB.prepare(
    `SELECT 1 AS found FROM tabs t
      WHERE t.id = ?
        AND NOT EXISTS (SELECT 1 FROM project_tabs dt WHERE dt.tab_id = t.id AND dt.project_id = ?)`,
  )
    .bind(tabId, projectId)
    .first<{ found: number }>();
  return row !== null;
}

export async function getTab(env: Env, projectId: string, tabId: string): Promise<TabDTO | null> {
  // Resolve via the project_tabs link table (docs/specs/006-project/tab-project-many-to-many.md) so a
  // linked tab surfaces from every project that contains it. The link
  // also carries the per-project order_index, so the returned summary's
  // position is correct for whichever project the caller asked about.
  const row = await env.DB.prepare(
    `SELECT t.id, dt.project_id, t.name, dt.order_index, t.data, t.updated_at, t.rev, dt.folder
       FROM tabs t
       JOIN project_tabs dt ON dt.tab_id = t.id
      WHERE t.id = ? AND dt.project_id = ?`,
  )
    .bind(tabId, projectId)
    .first<TabRow>();
  return row ? rowToTab(row) : null;
}

// The project's tabs that hold a comment thread, in tab order (agent-presence PR21): the thread listing reads them
// one at a time rather than every body at once.
export async function tabIdsWithComments(env: Env, projectId: string): Promise<string[]> {
  const { results } = await env.DB.prepare(
    `SELECT dt.tab_id FROM project_tabs dt JOIN tabs t ON t.id = dt.tab_id
      WHERE dt.project_id = ?
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
  env: Env,
  projectId: string,
  offset: number,
  limit: number,
): Promise<TabDTO[]> {
  const { results } = await env.DB.prepare(
    `SELECT t.id, dt.project_id, t.name, dt.order_index, t.data, t.updated_at, t.rev, dt.folder
       FROM tabs t
       JOIN project_tabs dt ON dt.tab_id = t.id
      WHERE dt.project_id = ? AND instr(t.data, '"plan-board"') > 0
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
  env: Env,
  projectId: string,
  offset: number,
  limit: number,
): Promise<TabDTO[]> {
  const { results } = await env.DB.prepare(
    `SELECT t.id, dt.project_id, t.name, dt.order_index, t.data, t.updated_at, t.rev, dt.folder
       FROM tabs t
       JOIN project_tabs dt ON dt.tab_id = t.id
      WHERE dt.project_id = ?
      ORDER BY dt.order_index, t.id
      LIMIT ? OFFSET ?`,
  )
    .bind(projectId, limit, offset)
    .all<TabRow>();
  return results.map(rowToTab);
}

// The raw `tabs.data` JSON for a project's first tab (lowest
// order_index in the project_tabs link), or null when the project has
// no tabs. Used by the SVG snapshot render-cache (docs/specs/006-project/project-snapshots.md), which needs
// only the element body — never the full TabDTO hydration — so this
// reads the single `data` column rather than going through getTab.
// The `empty` column of a project list (docs/specs/006-project/project-snapshots.md): the element
// count of the project's first tab, or of `scopeTabSql`'s tab when that is not null. Reads the
// count each tab write binds, never a tab body. NULL = no tab, -1 = not yet known.
export function firstTabCountSql(projectIdSql: string, scopeTabSql: string | null = null): string {
  const scope = scopeTabSql ? ` AND (${scopeTabSql} IS NULL OR dt.tab_id = ${scopeTabSql})` : '';
  return `(SELECT COALESCE(t.element_count, -1)
             FROM project_tabs dt
             JOIN tabs t ON t.id = dt.tab_id
            WHERE dt.project_id = ${projectIdSql}${scope}
            ORDER BY dt.order_index ASC
            LIMIT 1) AS first_tab_count`;
}

// No tab, or a counted tab with no elements. A count not yet known is not empty: its thumbnail is asked for.
export function isEmptyCount(firstTabCount: number | null | undefined): boolean {
  return firstTabCount == null || firstTabCount === 0;
}

// A stored tab body with its id and its element count (null until known).
export type StoredTabBody = { id: string; data: string; elementCount: number | null };

// The project's first tab, or `tabId`'s tab when given, as the snapshot renderer reads it.
export async function getTabBody(
  env: Env,
  projectId: string,
  tabId: string | null = null,
): Promise<StoredTabBody | null> {
  const row = await env.DB.prepare(
    `SELECT t.id, t.data, t.element_count
       FROM project_tabs dt
       JOIN tabs t ON t.id = dt.tab_id
      WHERE dt.project_id = ?${tabId === null ? '' : ' AND dt.tab_id = ?'}
      ORDER BY dt.order_index ASC
      LIMIT 1`,
  )
    .bind(...(tabId === null ? [projectId] : [projectId, tabId]))
    .first<{ id: string; data: string; element_count: number | null }>();
  return row ? { id: row.id, data: row.data, elementCount: row.element_count ?? null } : null;
}

// How much the project's first tab has to draw (drawnCount): its stored count, or a parse of its body while the count is
// not yet known. Zero with no tab or an unreadable body. Needs no snapshot store, unlike a render.
export async function firstTabElementCount(env: Env, projectId: string): Promise<number> {
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
export async function stampTabElementCount(env: Env, tabId: string, count: number): Promise<void> {
  await env.DB.prepare('UPDATE tabs SET element_count = ? WHERE id = ? AND element_count IS NULL')
    .bind(count, tabId)
    .run();
}

// The raw `tabs.data` JSON for a SPECIFIC tab in a project, or null when
// that tab isn't part of the project. Resolved through the project_tabs
// link (like getTab) so a tab id only renders for a project that
// actually contains it — a share code for project A can never coax out
// a tab that lives only in project B. Backs the per-tab live image
// (docs/specs/013-workspace/live-image-share.md); mirrors getFirstTabData but keyed by tab id instead of the
// lowest order_index.
export async function getTabData(
  env: Env,
  projectId: string,
  tabId: string,
): Promise<string | null> {
  const row = await env.DB.prepare(
    `SELECT t.data
       FROM project_tabs dt
       JOIN tabs t ON t.id = dt.tab_id
      WHERE dt.project_id = ? AND dt.tab_id = ?
      LIMIT 1`,
  )
    .bind(projectId, tabId)
    .first<{ data: string }>();
  return row?.data ?? null;
}

// How a tab write moves the revision (docs/specs/024-agents/agent-changesets.md "The tab revision"):
// `advance` from whatever is stored, or to exactly `expected + 1`, which the trigger
// `tabs_rev_advances` turns into a compare-and-swap (CS3).
type TabRevWrite = { advance: true } | { expected: number };

// The statements of one tab write. Splits the live-app's Tab type into columns + a `data` JSON
// blob (everything except id + name) so list queries can return summaries without parsing element
// trees. The body goes to `tabs` (RETURNING its new `rev`, always first), this project's position
// to its `project_tabs` link (docs/specs/006-project/tab-project-many-to-many.md), the
// project's `saved_at`, and the collaboration and sheet reference indexes, replaced in the SAME
// batch as the blob they mirror so they can never drift. Exported so a changeset batches its
// record beside the write: a lost compare-and-swap then aborts the whole batch.
export function tabWriteStatements(
  env: Env,
  projectId: string,
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
    env.DB.prepare(
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
    env.DB.prepare(
      `INSERT INTO project_tabs (project_id, tab_id, order_index, added_at)
       VALUES (?, ?, ?, ?)
       ON CONFLICT (project_id, tab_id) DO UPDATE SET order_index = excluded.order_index`,
    ).bind(projectId, id, orderIndex, now),
    // The Details view's numbers (docs/specs/013-workspace/explorer-details-view.md), from the body
    // just stored, after the tabs upsert, which the row's FK needs.
    tabStatsStatement(env, id, tabStatsOf(rest, data), now),
    // The Explorer's "Updated X ago" line. Pure metadata write — no element JSON.
    env.DB.prepare('UPDATE projects SET saved_at = ? WHERE id = ?').bind(now, projectId),
    // The collaboration index (docs/specs/013-workspace/inbox.md §2.1), after the tabs
    // upsert, which the rows' FK needs.
    ...collabIndexStatements(env, id, tab.elements),
    // The sheet reference index (docs/specs/029-sheets/sheet-store.md "Deleting a sheet"), after the tabs and
    // project_tabs upserts, which the rows' FK and the settling triggers read. A write whose
    // references are unchanged touches no row, so the triggers cost it nothing.
    ...sheetRefReplaceStatements(env, id, sheetRefIds(tab.elements)),
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
  env: Env,
  projectId: string,
  input: Tab,
  orderIndex: number,
): Promise<number> {
  const results = await env.DB.batch(
    tabWriteStatements(env, projectId, input, orderIndex, { advance: true }),
  );
  return revFromBatch(results);
}

// A tab write at the revision the caller read: lands as `expectedRev + 1`, or throws
// `tab_rev_stale` (isTabRevStale) and writes nothing when the tab moved since (CS3, CS4).
export async function upsertTabAtRev(
  env: Env,
  projectId: string,
  input: Tab,
  orderIndex: number,
  expectedRev: number,
): Promise<number> {
  const results = await env.DB.batch(
    tabWriteStatements(env, projectId, input, orderIndex, { expected: expectedRev }),
  );
  return revFromBatch(results);
}

// A tab rename (docs/specs/024-agents/agent-changesets.md "Whole-tab saves and tab renames"): the
// name column only, advancing the revision (CS42). Answers the new revision, or null for no tab.
export async function renameTab(env: Env, tabId: string, name: string): Promise<number | null> {
  const row = await env.DB.prepare(
    'UPDATE tabs SET name = ?, rev = rev + 1, updated_at = ? WHERE id = ? RETURNING rev',
  )
    .bind(name, Date.now(), tabId)
    .first<{ rev: number }>();
  return row?.rev ?? null;
}

// Bulk-seed a fresh project's tabs in one batch (create path). The
// per-tab upsertTab does three sequential writes each (tab body,
// link row, and a redundant saved_at bump), so seeding K tabs that
// way costs ~3K serial round trips. Here we collect every insert and
// submit one batch, then bump saved_at exactly once. Same ON CONFLICT
// semantics as upsertTab so a retried create stays idempotent.
// `savedAt`: the project's last-modified date after seeding, its own when a create carried one
// (docs/specs/015-api/api.md "Project dates"); absent, now.
export async function seedTabs(
  env: Env,
  projectId: string,
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
        `INSERT INTO tabs (id, name, data, updated_at, element_count, rev)
         VALUES (?, ?, ?, ?, ?, 1)
         ON CONFLICT(id) DO UPDATE SET
           name = excluded.name,
           data = excluded.data,
           updated_at = excluded.updated_at,
           element_count = excluded.element_count,
           rev = tabs.rev + 1`,
      ).bind(id, name, data, now, drawnCount(tab)),
      env.DB.prepare(
        `INSERT INTO project_tabs (project_id, tab_id, order_index, added_at)
         VALUES (?, ?, ?, ?)
         ON CONFLICT (project_id, tab_id) DO UPDATE SET order_index = excluded.order_index`,
      ).bind(projectId, id, idx, now),
      tabStatsStatement(env, id, tabStatsOf(rest, data), now),
    ];
  });
  stmts.push(
    env.DB.prepare('UPDATE projects SET saved_at = ? WHERE id = ?').bind(
      savedAt ?? now,
      projectId,
    ),
  );
  // Index rows for every seeded tab (docs/specs/013-workspace/inbox.md §2.1): a JSON import or a
  // copy from a share link can carry actions and threads in on create.
  for (const tab of capped) {
    stmts.push(...collabIndexStatements(env, tab.id, tab.elements));
    // A seed's sheets come after its tabs (routes/projects.ts), so they find these references on create.
    stmts.push(...sheetRefReplaceStatements(env, tab.id, sheetRefIds(tab.elements)));
  }
  await env.DB.batch(stmts);
}

// Which of `tabIds` already name a tab that is NOT in `projectId`: a create
// seeding one of those would write into a tab another project holds, so the
// create re-mints it (docs/specs/006-project/offline-mode.md, "Shared tabs fork").
// A tab already in this project is a retried create and keeps its id.
export async function tabIdsHeldElsewhere(
  env: Env,
  projectId: string,
  tabIds: string[],
): Promise<Set<string>> {
  if (tabIds.length === 0) return new Set();
  const rows = await env.DB.prepare(
    `SELECT id FROM tabs
      WHERE id IN (SELECT value FROM json_each(?))
        AND NOT EXISTS (SELECT 1 FROM project_tabs dt WHERE dt.project_id = ? AND dt.tab_id = tabs.id)`,
  )
    .bind(JSON.stringify(tabIds), projectId)
    .all<{ id: string }>();
  return new Set((rows.results ?? []).map((r) => r.id));
}

// Remove the tab from this project (drops the `project_tabs` link
// row). The underlying `tabs` row only goes away when no other
// project still references it: linked tabs (per docs/specs/006-project/tab-project-many-to-many.md) survive
// an unlink from one of their containing projects so the body
// stays readable from the rest. Legacy single-link tabs end up
// fully deleted, matching the prior contract.
//
// Answers the tab's stored body as it was unlinked (null when this project did not hold it), read
// by the unlink itself so a comment written a moment before cannot slip between a read and the
// delete: the caller retracts the tab's comment events from this project's feed with it.
export async function deleteTabRow(
  env: Env,
  projectId: string,
  tabId: string,
): Promise<string | null> {
  const unlinked = await env.DB.prepare(
    `DELETE FROM project_tabs WHERE project_id = ? AND tab_id = ?
      RETURNING (SELECT t.data FROM tabs t WHERE t.id = project_tabs.tab_id) AS data`,
  )
    .bind(projectId, tabId)
    .first<{ data: string | null }>();
  const remaining = await env.DB.prepare('SELECT COUNT(*) AS n FROM project_tabs WHERE tab_id = ?')
    .bind(tabId)
    .first<{ n: number }>();
  if ((remaining?.n ?? 0) === 0) {
    await env.DB.prepare('DELETE FROM tabs WHERE id = ?').bind(tabId).run();
  }
  // The tab's references are gone (by the FK cascade, or by the unlink the reference join reads), with the link
  // the triggers would find the project by, so the project's sheets settle here.
  await env.DB.batch(sheetSettleStatements(env, projectId, Date.now()));
  return unlinked?.data ?? null;
}

// Link an existing tab into another project (docs/specs/006-project/tab-project-many-to-many.md). Inserts a
// `project_tabs` row at the end of the target project's order,
// idempotent on conflict so re-linking the same pair returns 200
// without double-counting. The `tabs` row itself is untouched: the
// tab body lives in one place and edits propagate to every project
// that references it. Returns true when a fresh link was created,
// false when the link already existed (idempotent path).
export async function linkTabToProject(
  env: Env,
  projectId: string,
  tabId: string,
): Promise<boolean> {
  const existing = await env.DB.prepare(
    'SELECT 1 AS present FROM project_tabs WHERE project_id = ? AND tab_id = ?',
  )
    .bind(projectId, tabId)
    .first<{ present: number }>();
  if (existing) return false;
  const count = await env.DB.prepare(
    'SELECT COUNT(*) AS n FROM project_tabs WHERE project_id = ?',
  )
    .bind(projectId)
    .first<{ n: number }>();
  const orderIndex = count?.n ?? 0;
  const now = Date.now();
  await env.DB.prepare(
    `INSERT INTO project_tabs (project_id, tab_id, order_index, added_at)
     VALUES (?, ?, ?, ?)
     ON CONFLICT (project_id, tab_id) DO NOTHING`,
  )
    .bind(projectId, tabId, orderIndex, now)
    .run();
  await env.DB.prepare('UPDATE projects SET saved_at = ? WHERE id = ?')
    .bind(now, projectId)
    .run();
  return true;
}

// The link endpoint's authorisation check in one query: is this tab
// linked into at least one project owned by `ownerId`? Replaces the
// old "list every containing project id, then getProject() each in a
// loop" pattern (N full project hydrations to read one column). The
// JOIN + LIMIT 1 stops at the first owned match.
export async function tabLinkedToOwnedProject(
  env: Env,
  tabId: string,
  ownerId: string,
): Promise<boolean> {
  const row = await env.DB.prepare(
    `SELECT 1 AS present
       FROM project_tabs dt
       JOIN projects d ON d.id = dt.project_id
      WHERE dt.tab_id = ? AND d.owner_id = ? AND d.trashed_at IS NULL
      LIMIT 1`,
  )
    .bind(tabId, ownerId)
    .first<{ present: number }>();
  return row !== null;
}

// How many of this project's tabs are shared (also linked into another
// project), and across how many other projects: what deleting or taking the
// project offline leaves behind (docs/specs/006-project/tab-project-many-to-many.md,
// "Shared-tab notice").
export async function sharedTabsSummary(env: Env, projectId: string): Promise<SharedTabsSummary> {
  const row = await env.DB.prepare(
    `SELECT COUNT(DISTINCT dt.tab_id) AS tabs, COUNT(DISTINCT o.project_id) AS projects
       FROM project_tabs dt
       JOIN project_tabs o ON o.tab_id = dt.tab_id AND o.project_id <> dt.project_id
      WHERE dt.project_id = ?`,
  )
    .bind(projectId)
    .first<SharedTabsSummary>();
  return { tabs: row?.tabs ?? 0, projects: row?.projects ?? 0 };
}

// Look up every project id that links the given tab. Used by the
// link endpoint's auth check (caller must own at least one of
// them) and would also drive a future "this tab is shared with N
// projects" indicator.
export async function projectsContainingTab(env: Env, tabId: string): Promise<string[]> {
  const rows = await env.DB.prepare('SELECT project_id FROM project_tabs WHERE tab_id = ?')
    .bind(tabId)
    .all<{ project_id: string }>();
  return (rows.results ?? []).map((r) => r.project_id);
}

// One position in a reorder request: the tab id plus its per-project
// folder (docs/specs/006-project/tab-folders.md). Folder rides this path — never the per-tab content
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
// docs/specs/006-project/per-tab-storage.md "Risk"). Empty / whitespace folder names normalise to NULL
// so a blank folder can never persist.
export async function reorderTabs(
  env: Env,
  projectId: string,
  entries: ReorderEntry[],
): Promise<void> {
  const now = Date.now();
  // Order and folder live on the link, per project
  // (docs/specs/006-project/tab-project-many-to-many.md): moving a tab here
  // leaves its place in every other project, and its body, untouched.
  const batch = entries.map((entry, idx) => {
    const { id: tabId, folder } = normalizeReorderEntry(entry);
    return env.DB.prepare(
      'UPDATE project_tabs SET order_index = ?, folder = ? WHERE project_id = ? AND tab_id = ?',
    ).bind(idx, folder, projectId, tabId);
  });
  if (batch.length > 0) await env.DB.batch(batch);
  await env.DB.prepare('UPDATE projects SET saved_at = ? WHERE id = ?')
    .bind(now, projectId)
    .run();
}

// Compare-and-swap one tab's `data` blob (docs/specs/013-workspace/share-roles.md "Integrity"). Writes `nextData`
// only if the row still holds exactly `expectedData`, the string the caller read,
// and reports whether it did. A Participant's write loops on this so a room
// answering in the same second can't lose an answer to the read-modify-write
// race a plain upsert would have.
//
// Only `data` and `updated_at` move: a participant write never renames, reorders or
// relinks the tab, and it touches no action or thread, so the collaboration
// index (docs/specs/013-workspace/inbox.md) has nothing to mirror.
export async function swapTabData(
  env: Env,
  projectId: string,
  tabId: string,
  expectedData: string,
  nextData: string,
  // `nextData`'s stats (tabStatsOf), from the tab the caller parsed to build it; its element count
  // is also the tab's element_count.
  nextStats: TabStats,
): Promise<boolean> {
  assertTabDataFits(tabId, nextData, 'swapTabData');
  const now = Date.now();
  const [res] = await env.DB.batch([
    env.DB.prepare(
      'UPDATE tabs SET data = ?, updated_at = ?, element_count = ?, rev = rev + 1 WHERE id = ? AND data = ?',
    ).bind(nextData, now, nextStats.elementCount, tabId, expectedData),
    // Only if the swap above won: then the tab stores exactly `nextData`.
    tabStatsStatement(env, tabId, nextStats, now, nextData),
  ]);
  if ((res?.meta?.changes ?? 0) === 0) return false;
  await env.DB.prepare('UPDATE projects SET saved_at = ? WHERE id = ?')
    .bind(now, projectId)
    .run();
  return true;
}

// Does the project link this tab? A workbench ticket naming a tab the project lacks is refused
// (docs/specs/013-workspace/blueprints/workbench-embeds.md "The ticket mint").
export async function projectLinksTab(
  env: Env,
  projectId: string,
  tabId: string,
): Promise<boolean> {
  const row = await env.DB.prepare(
    'SELECT 1 AS present FROM project_tabs WHERE project_id = ? AND tab_id = ?',
  )
    .bind(projectId, tabId)
    .first<{ present: number }>();
  return row !== null;
}
