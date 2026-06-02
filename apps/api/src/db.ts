import { isBoxed, type Tab } from '@livediagram/diagram';
import type { TelemetryCount } from '@livediagram/api-schema';
import { rowToChangeLog, type ChangeLogRow } from './change-log-row';
import { rowToShareLink, type ShareLinkRow } from './share-link-row';
import type {
  ChangeLogEntryDTO,
  DiagramDTO,
  DiagramSummary,
  Env,
  FolderDTO,
  ImageSummary,
  ParticipantDTO,
  ShareLinkDTO,
  ShareRole,
  TabDTO,
  TabSummaryDTO,
} from './types';

// Thin D1 wrapper. Diagrams + tabs each have their own table —
// `diagrams.data` (the legacy single-row JSON blob) was dropped in
// migration 0006. See spec/13 for the rollout that got us here.

type DiagramRow = {
  id: string;
  owner_id: string;
  name: string;
  shareable: number;
  folder_id: string | null;
  saved_at: number;
  created_at: number;
  // Derived via subquery in the SELECT; first (oldest) share_links
  // row for this diagram, or NULL when no share links exist. Replaces
  // the legacy diagrams.share_code column dropped in migration 0008.
  share_code: string | null;
};

type SummaryRow = DiagramRow;

type TabRow = {
  id: string;
  diagram_id: string;
  name: string;
  order_index: number;
  data: string;
  updated_at: number;
};

type ParticipantRow = {
  id: string;
  name: string;
  color: string;
  created_at: number;
};

function rowToTab(row: TabRow): TabDTO {
  const data = JSON.parse(row.data) as Omit<Tab, 'id' | 'name'>;
  return {
    ...data,
    id: row.id,
    name: row.name,
    diagramId: row.diagram_id,
    orderIndex: row.order_index,
    updatedAt: row.updated_at,
  };
}

function rowToTabSummary(row: TabRow): TabSummaryDTO {
  return {
    id: row.id,
    diagramId: row.diagram_id,
    name: row.name,
    orderIndex: row.order_index,
    updatedAt: row.updated_at,
  };
}

async function listTabSummariesFor(env: Env, diagramId: string): Promise<TabSummaryDTO[]> {
  // Read through the diagram_tabs link table (migration 0011 /
  // spec/17) — order_index now lives on the link, not on the tab,
  // so two diagrams that share a tab can order it independently.
  // The legacy tabs.diagram_id + tabs.order_index columns still
  // exist for one more phase as a fallback; we read the canonical
  // path here and let writes keep both in sync until they're
  // dropped in a follow-up migration.
  const result = await env.DB.prepare(
    `SELECT t.id, dt.diagram_id, t.name, dt.order_index, '' AS data, t.updated_at
       FROM diagram_tabs dt
       JOIN tabs t ON t.id = dt.tab_id
      WHERE dt.diagram_id = ?
      ORDER BY dt.order_index ASC`,
  )
    .bind(diagramId)
    .all<TabRow>();
  return (result.results ?? []).map(rowToTabSummary);
}

async function rowToDiagram(env: Env, row: DiagramRow): Promise<DiagramDTO> {
  return {
    id: row.id,
    ownerId: row.owner_id,
    name: row.name,
    tabs: await listTabSummariesFor(env, row.id),
    shareable: row.shareable === 1,
    shareCode: row.share_code,
    folderId: row.folder_id,
    savedAt: row.saved_at,
    createdAt: row.created_at,
  };
}

// Derives the primary share code via a correlated subquery on
// share_links. ORDER BY created_at ASC + LIMIT 1 keeps the result
// stable across calls; "primary" is the oldest link the owner has
// minted for the diagram.
const SHARE_CODE_EXPR =
  '(SELECT code FROM share_links WHERE share_links.diagram_id = diagrams.id ORDER BY created_at ASC LIMIT 1) AS share_code';
const DIAGRAM_COLS = `id, owner_id, name, shareable, folder_id, saved_at, created_at, ${SHARE_CODE_EXPR}`;
const DIAGRAM_SUMMARY_COLS = DIAGRAM_COLS;

export async function getDiagram(env: Env, id: string): Promise<DiagramDTO | null> {
  const row = await env.DB.prepare(`SELECT ${DIAGRAM_COLS} FROM diagrams WHERE id = ?`)
    .bind(id)
    .first<DiagramRow>();
  return row ? rowToDiagram(env, row) : null;
}

export async function getDiagramByShareCode(env: Env, code: string): Promise<DiagramDTO | null> {
  // Resolve through share_links exclusively now that the legacy
  // diagrams.share_code column is gone (migration 0008). Only
  // diagrams that are still shareable surface — revoking the last
  // link flips that flag off.
  const row = await env.DB.prepare(
    `SELECT ${DIAGRAM_COLS}
       FROM diagrams
       WHERE shareable = 1
         AND id = (SELECT diagram_id FROM share_links WHERE code = ?)`,
  )
    .bind(code)
    .first<DiagramRow>();
  return row ? rowToDiagram(env, row) : null;
}

