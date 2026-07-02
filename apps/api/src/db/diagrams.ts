// diagrams — metadata row (name, owner, sharing flag, folder,
// timestamps) plus the copy operation. Tab content lives in tabs.ts;
// the read DTO joins owner display info from participants.

import { rowToTabSummary, type TabRow } from '../tab-row';
import type { DiagramDTO, DiagramSummary, Env, TabSummaryDTO } from '../types';
import { getParticipant } from './participants';

type DiagramRow = {
  id: string;
  owner_id: string;
  name: string;
  shareable: number;
  folder_id: string | null;
  team_id: string | null;
  // Provenance (spec/15): null = user-made; 'ai' / 'mcp' = generated.
  source: string | null;
  saved_at: number;
  created_at: number;
  // Derived via subquery in the SELECT; first (oldest) share_links
  // row for this diagram, or NULL when no share links exist. Replaces
  // the legacy diagrams.share_code column dropped in migration 0008.
  share_code: string | null;
};

type SummaryRow = DiagramRow;

async function listTabSummariesFor(env: Env, diagramId: string): Promise<TabSummaryDTO[]> {
  // Read through the diagram_tabs link table (migration 0011 /
  // spec/17) — order_index now lives on the link, not on the tab,
  // so two diagrams that share a tab can order it independently.
  // The legacy tabs.diagram_id + tabs.order_index columns still
  // exist for one more phase as a fallback; we read the canonical
  // path here and let writes keep both in sync until they're
  // dropped in a follow-up migration.
  const result = await env.DB.prepare(
    `SELECT t.id, dt.diagram_id, t.name, dt.order_index, '' AS data, t.updated_at, dt.folder
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
  // Join owner participant info onto the response so visitors can
  // render "Owner: <name>" without waiting for the owner to come
  // online in the realtime room. Null when the owner has no
  // participant row yet (e.g. a Clerk-authed owner who's never set a
  // name on a diagram); the UI hides the badge in that case.
  // The participant lookup and the tab-summary read are independent,
  // so issue them concurrently rather than paying two serial round
  // trips on every diagram fetch (this path is hit by nearly every
  // owned-diagram / share / WS-upgrade request).
  const [ownerParticipant, tabs] = await Promise.all([
    getParticipant(env, row.owner_id),
    listTabSummariesFor(env, row.id),
  ]);
  return {
    id: row.id,
    ownerId: row.owner_id,
    name: row.name,
    tabs,
    shareable: row.shareable === 1,
    shareCode: row.share_code,
    folderId: row.folder_id,
    teamId: row.team_id ?? null,
    source: (row.source as DiagramDTO['source']) ?? null,
    savedAt: row.saved_at,
    createdAt: row.created_at,
    ownerName: ownerParticipant?.name ?? null,
    ownerColor: ownerParticipant?.color ?? null,
  };
}

// Derives the primary share code via a correlated subquery on
// share_links. ORDER BY created_at ASC + LIMIT 1 keeps the result
// stable across calls; "primary" is the oldest link the owner has
// minted for the diagram.
const SHARE_CODE_EXPR =
  '(SELECT code FROM share_links WHERE share_links.diagram_id = diagrams.id ORDER BY created_at ASC LIMIT 1) AS share_code';
const DIAGRAM_COLS = `id, owner_id, name, shareable, folder_id, team_id, source, saved_at, created_at, ${SHARE_CODE_EXPR}`;
const DIAGRAM_SUMMARY_COLS = DIAGRAM_COLS;

// Gate-only projection: the columns access checks need (owner + team +
// name for notifications) in ONE query — no participant join, no tab
// summaries, no share-code subquery. getDiagram costs 3 queries; the
// room-ticket mint and WS upgrade run on every room join and use none
// of the extra data.
export async function getDiagramMeta(
  env: Env,
  id: string,
): Promise<{ id: string; ownerId: string; teamId: string | null; name: string } | null> {
  const row = await env.DB.prepare('SELECT id, owner_id, team_id, name FROM diagrams WHERE id = ?')
    .bind(id)
    .first<{ id: string; owner_id: string; team_id: string | null; name: string }>();
  return row
    ? { id: row.id, ownerId: row.owner_id, teamId: row.team_id ?? null, name: row.name }
    : null;
}

export async function getDiagram(env: Env, id: string): Promise<DiagramDTO | null> {
  const row = await env.DB.prepare(`SELECT ${DIAGRAM_COLS} FROM diagrams WHERE id = ?`)
    .bind(id)
    .first<DiagramRow>();
  return row ? rowToDiagram(env, row) : null;
}

function rowToSummary(row: SummaryRow): DiagramSummary {
  return {
    id: row.id,
    ownerId: row.owner_id,
    name: row.name,
    shareable: row.shareable === 1,
    shareCode: row.share_code,
    folderId: row.folder_id,
    teamId: row.team_id ?? null,
    source: (row.source as DiagramSummary['source']) ?? null,
    savedAt: row.saved_at,
    createdAt: row.created_at,
  };
}

// Personal library only (spec/35): a diagram moved into a team's
// shared library leaves the owner's personal lists and renders on
// the team page instead.
export async function listDiagramsByOwner(env: Env, ownerId: string): Promise<DiagramSummary[]> {
  const result = await env.DB.prepare(
    `SELECT ${DIAGRAM_SUMMARY_COLS} FROM diagrams WHERE owner_id = ? AND team_id IS NULL ORDER BY saved_at DESC`,
  )
    .bind(ownerId)
    .all<SummaryRow>();
  return (result.results ?? []).map(rowToSummary);
}

// One team's shared library (spec/35), any owner.
export async function listDiagramsByTeam(env: Env, teamId: string): Promise<DiagramSummary[]> {
  const result = await env.DB.prepare(
    `SELECT ${DIAGRAM_SUMMARY_COLS} FROM diagrams WHERE team_id = ? ORDER BY saved_at DESC`,
  )
    .bind(teamId)
    .all<SummaryRow>();
  return (result.results ?? []).map(rowToSummary);
}

// Metadata upsert only — diagram name, sharing state, owner id, and
// timestamps. Tabs live in their own table now (see upsertTab /
// reorderTabs / deleteTab). Used both by the new metadata-only PUT
// /diagrams/:id and by the create endpoint.
// Write-side meta upsert. Read-derived fields (`tabs`, `ownerName`,
// `ownerColor`) are pruned from the input shape since none of them
// are stored on the diagrams row directly — tabs live in their own
// table, owner info comes via a participants join on read.
export async function upsertDiagramMeta(
  env: Env,
  d: Omit<DiagramDTO, 'tabs' | 'ownerName' | 'ownerColor'>,
): Promise<void> {
  // `shareCode` is intentionally absent from the INSERT — it now
  // lives only in share_links. The DTO field is read-only (derived
  // via subquery on selects).
  // `source` (provenance, spec/15) is written on INSERT but deliberately
  // absent from the DO UPDATE SET, so it's set once at create time and
  // never rewritten by a later metadata upsert (rename / autosave / move).
  await env.DB.prepare(
    `INSERT INTO diagrams (id, owner_id, name, shareable, folder_id, source, saved_at, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET
       owner_id = excluded.owner_id,
       name = excluded.name,
       saved_at = excluded.saved_at`,
  )
    .bind(
      d.id,
      d.ownerId,
      d.name,
      d.shareable ? 1 : 0,
      d.folderId,
      d.source ?? null,
      d.savedAt,
      d.createdAt,
    )
    .run();
}

// Placement write (spec/15 + spec/35): folder and team scope move
// together in one UPDATE so a diagram can never point at a folder in
// a scope it isn't in. `newOwnerId` transfers ownership in the same
// write: a joined member moving a team diagram out into their own
// personal library becomes its owner (spec/35), and folders are
// owner-scoped so the row must follow them. Omit to keep the owner.
export async function setDiagramFolder(
  env: Env,
  id: string,
  folderId: string | null,
  teamId: string | null = null,
  newOwnerId?: string,
): Promise<void> {
  if (newOwnerId !== undefined) {
    await env.DB.prepare(
      'UPDATE diagrams SET folder_id = ?, team_id = ?, owner_id = ? WHERE id = ?',
    )
      .bind(folderId, teamId, newOwnerId, id)
      .run();
    return;
  }
  await env.DB.prepare('UPDATE diagrams SET folder_id = ?, team_id = ? WHERE id = ?')
    .bind(folderId, teamId, id)
    .run();
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

// Share password (spec/24). Stored in plain text — deliberately
// readable by the owner (the Share dialog shows it) and the threat
// model is anti-URL-guessing, not cryptographic. NULL / empty means
// the diagram has no password. Kept OUT of the diagram DTO columns
// (DIAGRAM_COLS) so it never leaks to a viewer; only these owner-only
// paths touch it.
export async function getDiagramSharePassword(env: Env, id: string): Promise<string | null> {
  const row = await env.DB.prepare('SELECT share_password FROM diagrams WHERE id = ?')
    .bind(id)
    .first<{ share_password: string | null }>();
  const value = row?.share_password ?? null;
  // An all-whitespace value counts as "no password" so a stray space
  // can't lock a diagram in a way the owner can't see in the dialog.
  return value && value.trim() ? value : null;
}

export async function setDiagramSharePassword(
  env: Env,
  id: string,
  password: string | null,
): Promise<void> {
  const normalised = password && password.trim() ? password : null;
  await env.DB.prepare('UPDATE diagrams SET share_password = ? WHERE id = ?')
    .bind(normalised, id)
    .run();
}

export async function deleteDiagram(env: Env, id: string): Promise<void> {
  await env.DB.prepare('DELETE FROM diagrams WHERE id = ?').bind(id).run();
  // Drop the cached SVG snapshot (spec/67) alongside the row so a
  // deleted diagram doesn't leave an orphaned R2 object behind. Best
  // effort: a missing binding or a missing object is a no-op, and a
  // failure here must never fail the delete itself.
  if (env.IMAGES) await env.IMAGES.delete(thumbnailKey(id)).catch(() => {});
}

// R2 object key for a diagram's cached SVG snapshot (spec/67). Shared by
// the render-cache (which writes it) and deleteDiagram (which clears it)
// so the key shape lives in exactly one place.
export function thumbnailKey(diagramId: string): string {
  return `thumb/${diagramId}`;
}

// When the cached snapshot was last rendered (spec/67), or null when it
// never has been. The render-on-read path compares this against the
// diagram's saved_at to decide whether the R2 object is still fresh.
export async function getThumbRenderedAt(env: Env, id: string): Promise<number | null> {
  const row = await env.DB.prepare('SELECT thumb_rendered_at FROM diagrams WHERE id = ?')
    .bind(id)
    .first<{ thumb_rendered_at: number | null }>();
  return row?.thumb_rendered_at ?? null;
}

// Stamp the snapshot as freshly rendered (spec/67). Called after a
// successful R2 write so the next read streams the cached bytes instead
// of re-rendering.
export async function markThumbRendered(env: Env, id: string, now: number): Promise<void> {
  await env.DB.prepare('UPDATE diagrams SET thumb_rendered_at = ? WHERE id = ?')
    .bind(now, id)
    .run();
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
  // One batch instead of 2N sequential round trips: collect both
  // inserts for every source tab and submit them together.
  const inserts = (tabRows.results ?? []).flatMap((row) => {
    const freshTabId = crypto.randomUUID();
    return [
      env.DB.prepare(
        `INSERT INTO tabs (id, diagram_id, name, order_index, data, updated_at)
         VALUES (?, ?, ?, ?, ?, ?)`,
      ).bind(freshTabId, newId, row.name, row.order_index, row.data, now),
      env.DB.prepare(
        `INSERT INTO diagram_tabs (diagram_id, tab_id, order_index, added_at)
         VALUES (?, ?, ?, ?)`,
      ).bind(newId, freshTabId, row.order_index, now),
    ];
  });
  if (inserts.length > 0) await env.DB.batch(inserts);
  return await getDiagram(env, newId);
}

// spec/64 (#6): total diagrams owned by `ownerId`, for the milestone check on
// create. Counts all of an owner's diagrams (a cheap indexed COUNT).
export async function countDiagramsByOwner(env: Env, ownerId: string): Promise<number> {
  const row = await env.DB.prepare('SELECT COUNT(*) AS n FROM diagrams WHERE owner_id = ?')
    .bind(ownerId)
    .first<{ n: number }>();
  return row?.n ?? 0;
}

// spec/64 (#1) throttle: claim the right to email the owner about a new comment
// on this diagram, at most once per window. Atomic conditional UPDATE so a burst
// of concurrent comment saves can't each fire an email. `cutoff` = now - window;
// returns false when we already emailed within the window.
export async function claimCommentNotify(
  env: Env,
  diagramId: string,
  now: number,
  cutoff: number,
): Promise<boolean> {
  const res = await env.DB.prepare(
    'UPDATE diagrams SET comment_notified_at = ? WHERE id = ? AND (comment_notified_at IS NULL OR comment_notified_at < ?)',
  )
    .bind(now, diagramId, cutoff)
    .run();
  return res.meta.changes === 1;
}
