import type { Tab } from '@livediagram/diagram';
import type {
  ChangeLogEntryDTO,
  ChangeLogKind,
  DiagramDTO,
  DiagramSummary,
  Env,
  ParticipantDTO,
  ShareLinkDTO,
  ShareRole,
  TabDTO,
  TabSummaryDTO,
} from './types';

// Thin D1 wrapper. Diagrams + tabs each have their own table; the
// `diagrams.data` blob is retained one release window (see spec 13)
// but never read on this path.

type DiagramRow = {
  id: string;
  owner_id: string;
  name: string;
  shareable: number;
  share_code: string | null;
  saved_at: number;
  created_at: number;
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
    savedAt: row.saved_at,
    createdAt: row.created_at,
  };
}

const DIAGRAM_COLS = 'id, owner_id, name, shareable, share_code, saved_at, created_at';
const DIAGRAM_SUMMARY_COLS = 'id, owner_id, name, shareable, share_code, saved_at, created_at';

export async function getDiagram(env: Env, id: string): Promise<DiagramDTO | null> {
  const row = await env.DB.prepare(`SELECT ${DIAGRAM_COLS} FROM diagrams WHERE id = ?`)
    .bind(id)
    .first<DiagramRow>();
  return row ? rowToDiagram(env, row) : null;
}

export async function getDiagramByShareCode(env: Env, code: string): Promise<DiagramDTO | null> {
  const row = await env.DB.prepare(
    `SELECT ${DIAGRAM_COLS} FROM diagrams WHERE share_code = ? AND shareable = 1`,
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
    savedAt: row.saved_at,
    createdAt: row.created_at,
  }));
}

// Metadata upsert only — diagram name, sharing state, owner id, and
// timestamps. Tabs live in their own table now (see upsertTab /
// reorderTabs / deleteTab). Used both by the new metadata-only PUT
// /diagrams/:id and by the create endpoint.
export async function upsertDiagramMeta(env: Env, d: Omit<DiagramDTO, 'tabs'>): Promise<void> {
  await env.DB.prepare(
    `INSERT INTO diagrams (id, owner_id, name, shareable, share_code, saved_at, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET
       owner_id = excluded.owner_id,
       name = excluded.name,
       saved_at = excluded.saved_at`,
  )
    .bind(d.id, d.ownerId, d.name, d.shareable ? 1 : 0, d.shareCode, d.savedAt, d.createdAt)
    .run();
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

export async function setDiagramShare(
  env: Env,
  id: string,
  shareable: boolean,
  shareCode: string | null,
): Promise<void> {
  await env.DB.prepare('UPDATE diagrams SET shareable = ?, share_code = ? WHERE id = ?')
    .bind(shareable ? 1 : 0, shareCode, id)
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
  // Mark the legacy single-code field too so old GETs still surface
  // the diagram as shared.
  await env.DB.prepare(
    'UPDATE diagrams SET shareable = 1, share_code = COALESCE(share_code, ?) WHERE id = ?',
  )
    .bind(code, diagramId)
    .run();
  return { code, diagramId, role, createdAt };
}

export async function deleteShareLink(env: Env, code: string): Promise<void> {
  const existing = await getShareLink(env, code);
  if (!existing) return;
  await env.DB.prepare('DELETE FROM share_links WHERE code = ?').bind(code).run();
  // If this was the last link for the diagram, flip shareable off so
  // the live app stops opening the realtime room.
  const remaining = await env.DB.prepare(
    'SELECT COUNT(*) AS n FROM share_links WHERE diagram_id = ?',
  )
    .bind(existing.diagramId)
    .first<{ n: number }>();
  if (!remaining || remaining.n === 0) {
    await env.DB.prepare('UPDATE diagrams SET shareable = 0, share_code = NULL WHERE id = ?')
      .bind(existing.diagramId)
      .run();
  } else if (existing.code === (await getDiagram(env, existing.diagramId))?.shareCode) {
    // The legacy share_code column happened to point at the link we
    // just deleted. Promote any remaining link so the legacy field
    // still resolves.
    const survivor = await env.DB.prepare(
      'SELECT code FROM share_links WHERE diagram_id = ? ORDER BY created_at ASC LIMIT 1',
    )
      .bind(existing.diagramId)
      .first<{ code: string }>();
    if (survivor) {
      await env.DB.prepare('UPDATE diagrams SET share_code = ? WHERE id = ?')
        .bind(survivor.code, existing.diagramId)
        .run();
    }
  }
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
const CHANGE_LOG_LIST_LIMIT = 200;

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
