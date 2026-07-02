// tabs — one row per tab, linked to diagrams through the
// diagram_tabs many-to-many table (migration 0011 / spec/17).

import type { Tab } from '@livediagram/diagram';
import { rowToTab, type TabRow } from '../tab-row';
import type { Env, TabDTO } from '../types';

export async function getTab(env: Env, diagramId: string, tabId: string): Promise<TabDTO | null> {
  // Resolve via the diagram_tabs link table (spec/17) so linked
  // tabs surface from every diagram that contains them, not just
  // the legacy tabs.diagram_id column (which points only at the
  // tab's original diagram). The link table also carries the
  // per-diagram order_index, so the returned summary's position
  // is correct for whichever diagram the caller asked about.
  const row = await env.DB.prepare(
    `SELECT t.id, dt.diagram_id, t.name, dt.order_index, t.data, t.updated_at, dt.folder
       FROM tabs t
       JOIN diagram_tabs dt ON dt.tab_id = t.id
      WHERE t.id = ? AND dt.diagram_id = ?`,
  )
    .bind(tabId, diagramId)
    .first<TabRow>();
  return row ? rowToTab(row) : null;
}

// The raw `tabs.data` JSON for a diagram's first tab (lowest
// order_index in the diagram_tabs link), or null when the diagram has
// no tabs. Used by the SVG snapshot render-cache (spec/67), which needs
// only the element body — never the full TabDTO hydration — so this
// reads the single `data` column rather than going through getTab.
export async function getFirstTabData(env: Env, diagramId: string): Promise<string | null> {
  const row = await env.DB.prepare(
    `SELECT t.data
       FROM diagram_tabs dt
       JOIN tabs t ON t.id = dt.tab_id
      WHERE dt.diagram_id = ?
      ORDER BY dt.order_index ASC
      LIMIT 1`,
  )
    .bind(diagramId)
    .first<{ data: string }>();
  return row?.data ?? null;
}

// The raw `tabs.data` JSON for a SPECIFIC tab in a diagram, or null when
// that tab isn't part of the diagram. Resolved through the diagram_tabs
// link (like getTab) so a tab id only renders for a diagram that
// actually contains it — a share code for diagram A can never coax out
// a tab that lives only in diagram B. Backs the per-tab live image
// (spec/54); mirrors getFirstTabData but keyed by tab id instead of the
// lowest order_index.
export async function getTabData(
  env: Env,
  diagramId: string,
  tabId: string,
): Promise<string | null> {
  const row = await env.DB.prepare(
    `SELECT t.data
       FROM diagram_tabs dt
       JOIN tabs t ON t.id = dt.tab_id
      WHERE dt.diagram_id = ? AND dt.tab_id = ?
      LIMIT 1`,
  )
    .bind(diagramId, tabId)
    .first<{ data: string }>();
  return row?.data ?? null;
}

// Full upsert for a single tab. Splits the live-app's Tab type into
// columns + a `data` JSON blob (everything except id + name) so list
// queries can return summaries without parsing element trees.
export async function upsertTab(
  env: Env,
  diagramId: string,
  tab: Tab,
  orderIndex: number,
): Promise<void> {
  const { id, name, ...rest } = tab;
  const data = JSON.stringify(rest);
  const now = Date.now();
  // Phase-1 (migration 0011 / spec/17): write to both `tabs` and
  // `diagram_tabs` so the link table is the canonical read path
  // but the legacy denormalised columns stay in sync until a
  // follow-up migration drops them. The two writes are
  // independent — even if the link upsert no-ops (existing entry)
  // the tab body still gets updated.
  // One DB.batch instead of three sequential round trips: this runs
  // once per 600ms per active editor (the autosave), so the two extra
  // serial D1 hops were the single largest latency item on the path.
  await env.DB.batch([
    env.DB.prepare(
      `INSERT INTO tabs (id, diagram_id, name, order_index, data, updated_at)
       VALUES (?, ?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET
         name = excluded.name,
         order_index = excluded.order_index,
         data = excluded.data,
         updated_at = excluded.updated_at`,
    ).bind(id, diagramId, name, orderIndex, data, now),
    env.DB.prepare(
      `INSERT INTO diagram_tabs (diagram_id, tab_id, order_index, added_at)
       VALUES (?, ?, ?, ?)
       ON CONFLICT (diagram_id, tab_id) DO UPDATE SET order_index = excluded.order_index`,
    ).bind(diagramId, id, orderIndex, now),
    // Bump the diagram's saved_at so the Explorer's "Updated X ago"
    // line stays accurate. Pure metadata write — no element JSON.
    env.DB.prepare('UPDATE diagrams SET saved_at = ? WHERE id = ?').bind(now, diagramId),
  ]);
}