export async function listDiagramsByOwner(env: Env, ownerId: string): Promise<DiagramSummary[]> {
  const result = await env.DB.prepare(
    `SELECT ${DIAGRAM_SUMMARY_COLS} FROM diagrams WHERE owner_id = ? ORDER BY saved_at DESC`,
  )
    .bind(ownerId)
    .all<SummaryRow>();
  return (result.results ?? []).map((row) => ({
    id: row.id,
    ownerId: row.owner_id,
    name: row.name,
    shareable: row.shareable === 1,
    shareCode: row.share_code,
    folderId: row.folder_id,
    savedAt: row.saved_at,
    createdAt: row.created_at,
  }));
}

// Metadata upsert only — diagram name, sharing state, owner id, and
// timestamps. Tabs live in their own table now (see upsertTab /
// reorderTabs / deleteTab). Used both by the new metadata-only PUT
// /diagrams/:id and by the create endpoint.
export async function upsertDiagramMeta(env: Env, d: Omit<DiagramDTO, 'tabs'>): Promise<void> {
  // `shareCode` is intentionally absent from the INSERT — it now
  // lives only in share_links. The DTO field is read-only (derived
  // via subquery on selects).
  await env.DB.prepare(
    `INSERT INTO diagrams (id, owner_id, name, shareable, folder_id, saved_at, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET
       owner_id = excluded.owner_id,
       name = excluded.name,
       saved_at = excluded.saved_at`,
  )
    .bind(d.id, d.ownerId, d.name, d.shareable ? 1 : 0, d.folderId, d.savedAt, d.createdAt)
    .run();
}

export async function setDiagramFolder(
  env: Env,
  id: string,
  folderId: string | null,
): Promise<void> {
  await env.DB.prepare('UPDATE diagrams SET folder_id = ? WHERE id = ?').bind(folderId, id).run();
}

// --- Tabs (one row per tab) ----------------------------------------------

