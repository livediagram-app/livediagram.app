import type { Tab } from '@livediagram/diagram';
import type {
  ChangeLogEntryDTO,
  ChangeLogKind,
  DiagramDTO,
  DiagramSummary,
  Env,
  FolderDTO,
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
  const result = await env.DB.prepare(
    `SELECT id, diagram_id, name, order_index, '' AS data, updated_at
       FROM tabs WHERE diagram_id = ? ORDER BY order_index ASC`,
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

const TAB_COLS = 'id, diagram_id, name, order_index, data, updated_at';

export async function getTab(env: Env, diagramId: string, tabId: string): Promise<TabDTO | null> {
  const row = await env.DB.prepare(`SELECT ${TAB_COLS} FROM tabs WHERE id = ? AND diagram_id = ?`)
    .bind(tabId, diagramId)
    .first<TabRow>();
  return row ? rowToTab(row) : null;
}

export async function listTabSummaries(env: Env, diagramId: string): Promise<TabSummaryDTO[]> {
  return listTabSummariesFor(env, diagramId);
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
  // Bump the diagram's saved_at so the Explorer's "Updated X ago"
  // line stays accurate. Pure metadata write — no element JSON.
  await env.DB.prepare('UPDATE diagrams SET saved_at = ? WHERE id = ?').bind(now, diagramId).run();
}

export async function deleteTabRow(env: Env, diagramId: string, tabId: string): Promise<void> {
  await env.DB.prepare('DELETE FROM tabs WHERE id = ? AND diagram_id = ?')
    .bind(tabId, diagramId)
    .run();
}

// Update tab order. Caller passes the ids in their new positions; we
// rewrite every order_index in one batch. Cheap given the < 20-tab
// scale we see in practice (see spec/13 "Risk").
export async function reorderTabs(env: Env, diagramId: string, tabIds: string[]): Promise<void> {
  const now = Date.now();
  const batch = tabIds.map((tabId, idx) =>
    env.DB.prepare(
      'UPDATE tabs SET order_index = ?, updated_at = ? WHERE id = ? AND diagram_id = ?',
    ).bind(idx, now, tabId, diagramId),
  );
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
// share_links — per-diagram, per-role short codes (migration 0003)
// ---------------------------------------------------------------------

type ShareLinkRow = {
  code: string;
  diagram_id: string;
  role: string;
  created_at: number;
};

function rowToShareLink(row: ShareLinkRow): ShareLinkDTO {
  return {
    code: row.code,
    diagramId: row.diagram_id,
    role: row.role === 'view' ? 'view' : 'edit',
    createdAt: row.created_at,
  };
}

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
// Joins through `diagrams` to surface the diagram name + owner-side
// savedAt, plus the role the visitor was granted. Skips any rows
// whose diagram has since been deleted (ON DELETE CASCADE keeps the
// table consistent, but the join guards against a still-rare race
// where the diagram is gone but the cascade hasn't fired yet).
export async function listSharedWith(
  env: Env,
  ownerId: string,
): Promise<{ id: string; name: string; savedAt: number; role: ShareRole }[]> {
  const res = await env.DB.prepare(
    `SELECT d.id, d.name, d.saved_at, s.role, s.last_seen
       FROM shared_with s
       JOIN diagrams d ON d.id = s.diagram_id
      WHERE s.owner_id = ?
      ORDER BY s.last_seen DESC`,
  )
    .bind(ownerId)
    .all<{ id: string; name: string; saved_at: number; role: ShareRole; last_seen: number }>();
  return (res.results ?? []).map((r) => ({
    id: r.id,
    name: r.name,
    savedAt: r.saved_at,
    role: r.role,
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
// change_log — per-diagram audit log (migration 0004)
// ---------------------------------------------------------------------

type ChangeLogRow = {
  id: string;
  diagram_id: string;
  tab_id: string | null;
  participant_id: string;
  participant_name: string;
  participant_color: string;
  kind: string;
  summary: string;
  element_ids: string;
  before_state: string;
  after_state: string;
  created_at: number;
};

function rowToChangeLog(row: ChangeLogRow): ChangeLogEntryDTO {
  return {
    id: row.id,
    diagramId: row.diagram_id,
    tabId: row.tab_id,
    participantId: row.participant_id,
    participantName: row.participant_name,
    participantColor: row.participant_color,
    kind: (row.kind as ChangeLogKind) ?? 'edit',
    summary: row.summary,
    elementIds: JSON.parse(row.element_ids),
    beforeState: JSON.parse(row.before_state),
    afterState: JSON.parse(row.after_state),
    createdAt: row.created_at,
  };
}

// 200 entries is plenty to drive the Activity Panel's scrolling list
// while keeping the response small. Older entries stay in D1 for
// audit completeness; the V1 UI just doesn't surface them.
const CHANGE_LOG_LIST_LIMIT = 30;

export async function listChangeLog(env: Env, diagramId: string): Promise<ChangeLogEntryDTO[]> {
  const result = await env.DB.prepare(
    `SELECT id, diagram_id, tab_id, participant_id, participant_name, participant_color,
            kind, summary, element_ids, before_state, after_state, created_at
       FROM change_log
      WHERE diagram_id = ?
      ORDER BY created_at DESC
      LIMIT ?`,
  )
    .bind(diagramId, CHANGE_LOG_LIST_LIMIT)
    .all<ChangeLogRow>();
  return (result.results ?? []).map(rowToChangeLog);
}

export async function insertChangeLogEntry(env: Env, entry: ChangeLogEntryDTO): Promise<void> {
  await env.DB.prepare(
    `INSERT INTO change_log (
       id, diagram_id, tab_id, participant_id, participant_name, participant_color,
       kind, summary, element_ids, before_state, after_state, created_at
     )
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  )
    .bind(
      entry.id,
      entry.diagramId,
      entry.tabId,
      entry.participantId,
      entry.participantName,
      entry.participantColor,
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
// it. See specs/12-activity-and-audit.md.
export async function deleteChangeLogForTab(
  env: Env,
  diagramId: string,
  tabId: string,
): Promise<void> {
  await env.DB.prepare('DELETE FROM change_log WHERE diagram_id = ? AND tab_id = ?')
    .bind(diagramId, tabId)
    .run();
}

// Drop a single log entry. Used by the live app when the user clicks
// Revert — the original entry vanishes rather than gaining a
// 'reverted' counterpart, so the log stays compact.
export async function deleteChangeLogEntry(
  env: Env,
  diagramId: string,
  entryId: string,
): Promise<void> {
  await env.DB.prepare('DELETE FROM change_log WHERE diagram_id = ? AND id = ?')
    .bind(diagramId, entryId)
    .run();
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

// Wipe every row belonging to a given owner — diagrams, folders,
// and the participant record. Called from DELETE /api/account when
// the user opts in via the "Delete account" dialog. Cascade rules
// take care of the dependent tables: `tabs`, `share_links`, and
// `change_log` all FK to `diagrams.id` with ON DELETE CASCADE
// (migrations 0003 / 0004 / 0005), so removing the diagrams rows
// also drops the per-diagram tab content, share links, and audit
// trail. Folders carry their own owner_id and need their own
// DELETE. Participants are owner-less in the schema but their id
// IS the owner id, so a single id-match delete clears the
// display-name / colour row too.
//
// Returns `{ diagrams, folders }` change counts for the audit log.
// Idempotent — re-running with the same owner id is a no-op once
// the rows are gone.
export async function deleteAccount(
  env: Env,
  ownerId: string,
): Promise<{ diagrams: number; folders: number }> {
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
  };
}

// Owner-id migration. Reassigns every `diagrams.owner_id` and
// `folders.owner_id` row from `fromOwnerId` to `toOwnerId`. Called
// from POST /api/migrate when a guest signs up — their localStorage
// participant id moves to their Clerk userId so the new account sees
// the diagrams + folders they built as a guest. Other tables
// (`change_log`, `share_links`, `tabs`) don't carry their own
// owner_id — they link via `diagram_id`, which is owner-bound, so
// updating the diagrams cascade-fixes them implicitly.
//
// Returns `{ diagrams: N, folders: M }`. Idempotent — re-running
// with the same `fromOwnerId` is a no-op once the rows have moved.
export async function migrateOwnerId(
  env: Env,
  fromOwnerId: string,
  toOwnerId: string,
): Promise<{ diagrams: number; folders: number }> {
  const diagramsRes = await env.DB.prepare('UPDATE diagrams SET owner_id = ? WHERE owner_id = ?')
    .bind(toOwnerId, fromOwnerId)
    .run();
  const foldersRes = await env.DB.prepare('UPDATE folders SET owner_id = ? WHERE owner_id = ?')
    .bind(toOwnerId, fromOwnerId)
    .run();
  return {
    diagrams: diagramsRes.meta.changes ?? 0,
    folders: foldersRes.meta.changes ?? 0,
  };
}