// Bulk-seed a fresh diagram's tabs in one batch (create path). The
// per-tab upsertTab does three sequential writes each (tab body,
// link row, and a redundant saved_at bump), so seeding K tabs that
// way costs ~3K serial round trips. Here we collect every insert and
// submit one batch, then bump saved_at exactly once. Same ON CONFLICT
// semantics as upsertTab so a retried create stays idempotent.
export async function seedTabs(env: Env, diagramId: string, tabs: Tab[]): Promise<void> {
  if (tabs.length === 0) return;
  const now = Date.now();
  const stmts = tabs.flatMap((tab, idx) => {
    const { id, name, ...rest } = tab;
    const data = JSON.stringify(rest);
    return [
      env.DB.prepare(
        `INSERT INTO tabs (id, diagram_id, name, order_index, data, updated_at)
         VALUES (?, ?, ?, ?, ?, ?)
         ON CONFLICT(id) DO UPDATE SET
           name = excluded.name,
           order_index = excluded.order_index,
           data = excluded.data,
           updated_at = excluded.updated_at`,
      ).bind(id, diagramId, name, idx, data, now),
      env.DB.prepare(
        `INSERT INTO diagram_tabs (diagram_id, tab_id, order_index, added_at)
         VALUES (?, ?, ?, ?)
         ON CONFLICT (diagram_id, tab_id) DO UPDATE SET order_index = excluded.order_index`,
      ).bind(diagramId, id, idx, now),
    ];
  });
  stmts.push(env.DB.prepare('UPDATE diagrams SET saved_at = ? WHERE id = ?').bind(now, diagramId));
  await env.DB.batch(stmts);
}

// Remove the tab from this diagram (drops the `diagram_tabs` link
// row). The underlying `tabs` row only goes away when no other
// diagram still references it: linked tabs (per spec/17) survive
// an unlink from one of their containing diagrams so the body
// stays readable from the rest. Legacy single-link tabs end up
// fully deleted, matching the prior contract.
//
// change_log entries follow the tabs row: they live on the tab id
// (per #14 in spec/17), so they get dropped only when the tab
// itself goes away. Cascading the log on every unlink would wipe
// the audit panel for every other diagram that still surfaces the
// shared tab.
export async function deleteTabRow(env: Env, diagramId: string, tabId: string): Promise<void> {
  await env.DB.prepare('DELETE FROM diagram_tabs WHERE diagram_id = ? AND tab_id = ?')
    .bind(diagramId, tabId)
    .run();
  const remaining = await env.DB.prepare('SELECT COUNT(*) AS n FROM diagram_tabs WHERE tab_id = ?')
    .bind(tabId)
    .first<{ n: number }>();
  if ((remaining?.n ?? 0) === 0) {
    await env.DB.prepare('DELETE FROM tabs WHERE id = ?').bind(tabId).run();
    await env.DB.prepare('DELETE FROM change_log WHERE tab_id = ?').bind(tabId).run();
  }
}