export async function getTab(env: Env, diagramId: string, tabId: string): Promise<TabDTO | null> {
  // Resolve via the diagram_tabs link table (spec/17) so linked
  // tabs surface from every diagram that contains them, not just
  // the legacy tabs.diagram_id column (which points only at the
  // tab's original diagram). The link table also carries the
  // per-diagram order_index, so the returned summary's position
  // is correct for whichever diagram the caller asked about.
  const row = await env.DB.prepare(
    `SELECT t.id, dt.diagram_id, t.name, dt.order_index, t.data, t.updated_at
       FROM tabs t
       JOIN diagram_tabs dt ON dt.tab_id = t.id
      WHERE t.id = ? AND dt.diagram_id = ?`,
  )
    .bind(tabId, diagramId)
    .first<TabRow>();
  return row ? rowToTab(row) : null;
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
  await env.DB.prepare(
    `INSERT INTO tabs (id, diagram_id, name, order_index, data, updated_at)
     VALUES (?, ?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET
       name = excluded.name,
       order_index = excluded.order_index,
       data = excluded.data,
       updated_at = excluded.updated_at`,
  )
    .bind(id, diagramId, name, orderIndex, data, now)
    .run();
  await env.DB.prepare(
    `INSERT INTO diagram_tabs (diagram_id, tab_id, order_index, added_at)
     VALUES (?, ?, ?, ?)
     ON CONFLICT (diagram_id, tab_id) DO UPDATE SET order_index = excluded.order_index`,
  )
    .bind(diagramId, id, orderIndex, now)
    .run();
  // Bump the diagram's saved_at so the Explorer's "Updated X ago"
  // line stays accurate. Pure metadata write — no element JSON.
  await env.DB.prepare('UPDATE diagrams SET saved_at = ? WHERE id = ?').bind(now, diagramId).run();
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

// Update tab order. Caller passes the ids in their new positions; we
// rewrite every order_index in one batch. Cheap given the < 20-tab
// scale we see in practice (see spec/13 "Risk").
export async function reorderTabs(env: Env, diagramId: string, tabIds: string[]): Promise<void> {
  const now = Date.now();
  // Update the link-table order alongside the legacy column.
  // Phase-1 keeps both in sync per spec/17.
  const batch = tabIds.flatMap((tabId, idx) => [
    env.DB.prepare(
      'UPDATE diagram_tabs SET order_index = ? WHERE diagram_id = ? AND tab_id = ?',
    ).bind(idx, diagramId, tabId),
    env.DB.prepare(
      'UPDATE tabs SET order_index = ?, updated_at = ? WHERE id = ? AND diagram_id = ?',
    ).bind(idx, now, tabId, diagramId),
  ]);
  if (batch.length > 0) await env.DB.batch(batch);
  await env.DB.prepare('UPDATE diagrams SET saved_at = ? WHERE id = ?').bind(now, diagramId).run();
}

// Toggle the shareable flag on a diagram. The actual codes live in
// share_links (managed by createShareLink / deleteShareLink); this
// helper only flips the boolean that gates the realtime room + the
// share-code resolver.
export async function setDiagramShare(env: Env, id: string, shareable: boolean): Promise<void> {
  await env.DB.prepare('UPDATE diagrams SET shareable = ? WHERE id = ?')
    .bind(shareable ? 1 : 0, id)
    .run();
}

export async function deleteDiagram(env: Env, id: string): Promise<void> {
  await env.DB.prepare('DELETE FROM diagrams WHERE id = ?').bind(id).run();
}

// "Copy this diagram to my own files" — duplicates the source diagram
// under a brand-new id owned by `newOwnerId`. Carries the diagram
// meta (name with "Copy of " prefix unless the caller overrides) and
// every tab's content; deliberately does NOT copy share_links,
// change_log, or the shareable flag. The new diagram starts private
// + audit-free so the visitor's copy reads as their own clean
// workspace, not a clone of the host's collab history.
//
// Caller is expected to have already authorised the copy (the index
// handler checks ownership / share_code / shared_with). This helper
// just performs the write.
export async function copyDiagram(
  env: Env,
  sourceId: string,
  newId: string,
  newOwnerId: string,
  newName: string,
): Promise<DiagramDTO | null> {
  const source = await getDiagram(env, sourceId);
  if (!source) return null;
  const now = Date.now();
  await env.DB.prepare(
    `INSERT INTO diagrams (id, owner_id, name, shareable, folder_id, saved_at, created_at)
     VALUES (?, ?, ?, 0, NULL, ?, ?)`,
  )
    .bind(newId, newOwnerId, newName, now, now)
    .run();
  // Walk the source's tab rows via the link table and re-insert
  // each under the new diagram id with a freshly minted tab id.
  // Preserves order_index verbatim so the cloned diagram opens to
  // the same tab layout the visitor was looking at. Skipping
  // share_links + change_log is by design — those don't survive
  // ownership transfer. Copy semantics (vs link semantics, spec/17)
  // are deliberate: edits to the copy stay isolated from the source.
  const tabRows = await env.DB.prepare(
    `SELECT t.id, t.name, dt.order_index, t.data
       FROM diagram_tabs dt
       JOIN tabs t ON t.id = dt.tab_id
      WHERE dt.diagram_id = ?
      ORDER BY dt.order_index ASC`,
  )
    .bind(sourceId)
    .all<{ id: string; name: string; order_index: number; data: string }>();
  for (const row of tabRows.results ?? []) {
    const freshTabId = crypto.randomUUID();
    await env.DB.prepare(
      `INSERT INTO tabs (id, diagram_id, name, order_index, data, updated_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
    )
      .bind(freshTabId, newId, row.name, row.order_index, row.data, now)
      .run();
    await env.DB.prepare(
      `INSERT INTO diagram_tabs (diagram_id, tab_id, order_index, added_at)
       VALUES (?, ?, ?, ?)`,
    )
      .bind(newId, freshTabId, row.order_index, now)
      .run();
  }
  return await getDiagram(env, newId);
}

export async function getParticipant(env: Env, id: string): Promise<ParticipantDTO | null> {
  const row = await env.DB.prepare(
    'SELECT id, name, color, created_at FROM participants WHERE id = ?',
  )
    .bind(id)
    .first<ParticipantRow>();
  return row ? { id: row.id, name: row.name, color: row.color, createdAt: row.created_at } : null;
}

export async function upsertParticipant(env: Env, p: ParticipantDTO): Promise<void> {
  await env.DB.prepare(
    `INSERT INTO participants (id, name, color, created_at)
     VALUES (?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET
       name = excluded.name,
       color = excluded.color`,
  )
    .bind(p.id, p.name, p.color, p.createdAt)
    .run();
}

// Short, URL-safe alphabet. Avoids visually ambiguous characters
// (0/O/1/I/l) so the share codes are easy to read aloud or transcribe.
const SHARE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

export function generateShareCode(length = 8): string {
  let code = '';
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  for (const byte of bytes) {
    code += SHARE_ALPHABET[byte % SHARE_ALPHABET.length];
  }
  return code;
}

// ---------------------------------------------------------------------
// share_links (per-diagram, per-role short codes, migration 0003).
// Row shape + role normalisation live in share-link-row.ts so the
// defensive mapper has its own test surface.
// ---------------------------------------------------------------------

export async function listShareLinks(env: Env, diagramId: string): Promise<ShareLinkDTO[]> {
  const result = await env.DB.prepare(
    'SELECT code, diagram_id, role, created_at FROM share_links WHERE diagram_id = ? ORDER BY created_at ASC',
  )
    .bind(diagramId)
    .all<ShareLinkRow>();
  return (result.results ?? []).map(rowToShareLink);
}

export async function getShareLink(env: Env, code: string): Promise<ShareLinkDTO | null> {
  const row = await env.DB.prepare(
    'SELECT code, diagram_id, role, created_at FROM share_links WHERE code = ?',
  )
    .bind(code)
    .first<ShareLinkRow>();
  return row ? rowToShareLink(row) : null;
}

export async function createShareLink(
  env: Env,
  diagramId: string,
  code: string,
  role: ShareRole,
): Promise<ShareLinkDTO> {
  const createdAt = Date.now();
  await env.DB.prepare(
    'INSERT INTO share_links (code, diagram_id, role, created_at) VALUES (?, ?, ?, ?)',
  )
    .bind(code, diagramId, role, createdAt)
    .run();
  // Flip the shareable flag on so the realtime room opens + the
  // share-code resolver picks the diagram up. The "primary" code is
  // derived from share_links on read, so no column to update.
  await env.DB.prepare('UPDATE diagrams SET shareable = 1 WHERE id = ?').bind(diagramId).run();
  return { code, diagramId, role, createdAt };
}

export async function deleteShareLink(env: Env, code: string): Promise<void> {
  const existing = await getShareLink(env, code);
  if (!existing) return;
  await env.DB.prepare('DELETE FROM share_links WHERE code = ?').bind(code).run();
  // If this was the last link for the diagram, flip shareable off so
  // the live app stops opening the realtime room. The primary code
  // is derived on read; no column to repoint.
  const remaining = await env.DB.prepare(
    'SELECT COUNT(*) AS n FROM share_links WHERE diagram_id = ?',
  )
    .bind(existing.diagramId)
    .first<{ n: number }>();
  if (!remaining || remaining.n === 0) {
    await env.DB.prepare('UPDATE diagrams SET shareable = 0 WHERE id = ?')
      .bind(existing.diagramId)
      .run();
  }
}

// ---------------------------------------------------------------------
// shared_with — "shared with you" tracking (migration 0010)
// ---------------------------------------------------------------------

// Record a visitor's access to a shared diagram. Idempotent on
// (owner_id, diagram_id): repeat visits just bump last_seen + role.
// Caller is expected to only invoke this when the visitor's resolved
// owner differs from the diagram's owner (an owner opening their own
// diagram via a share link shouldn't show up in their own
// "Shared with you" list).
export async function recordSharedAccess(
  env: Env,
  ownerId: string,
  diagramId: string,
  role: ShareRole,
): Promise<void> {
  const now = Date.now();
  await env.DB.prepare(
    `INSERT INTO shared_with (owner_id, diagram_id, role, last_seen) VALUES (?, ?, ?, ?)
       ON CONFLICT (owner_id, diagram_id) DO UPDATE SET role = excluded.role, last_seen = excluded.last_seen`,
  )
    .bind(ownerId, diagramId, role, now)
    .run();
}

// List diagrams shared with this owner, newest interaction first.
// Joins through `diagrams` for the name + owner-side savedAt; also
// surfaces a still-live `shareCode` for each row so the client can
// build a `/live/diagram/<id>?s=<code>` URL the visitor can actually
// open. Without the code the Shared list link would land on the
// owner-only `/api/diagrams/:id` path and 404 every time.
//
// The shareCode is sourced via a correlated subquery against
// share_links matching the same role the visitor was granted —
// preferring the oldest still-alive code (matches the "primary
// code" convention used everywhere else). Rows whose share has
// been entirely revoked since the visit (no code left at the
// matching role, or shareable flipped off) are filtered out so the
// visitor doesn't see a list item they can't act on.
export async function listSharedWith(
  env: Env,
  ownerId: string,
): Promise<
  {
    id: string;
    name: string;
    savedAt: number;
    role: ShareRole;
    shareCode: string;
    ownerName: string | null;
    ownerColor: string | null;
  }[]
> {
  const res = await env.DB.prepare(
    `SELECT d.id, d.name, d.saved_at, s.role,
            (SELECT code
               FROM share_links
              WHERE share_links.diagram_id = d.id
                AND share_links.role = s.role
              ORDER BY share_links.created_at ASC
              LIMIT 1) AS share_code,
            p.name  AS owner_name,
            p.color AS owner_color
       FROM shared_with s
       JOIN diagrams d ON d.id = s.diagram_id
       LEFT JOIN participants p ON p.id = d.owner_id
      WHERE s.owner_id = ?
        AND d.shareable = 1
      ORDER BY s.last_seen DESC`,
  )
    .bind(ownerId)
    .all<{
      id: string;
      name: string;
      saved_at: number;
      role: ShareRole;
      share_code: string | null;
      owner_name: string | null;
      owner_color: string | null;
    }>();
  return (res.results ?? [])
    .filter((r) => r.share_code !== null)
    .map((r) => ({
      id: r.id,
      name: r.name,
      savedAt: r.saved_at,
      role: r.role,
      shareCode: r.share_code as string,
      ownerName: r.owner_name,
      ownerColor: r.owner_color,
    }));
}

// Drop a single "shared with you" reference — used when the visitor
// dismisses a row from their Shared list (they don't want it
// showing up any more) or when the diagram's been duplicated into
// the visitor's own files (#9) so the shared reference is no longer
// useful.
export async function dropSharedAccess(
  env: Env,
  ownerId: string,
  diagramId: string,
): Promise<void> {
  await env.DB.prepare('DELETE FROM shared_with WHERE owner_id = ? AND diagram_id = ?')
    .bind(ownerId, diagramId)
    .run();
}

// ---------------------------------------------------------------------
// change_log (per-diagram audit log, migration 0004). Row shape and
// the denormalisation fallback live in change-log-row.ts (so the
// pure mapper has its own test surface); D1 queries here use them.

// 200 entries is plenty to drive the Activity Panel's scrolling list
// while keeping the response small. Older entries stay in D1 for
// audit completeness; the V1 UI just doesn't surface them.
const CHANGE_LOG_LIST_LIMIT = 30;

// Per-diagram log read: change_log.diagram_id was dropped in
// migration 0012 (item #14), so the filter joins through
// diagram_tabs to find every tab currently linked to the diagram
// and pulls log entries for those tabs. A tab shared between
// diagrams surfaces in both diagrams' logs — which is the right
// answer once spec/17's many-to-many tabs land: the change exists
// in every diagram it shows up in.
export async function listChangeLog(env: Env, diagramId: string): Promise<ChangeLogEntryDTO[]> {
  // LEFT JOIN through participants so rows whose author has been
  // deleted (account delete) still surface, with a fallback name
  // and colour from rowToChangeLog. Inner join would silently hide
  // those entries.
  const result = await env.DB.prepare(
    `SELECT cl.id, cl.tab_id, cl.participant_id,
            p.name  AS participant_name,
            p.color AS participant_color,
            cl.kind, cl.summary, cl.element_ids, cl.before_state, cl.after_state, cl.created_at
       FROM change_log cl
       JOIN diagram_tabs dt ON dt.tab_id = cl.tab_id
       LEFT JOIN participants p ON p.id = cl.participant_id
      WHERE dt.diagram_id = ?
      ORDER BY cl.created_at DESC
      LIMIT ?`,
  )
    .bind(diagramId, CHANGE_LOG_LIST_LIMIT)
    .all<ChangeLogRow>();
  return (result.results ?? []).map(rowToChangeLog);
}

export async function insertChangeLogEntry(env: Env, entry: ChangeLogEntryDTO): Promise<void> {
  // Post-migration 0013: participant_name + _color columns are gone.
  // The DTO still carries them so the WebSocket op + UI can keep
  // showing the author cheaply — we just don't write them to D1.
  await env.DB.prepare(
    `INSERT INTO change_log (
       id, tab_id, participant_id,
       kind, summary, element_ids, before_state, after_state, created_at
     )
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  )
    .bind(
      entry.id,
      entry.tabId,
      entry.participantId,
      entry.kind,
      entry.summary,
      JSON.stringify(entry.elementIds),
      JSON.stringify(entry.beforeState),
      JSON.stringify(entry.afterState),
      entry.createdAt,
    )
    .run();
}

// Bulk-drop every log entry for a tab. Used by the live app when it
// deletes a tab — the tab no longer exists, its history is dead with
// it. See specs/12-activity-and-audit.md. Post #14 the diagram-side
// filter is gone (the column was dropped); the tab_id alone keys
// the delete.
export async function deleteChangeLogForTab(env: Env, tabId: string): Promise<void> {
  await env.DB.prepare('DELETE FROM change_log WHERE tab_id = ?').bind(tabId).run();
}

// Drop a single log entry. Used by the live app when the user clicks
// Revert — the original entry vanishes rather than gaining a
// 'reverted' counterpart, so the log stays compact.
export async function deleteChangeLogEntry(env: Env, entryId: string): Promise<void> {
  await env.DB.prepare('DELETE FROM change_log WHERE id = ?').bind(entryId).run();
}

// 90-day retention sweep — fired from the scheduled handler (item
// #16 / spec/12). The Activity Panel only ever surfaces the most
// recent CHANGE_LOG_LIST_LIMIT entries, so anything older than the
// retention window has been invisible since the day it landed.
// Keeping it around forever was a slow leak.
//
// Returns the row count deleted so the scheduled handler can log
// it for observability.
export async function deleteOldChangeLogEntries(env: Env, cutoffMs: number): Promise<number> {
  const result = await env.DB.prepare('DELETE FROM change_log WHERE created_at < ?')
    .bind(cutoffMs)
    .run();
  return result.meta.changes ?? 0;
}

// ---------------------------------------------------------------------
// folders — owner-scoped, self-referential tree. See spec/15-folders.md.
// ---------------------------------------------------------------------

type FolderRow = {
  id: string;
  owner_id: string;
  parent_id: string | null;
  name: string;
  created_at: number;
  updated_at: number;
};

function rowToFolder(row: FolderRow): FolderDTO {
  return {
    id: row.id,
    ownerId: row.owner_id,
    parentId: row.parent_id,
    name: row.name,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

const FOLDER_COLS = 'id, owner_id, parent_id, name, created_at, updated_at';

export async function listFoldersByOwner(env: Env, ownerId: string): Promise<FolderDTO[]> {
  const result = await env.DB.prepare(
    `SELECT ${FOLDER_COLS} FROM folders WHERE owner_id = ? ORDER BY name ASC`,
  )
    .bind(ownerId)
    .all<FolderRow>();
  return (result.results ?? []).map(rowToFolder);
}

export async function getFolder(env: Env, id: string): Promise<FolderDTO | null> {
  const row = await env.DB.prepare(`SELECT ${FOLDER_COLS} FROM folders WHERE id = ?`)
    .bind(id)
    .first<FolderRow>();
  return row ? rowToFolder(row) : null;
}

export async function createFolder(
  env: Env,
  f: { id: string; ownerId: string; parentId: string | null; name: string },
): Promise<FolderDTO> {
  const now = Date.now();
  await env.DB.prepare(
    `INSERT INTO folders (id, owner_id, parent_id, name, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
  )
    .bind(f.id, f.ownerId, f.parentId, f.name, now, now)
    .run();
  return {
    id: f.id,
    ownerId: f.ownerId,
    parentId: f.parentId,
    name: f.name,
    createdAt: now,
    updatedAt: now,
  };
}

export async function updateFolder(
  env: Env,
  id: string,
  patch: { name?: string; parentId?: string | null },
): Promise<void> {
  const now = Date.now();
  // Build a partial UPDATE so we never accidentally clear a column the
  // caller didn't touch. `name` and `parentId` are both legal so we
  // can't merge them into one statement without losing the
  // "undefined = leave alone" semantic.
  if (patch.name !== undefined) {
    await env.DB.prepare('UPDATE folders SET name = ?, updated_at = ? WHERE id = ?')
      .bind(patch.name, now, id)
      .run();
  }
  if (patch.parentId !== undefined) {
    await env.DB.prepare('UPDATE folders SET parent_id = ?, updated_at = ? WHERE id = ?')
      .bind(patch.parentId, now, id)
      .run();
  }
}

export async function deleteFolder(env: Env, id: string): Promise<void> {
  // Promote direct children before deleting: subfolders become root,
  // diagrams fall to Unsorted. ON DELETE SET NULL on both FKs would
  // do the same thing, but we run it explicitly so the behaviour is
  // visible in code (and not dependent on SQLite enforcing the FK,
  // which is opt-in via PRAGMA).
  await env.DB.prepare('UPDATE folders SET parent_id = NULL WHERE parent_id = ?').bind(id).run();
  await env.DB.prepare('UPDATE diagrams SET folder_id = NULL WHERE folder_id = ?').bind(id).run();
  await env.DB.prepare('DELETE FROM folders WHERE id = ?').bind(id).run();
}

// Cycle check for folder moves. Walks the proposed ancestor chain
// from `newParentId` upward; if we hit `folderId` along the way the
// move would form a cycle. Caller rejects with a 409 in that case.
export async function folderMoveWouldCycle(
  env: Env,
  folderId: string,
  newParentId: string,
): Promise<boolean> {
  let cursor: string | null = newParentId;
  const seen = new Set<string>();
  while (cursor !== null) {
    const here: string = cursor;
    if (here === folderId) return true;
    if (seen.has(here)) return true; // defensive — corrupt graph
    seen.add(here);
    const row = await env.DB.prepare('SELECT parent_id FROM folders WHERE id = ?')
      .bind(here)
      .first<{ parent_id: string | null }>();
    cursor = row?.parent_id ?? null;
  }
  return false;
}

// Wipe every row belonging to a given owner: diagrams, folders, the
// participant record, AND the R2 image bytes (spec/19). Called from
// DELETE /api/account when the user opts in via the "Delete account"
// dialog. Cascade rules take care of dependent D1 tables: `tabs`,
// `share_links`, and `change_log` all FK to `diagrams.id` with ON
// DELETE CASCADE (migrations 0003 / 0004 / 0005), so removing the
// diagrams rows also drops the per-diagram tab content, share links,
// and audit trail. Folders carry their own owner_id and need their
// own DELETE. Participants are owner-less in the schema but their id
// IS the owner id, so a single id-match delete clears the display-
// name / colour row too. Images carry owner_id on their D1 row and
// the R2 object key matches the row id, so we enumerate before the
// D1 wipe + bulk-delete from R2 + then drop the rows.
//
// Returns `{ diagrams, folders, images }` change counts for the
// audit log. Idempotent: re-running with the same owner id is a
// no-op once the rows are gone.
export async function deleteAccount(
  env: Env,
  ownerId: string,
): Promise<{ diagrams: number; folders: number; images: number }> {
  // R2 cleanup first. Enumerate the owner's image ids while the
  // index row still exists, then delete each from R2. If R2 is
  // unbound (self-host without R2), skip silently: the index rows
  // come out via the DELETE FROM images below regardless. R2's
  // batch delete takes up to 1000 keys per call which is well
  // above any realistic per-owner gallery cap.
  const imageRows = await env.DB.prepare('SELECT id FROM images WHERE owner_id = ?')
    .bind(ownerId)
    .all<{ id: string }>();
  const imageIds = (imageRows.results ?? []).map((r) => r.id);
  if (env.IMAGES && imageIds.length > 0) {
    await env.IMAGES.delete(imageIds);
  }
  const imagesRes = await env.DB.prepare('DELETE FROM images WHERE owner_id = ?')
    .bind(ownerId)
    .run();
  const diagramsRes = await env.DB.prepare('DELETE FROM diagrams WHERE owner_id = ?')
    .bind(ownerId)
    .run();
  const foldersRes = await env.DB.prepare('DELETE FROM folders WHERE owner_id = ?')
    .bind(ownerId)
    .run();
  await env.DB.prepare('DELETE FROM participants WHERE id = ?').bind(ownerId).run();
  return {
    diagrams: diagramsRes.meta.changes ?? 0,
    folders: foldersRes.meta.changes ?? 0,
    images: imagesRes.meta.changes ?? 0,
  };
}

// Owner-id migration. Reassigns every `diagrams.owner_id`,
// `folders.owner_id`, AND `shared_with.owner_id` row from
// `fromOwnerId` to `toOwnerId`. Called from POST /api/migrate when
// a guest signs up: their localStorage participant id moves to
// their Clerk userId so the new account sees the diagrams +
// folders they built as a guest AND the shared-with-them list
// they accumulated by accepting share links.
//
// shared_with's primary key is (owner_id, diagram_id), so a naive
// UPDATE could PK-collide if the visitor accepted the same share
// link both as a guest AND, later in the same session, as Clerk
// (recordSharedAccess upserts a row each time). INSERT OR IGNORE
// then DELETE handles both cases in one shot: copy guest rows to
// the Clerk userId, skip rows where (clerkId, diagramId) already
// exists, then drop every leftover guest row. The skipped Clerk
// rows keep the role + last_seen they already had (which is the
// more recent of the two paths the user actually used).
//
// Other tables (`change_log`, `share_links`, `tabs`) don't carry
// their own owner_id, they link via `diagram_id` which is
// owner-bound, so updating the diagrams cascade-fixes them
// implicitly.
//
// Returns `{ diagrams, folders, shared }`. Idempotent: re-running
// with the same `fromOwnerId` is a no-op once the rows have moved.
export async function migrateOwnerId(
  env: Env,
  fromOwnerId: string,
  toOwnerId: string,
): Promise<{ diagrams: number; folders: number; shared: number }> {
  const diagramsRes = await env.DB.prepare('UPDATE diagrams SET owner_id = ? WHERE owner_id = ?')
    .bind(toOwnerId, fromOwnerId)
    .run();
  const foldersRes = await env.DB.prepare('UPDATE folders SET owner_id = ? WHERE owner_id = ?')
    .bind(toOwnerId, fromOwnerId)
    .run();
  const sharedInsertRes = await env.DB.prepare(
    `INSERT OR IGNORE INTO shared_with (owner_id, diagram_id, role, last_seen)
     SELECT ?, diagram_id, role, last_seen
     FROM shared_with
     WHERE owner_id = ?`,
  )
    .bind(toOwnerId, fromOwnerId)
    .run();
  await env.DB.prepare('DELETE FROM shared_with WHERE owner_id = ?').bind(fromOwnerId).run();
  return {
    diagrams: diagramsRes.meta.changes ?? 0,
    folders: foldersRes.meta.changes ?? 0,
    shared: sharedInsertRes.meta.changes ?? 0,
  };
}

// --- Images (spec/19) ----------------------------------------------------

type ImageRow = {
  id: string;
  owner_id: string;
  content_type: string;
  byte_size: number;
  width: number;
  height: number;
  sha256: string;
  original_name: string | null;
  created_at: number;
};

function imageRowToSummary(row: ImageRow): ImageSummary {
  return {
    id: row.id,
    contentType: row.content_type,
    byteSize: row.byte_size,
    width: row.width,
    height: row.height,
    originalName: row.original_name ?? undefined,
    createdAt: row.created_at,
  };
}

export async function listImagesByOwner(env: Env, ownerId: string): Promise<ImageSummary[]> {
  const rows = await env.DB.prepare(
    'SELECT id, owner_id, content_type, byte_size, width, height, sha256, original_name, created_at FROM images WHERE owner_id = ? ORDER BY created_at DESC',
  )
    .bind(ownerId)
    .all<ImageRow>();
  return (rows.results ?? []).map(imageRowToSummary);
}

export async function findImageBySha(
  env: Env,
  ownerId: string,
  sha256: string,
): Promise<ImageSummary | null> {
  const row = await env.DB.prepare(
    'SELECT id, owner_id, content_type, byte_size, width, height, sha256, original_name, created_at FROM images WHERE owner_id = ? AND sha256 = ?',
  )
    .bind(ownerId, sha256)
    .first<ImageRow>();
  return row ? imageRowToSummary(row) : null;
}

export async function getImage(env: Env, id: string): Promise<{ ownerId: string } | null> {
  // The byte-read endpoint resolves auth from owner_id alone, so the
  // narrow projection is intentional. The byte-payload itself comes
  // from R2; D1 is only consulted for "does this image exist + who
  // owns it".
  const row = await env.DB.prepare('SELECT owner_id FROM images WHERE id = ?')
    .bind(id)
    .first<{ owner_id: string }>();
  return row ? { ownerId: row.owner_id } : null;
}

export async function insertImage(
  env: Env,
  row: {
    id: string;
    ownerId: string;
    contentType: string;
    byteSize: number;
    width: number;
    height: number;
    sha256: string;
    originalName: string | null;
  },
): Promise<ImageSummary> {
  const createdAt = Date.now();
  await env.DB.prepare(
    'INSERT INTO images (id, owner_id, content_type, byte_size, width, height, sha256, original_name, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
  )
    .bind(
      row.id,
      row.ownerId,
      row.contentType,
      row.byteSize,
      row.width,
      row.height,
      row.sha256,
      row.originalName,
      createdAt,
    )
    .run();
  return {
    id: row.id,
    contentType: row.contentType,
    byteSize: row.byteSize,
    width: row.width,
    height: row.height,
    originalName: row.originalName ?? undefined,
    createdAt,
  };
}

export async function deleteImage(env: Env, id: string): Promise<void> {
  await env.DB.prepare('DELETE FROM images WHERE id = ?').bind(id).run();
}

// Build a map of imageId → list of the owner's diagrams that use it.
// Used by the Explorer Image Gallery so the user can spot unused
// images (empty list, safe to delete) vs. live ones (which diagrams
// would break on delete).
//
// Single pass over the owner's diagrams + their joined tabs: one
// query, then JSON-parse each tab body and walk its elements.
// O(diagrams + tabs + elements) per call, with no per-image work.
// Tabs that share an id across diagrams (per spec/17) get attributed
// to every diagram that references them, which is the user-facing
// truth.
export async function imageUsageByOwner(
  env: Env,
  ownerId: string,
): Promise<Record<string, { id: string; name: string }[]>> {
  const rows = await env.DB.prepare(
    `SELECT d.id AS diagram_id, d.name AS diagram_name, t.data AS tab_data
       FROM diagrams d
       JOIN diagram_tabs dt ON dt.diagram_id = d.id
       JOIN tabs t ON t.id = dt.tab_id
      WHERE d.owner_id = ?`,
  )
    .bind(ownerId)
    .all<{ diagram_id: string; diagram_name: string; tab_data: string }>();
  // diagramId → already-attributed image ids (avoids double-counting
  // when an image is reused across multiple tabs of one diagram, or
  // a shared tab attaches the diagram twice via the many-to-many).
  const seen = new Map<string, Set<string>>();
  const usage: Record<string, { id: string; name: string }[]> = {};
  for (const row of rows.results ?? []) {
    let tab: Tab;
    try {
      tab = JSON.parse(row.tab_data) as Tab;
    } catch {
      continue;
    }
    for (const el of tab.elements ?? []) {
      if (!isBoxed(el) || el.type !== 'image') continue;
      const imageId = (el as { imageId?: string | null }).imageId;
      if (!imageId) continue;
      let dedupe = seen.get(row.diagram_id);
      if (!dedupe) {
        dedupe = new Set();
        seen.set(row.diagram_id, dedupe);
      }
      if (dedupe.has(imageId)) continue;
      dedupe.add(imageId);
      const list = usage[imageId] ?? [];
      list.push({ id: row.diagram_id, name: row.diagram_name });
      usage[imageId] = list;
    }
  }
  return usage;
}

// Used by the byte-read endpoint to authorise share-code readers: a
// visitor with a valid X-Share-Code for diagram `d` can read image
// `id` IFF some tab on diagram `d` references that image via an
// ImageElement. Iterates the diagram's tabs and looks for the id
// in any image element. Sparse scan: most tabs have no image
// elements at all.
export async function diagramReferencesImage(
  env: Env,
  diagramId: string,
  imageId: string,
): Promise<boolean> {
  // Tabs live behind diagram_tabs (many-to-many per spec/17), so the
  // lookup joins through the link table rather than reading the
  // legacy `tabs.diagram_id` column directly.
  const rows = await env.DB.prepare(
    `SELECT t.data
       FROM diagram_tabs dt
       JOIN tabs t ON t.id = dt.tab_id
      WHERE dt.diagram_id = ?`,
  )
    .bind(diagramId)
    .all<{ data: string }>();
  for (const row of rows.results ?? []) {
    try {
      const tab = JSON.parse(row.data) as Tab;
      for (const el of tab.elements ?? []) {
        if (
          isBoxed(el) &&
          el.type === 'image' &&
          (el as { imageId?: string | null }).imageId === imageId
        ) {
          return true;
        }
      }
    } catch {
      // Malformed JSON in a tab row is its own bug; for the auth
      // check we conservatively treat unparseable tabs as having
      // no image references rather than throwing the request away.
      continue;
    }
  }
  return false;
}

// --- Telemetry (spec/22) ---------------------------------------------
// Anonymous events: the events table stores only the three-field
// vocabulary + a server-stamped timestamp. No owner / IP column.

export async function insertTelemetryEvents(
  env: Env,
  events: { category: string; action: string; type: string | null }[],
  ts: number,
): Promise<void> {
  if (events.length === 0) return;
  const stmt = env.DB.prepare(
    'INSERT INTO events (category, action, type, ts) VALUES (?, ?, ?, ?)',
  );
  await env.DB.batch(events.map((e) => stmt.bind(e.category, e.action, e.type, ts)));
}

// Retention sweep: drop rows older than `cutoffMs`. Wired to the
// daily 03:00 UTC cron via the worker's `scheduled` handler, with a
// 60-day floor (twice the dashboard's longest window, see spec/22
// "Retention"). The events_ts_idx supports the range scan. Returns
// the row count deleted so the handler can log it for observability,
// mirroring `deleteOldChangeLogEntries`.
export async function deleteOldEvents(env: Env, cutoffMs: number): Promise<number> {
  const result = await env.DB.prepare('DELETE FROM events WHERE ts < ?').bind(cutoffMs).run();
  return result.meta.changes ?? 0;
}

// Per-day per-category counts since `since`, used to render the
// dashboard's daily-volume sparkline + the per-category stacked
// area chart. SQLite's date() with the 'unixepoch' modifier
// produces YYYY-MM-DD which is naturally sortable; we re-bucket
// into the caller's 30-day array client-side rather than in SQL so
// missing-day rows (zero events) still show up as zero rather than
// being dropped. The events_ts_idx covers the range filter.
export async function telemetryDailyCountsSince(
  env: Env,
  since: number,
): Promise<{ day: string; category: string; count: number }[]> {
  const result = await env.DB.prepare(
    `SELECT date(ts / 1000, 'unixepoch') AS day, category, COUNT(*) AS count
       FROM events
      WHERE ts >= ?
      GROUP BY day, category
      ORDER BY day ASC`,
  )
    .bind(since)
    .all<{ day: string; category: string; count: number }>();
  return result.results ?? [];
}

// Grouped counts for every event at or after `since` (ms epoch). One
// row per (category, action, type). Drives the dashboard's fixed
// windows; the events_ts_idx covers the range filter.
export async function telemetryCountsSince(env: Env, since: number): Promise<TelemetryCount[]> {
  const result = await env.DB.prepare(
    `SELECT category, action, type, COUNT(*) AS count
       FROM events
      WHERE ts >= ?
      GROUP BY category, action, type
      ORDER BY count DESC`,
  )
    .bind(since)
    .all<TelemetryCount>();
  return result.results ?? [];
}