// Link an existing tab into another diagram (spec/17). Inserts a
// `diagram_tabs` row at the end of the target diagram's order,
// idempotent on conflict so re-linking the same pair returns 200
// without double-counting. The `tabs` row itself is untouched: the
// tab body lives in one place and edits propagate to every diagram
// that references it. Returns true when a fresh link was created,
// false when the link already existed (idempotent path).
export async function linkTabToDiagram(
  env: Env,
  diagramId: string,
  tabId: string,
): Promise<boolean> {
  const existing = await env.DB.prepare(
    'SELECT 1 AS present FROM diagram_tabs WHERE diagram_id = ? AND tab_id = ?',
  )
    .bind(diagramId, tabId)
    .first<{ present: number }>();
  if (existing) return false;
  const count = await env.DB.prepare('SELECT COUNT(*) AS n FROM diagram_tabs WHERE diagram_id = ?')
    .bind(diagramId)
    .first<{ n: number }>();
  const orderIndex = count?.n ?? 0;
  const now = Date.now();
  await env.DB.prepare(
    `INSERT INTO diagram_tabs (diagram_id, tab_id, order_index, added_at)
     VALUES (?, ?, ?, ?)
     ON CONFLICT (diagram_id, tab_id) DO NOTHING`,
  )
    .bind(diagramId, tabId, orderIndex, now)
    .run();
  await env.DB.prepare('UPDATE diagrams SET saved_at = ? WHERE id = ?').bind(now, diagramId).run();
  return true;
}

// The link endpoint's authorisation check in one query: is this tab
// linked into at least one diagram owned by `ownerId`? Replaces the
// old "list every containing diagram id, then getDiagram() each in a
// loop" pattern (N full diagram hydrations to read one column). The
// JOIN + LIMIT 1 stops at the first owned match.
export async function tabLinkedToOwnedDiagram(
  env: Env,
  tabId: string,
  ownerId: string,
): Promise<boolean> {
  const row = await env.DB.prepare(
    `SELECT 1 AS present
       FROM diagram_tabs dt
       JOIN diagrams d ON d.id = dt.diagram_id
      WHERE dt.tab_id = ? AND d.owner_id = ?
      LIMIT 1`,
  )
    .bind(tabId, ownerId)
    .first<{ present: number }>();
  return row !== null;
}

// Look up every diagram id that links the given tab. Used by the
// link endpoint's auth check (caller must own at least one of
// them) and would also drive a future "this tab is shared with N
// diagrams" indicator.
export async function diagramsContainingTab(env: Env, tabId: string): Promise<string[]> {
  const rows = await env.DB.prepare('SELECT diagram_id FROM diagram_tabs WHERE tab_id = ?')
    .bind(tabId)
    .all<{ diagram_id: string }>();
  return (rows.results ?? []).map((r) => r.diagram_id);
}

// One position in a reorder request: the tab id plus its per-diagram
// folder (spec/30). Folder rides this path — never the per-tab content
// PUT — so a content save can't clobber membership. `null`/omitted =
// loose. A plain `string` is accepted for the legacy (pre-folder)
// payload shape and treated as loose.
export type ReorderEntry = string | { id: string; folder?: string | null };

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
// spec/13 "Risk"). Empty / whitespace folder names normalise to NULL
// so a blank folder can never persist.
export async function reorderTabs(
  env: Env,
  diagramId: string,
  entries: ReorderEntry[],
): Promise<void> {
  const now = Date.now();
  // Update the link-table order + folder alongside the legacy
  // order_index column. Phase-1 keeps both order columns in sync per
  // spec/17; folder lives only on the link (no legacy equivalent).
  const batch = entries.flatMap((entry, idx) => {
    const { id: tabId, folder } = normalizeReorderEntry(entry);
    return [
      env.DB.prepare(
        'UPDATE diagram_tabs SET order_index = ?, folder = ? WHERE diagram_id = ? AND tab_id = ?',
      ).bind(idx, folder, diagramId, tabId),
      env.DB.prepare(
        'UPDATE tabs SET order_index = ?, updated_at = ? WHERE id = ? AND diagram_id = ?',
      ).bind(idx, now, tabId, diagramId),
    ];
  });
  if (batch.length > 0) await env.DB.batch(batch);
  await env.DB.prepare('UPDATE diagrams SET saved_at = ? WHERE id = ?').bind(now, diagramId).run();
}
