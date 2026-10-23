// diagrams — metadata row (name, owner, sharing flag, folder,
// timestamps) plus the copy operation. Tab content lives in tabs.ts;
// the read DTO joins owner display info from participants.


import type { ProjectDTO, ProjectSummary, Env } from '../types';
import { getParticipant } from './participants';
import { projectRemovalStatements } from './project-removal';
import { purgeRooms } from '../room-purge-client';
import { docStatsSql, firstTabCountSql, isEmptyCount } from './content-summary';
import { readProjectStats } from './tab-stats';
import type { RecordedIntent } from '@liveplanner/api-schema';
import { readRecordedIntent, type RecordedIntentRow } from '../project-intent-row';
import { planRoom } from '../plan-client';

type ProjectRow = {
  id: string;
  owner_id: string;
  name: string;
  shareable: number;
  folder_id: string | null;
  team_id: string | null;
  // Provenance (docs/specs/013-workspace/folders.md): null = user-made; 'mcp' / 'cli' = generated.
  source: string | null;
  saved_at: number;
  created_at: number;
  // Derived via subquery in the SELECT; first (oldest) share_links
  // row for this project, or NULL when no share links exist.
  share_code: string | null;
} & RecordedIntentRow;

export type SummaryRow = ProjectRow & { first_tab_count: number | null; doc_stats: string | null };

async function rowToProject(env: Env, row: ProjectRow): Promise<ProjectDTO> {
  // Join owner participant info onto the response so visitors can
  // render "Owner: <name>" without waiting for the owner to come
  // online in the realtime room. Null when the owner has no
  // participant row yet (e.g. a signed-in owner who's never set a
  // name on a project); the UI hides the badge in that case.
  // The participant lookup and the tab-summary read are independent,
  // so issue them concurrently rather than paying two serial round
  // trips on every project fetch (this path is hit by nearly every
  // owned-project / share / WS-upgrade request).
  // The tabs and the type catalogue are content: one call to the plan's Durable Object (a local call when this
  // already runs inside it, plan-client.ts).
  const [ownerParticipant, outline] = await Promise.all([
    getParticipant(env, row.owner_id),
    planRoom(env, row.id).outline(),
  ]);
  return {
    id: row.id,
    ownerId: row.owner_id,
    name: row.name,
    tabs: outline.tabs,
    shareable: row.shareable === 1,
    shareCode: row.share_code,
    folderId: row.folder_id,
    teamId: row.team_id ?? null,
    source: (row.source as ProjectDTO['source']) ?? null,
    itemTypes: outline.itemTypes,
    itemTypesRev: outline.itemTypesRev,
    // The plan's own is newer while its push to D1 is pending.
    savedAt: Math.max(row.saved_at, outline.savedAt),
    createdAt: row.created_at,
    ownerName: ownerParticipant?.name ?? null,
    ownerColor: ownerParticipant?.color ?? null,
    ...readRecordedIntent(row),
  };
}

// Derives the primary share code via a correlated subquery on
// share_links. ORDER BY created_at ASC + LIMIT 1 keeps the result
// stable across calls; "primary" is the oldest link the owner has
// minted for the project.
const SHARE_CODE_EXPR =
  '(SELECT code FROM share_links WHERE share_links.project_id = projects.id ORDER BY created_at ASC LIMIT 1) AS share_code';
// `opens_in`, `tab_kind`, `template_family`: the recorded creation intent.
const INTENT_COLS = 'opens_in, tab_kind, template_family';
const PROJECT_COLS = `id, owner_id, name, shareable, folder_id, team_id, source, ${INTENT_COLS}, saved_at, created_at, ${SHARE_CODE_EXPR}`;
// The list projection reads no content: the counts and stats come from the summary the plan pushes
// (content-summary.ts).
export const PROJECT_SUMMARY_COLS = `id, owner_id, name, shareable, folder_id, team_id, source, ${INTENT_COLS}, saved_at, created_at, ${SHARE_CODE_EXPR}, ${firstTabCountSql('projects.id')}, ${docStatsSql('projects.id')}`;

// Gate-only projection: the columns access checks need (owner + team +
// name for notifications) in ONE query — no participant join, no tab
// summaries, no share-code subquery. getProject costs 3 queries; the
// room-ticket mint and WS upgrade run on every room join and use none
// of the extra data.
//
// Both project reads see LIVE projects only: a trashed one reads as missing
// (docs/specs/013-workspace/trash.md, "fail closed"). A door that owes an
// authorised caller the deleted state asks getTrashedProjectMeta on a miss.
export async function getProjectMeta(
  env: Env,
  id: string,
): Promise<{ id: string; ownerId: string; teamId: string | null; name: string } | null> {
  const row = await env.DB.prepare(
    'SELECT id, owner_id, team_id, name FROM projects WHERE id = ? AND trashed_at IS NULL',
  )
    .bind(id)
    .first<{ id: string; owner_id: string; team_id: string | null; name: string }>();
  return row
    ? { id: row.id, ownerId: row.owner_id, teamId: row.team_id ?? null, name: row.name }
    : null;
}

// Thumbnail projection (docs/specs/006-project/project-snapshots.md): what the
// snapshot route needs to gate access AND decide cache freshness, in ONE
// query. getProject (3 queries) plus a separate thumb_rendered_at read put
// four dependent D1 round trips in front of every Explorer preview, even a
// fresh cache hit; this is one.
export type ProjectThumbMeta = {
  id: string;
  ownerId: string;
  teamId: string | null;
  name: string;
  savedAt: number;
  thumbRenderedAt: number | null;
};

export async function getProjectThumbMeta(env: Env, id: string): Promise<ProjectThumbMeta | null> {
  const row = await env.DB.prepare(
    'SELECT id, owner_id, team_id, name, saved_at, thumb_rendered_at FROM projects WHERE id = ? AND trashed_at IS NULL',
  )
    .bind(id)
    .first<{
      id: string;
      owner_id: string;
      team_id: string | null;
      name: string;
      saved_at: number;
      thumb_rendered_at: number | null;
    }>();
  return row
    ? {
        id: row.id,
        ownerId: row.owner_id,
        teamId: row.team_id ?? null,
        name: row.name,
        savedAt: row.saved_at,
        thumbRenderedAt: row.thumb_rendered_at ?? null,
      }
    : null;
}

export async function getProject(env: Env, id: string): Promise<ProjectDTO | null> {
  const row = await env.DB.prepare(
    `SELECT ${PROJECT_COLS} FROM projects WHERE id = ? AND trashed_at IS NULL`,
  )
    .bind(id)
    .first<ProjectRow>();
  return row ? rowToProject(env, row) : null;
}

export function rowToSummary(row: SummaryRow): ProjectSummary {
  return {
    id: row.id,
    ownerId: row.owner_id,
    name: row.name,
    shareable: row.shareable === 1,
    shareCode: row.share_code,
    folderId: row.folder_id,
    teamId: row.team_id ?? null,
    source: (row.source as ProjectSummary['source']) ?? null,
    ...readRecordedIntent(row),
    savedAt: row.saved_at,
    createdAt: row.created_at,
    empty: isEmptyCount(row.first_tab_count),
    stats: readProjectStats(row.doc_stats),
  };
}

// Personal library only (docs/specs/013-workspace/team-shared-projects.md): a project moved into a team's
// shared library leaves the owner's personal lists and renders on
// the team page instead.
export async function listProjectsByOwner(env: Env, ownerId: string): Promise<ProjectSummary[]> {
  const result = await env.DB.prepare(
    `SELECT ${PROJECT_SUMMARY_COLS} FROM projects WHERE owner_id = ? AND team_id IS NULL AND trashed_at IS NULL ORDER BY saved_at DESC`,
  )
    .bind(ownerId)
    .all<SummaryRow>();
  return (result.results ?? []).map(rowToSummary);
}

// One team's shared library (docs/specs/013-workspace/team-shared-projects.md), any owner.
export async function listProjectsByTeam(env: Env, teamId: string): Promise<ProjectSummary[]> {
  const result = await env.DB.prepare(
    `SELECT ${PROJECT_SUMMARY_COLS} FROM projects WHERE team_id = ? AND trashed_at IS NULL ORDER BY saved_at DESC`,
  )
    .bind(teamId)
    .all<SummaryRow>();
  return (result.results ?? []).map(rowToSummary);
}

// Metadata upsert only — project name, sharing state, owner id, and
// timestamps. Tabs live in their own table now (see upsertTab /
// reorderTabs / deleteTab). Used both by the new metadata-only PUT
// /projects/:id and by the create endpoint.
// Write-side meta upsert. Read-derived fields (`tabs`, `ownerName`,
// `ownerColor`) are pruned from the input shape since none of them
// are stored on the projects row directly — tabs live in their own
// table, owner info comes via a participants join on read.
export async function upsertProjectMeta(
  env: Env,
  // The recorded creation intent (docs/specs/013-workspace/default-folders.md "Recorded intent")
  // rides the same shape: written by the INSERT, never by the update.
  d: Omit<
    ProjectDTO,
    'tabs' | 'ownerName' | 'ownerColor' | 'itemTypes' | 'itemTypesRev' | keyof RecordedIntent
  > &
    Partial<RecordedIntent>,
): Promise<void> {
  // `shareCode` is intentionally absent from the INSERT — it now
  // lives only in share_links. The DTO field is read-only (derived
  // via subquery on selects).
  // `source` (provenance, docs/specs/013-workspace/folders.md) is written on INSERT but deliberately
  // absent from the DO UPDATE SET, so it's set once at create time and
  // never rewritten by a later metadata upsert (rename / autosave / move).
  // The type catalogue is content: the plan's own row holds it (plan-room/plan-content.ts).
  // `folder_id` and `team_id` are the placement, written by the INSERT that creates the row
  // (docs/specs/013-workspace/folders.md "Placement on create") and never by the DO UPDATE: a
  // re-commit keeps its place, and moving is setProjectFolder's job.
  // `opens_in`, `tab_kind` and `template_family` are the recorded creation intent, written here once
  // and never by the DO UPDATE, so nothing after the create re-derives or rewrites them.
  await env.DB.prepare(
    `INSERT INTO projects (id, owner_id, name, shareable, folder_id, team_id, source, saved_at, created_at, opens_in, tab_kind, template_family)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
      d.teamId ?? null,
      d.source ?? null,
      d.savedAt,
      d.createdAt,
      d.opensIn ?? null,
      d.tabKind ?? null,
      d.templateFamily ?? null,
    )
    .run();
}

// Placement write (docs/specs/013-workspace/folders.md + docs/specs/013-workspace/team-shared-projects.md): folder and team scope move
// together in one UPDATE so a project can never point at a folder in
// a scope it isn't in. `newOwnerId` transfers ownership in the same
// write: a joined member moving a team project out into their own
// personal library becomes its owner (docs/specs/013-workspace/team-shared-projects.md), and folders are
// owner-scoped so the row must follow them. Omit to keep the owner.
//
// The folder's existence and scope are checked INSIDE the UPDATE, not only by the caller's read
// beforehand: a folder deleted (or moved to the other space) between that read and this write would
// otherwise leave the project filed under a folder that is gone. Answers whether the row changed;
// false means the folder (or the project) is not there any more, and the caller answers 404.
export async function setProjectFolder(
  env: Env,
  id: string,
  folderId: string | null,
  teamId: string | null = null,
  newOwnerId?: string,
): Promise<boolean> {
  const owner = newOwnerId ?? null;
  const update = env.DB.prepare(
    `UPDATE projects SET folder_id = ?2, team_id = ?3, owner_id = COALESCE(?4, owner_id)
     WHERE id = ?1
       AND (?2 IS NULL OR EXISTS (
         SELECT 1 FROM folders f
         WHERE f.id = ?2
           AND f.team_id IS ?3
           AND (?3 IS NOT NULL OR f.owner_id = COALESCE(?4, projects.owner_id))
       ))`,
  ).bind(id, folderId, teamId, owner);
  const res = await update.run();
  return (res.meta.changes ?? 0) > 0;
}

// Toggle the shareable flag on a project. The actual codes live in
// share_links (managed by createShareLink / deleteShareLink); this
// helper only flips the boolean that gates the realtime room + the
// share-code resolver.
export async function setProjectShare(env: Env, id: string, shareable: boolean): Promise<void> {
  await env.DB.prepare('UPDATE projects SET shareable = ? WHERE id = ?')
    .bind(shareable ? 1 : 0, id)
    .run();
}

// Share password (docs/specs/013-workspace/share-password.md). The column holds a PBKDF2 hash
// (auth/share-password-hash.ts), or a plain-text value saved before hashing
// shipped, which the first correct entry rewrites. NULL / empty means the
// project has no password. Kept OUT of the project DTO columns
// (PROJECT_COLS) and never returned by any route; only the share-access
// check reads it.
export async function getProjectSharePassword(env: Env, id: string): Promise<string | null> {
  const row = await env.DB.prepare('SELECT share_password FROM projects WHERE id = ?')
    .bind(id)
    .first<{ share_password: string | null }>();
  const value = row?.share_password ?? null;
  // An all-whitespace value counts as "no password" so a stray space
  // can't lock a project in a way the owner can't see in the dialog.
  return value && value.trim() ? value : null;
}

// `stored` is what the column should hold: a hash from hashSharePassword, or
// null to clear. The route hashes; this layer never sees a plain password.
export async function setProjectSharePassword(
  env: Env,
  id: string,
  stored: string | null,
): Promise<void> {
  await env.DB.prepare('UPDATE projects SET share_password = ? WHERE id = ?')
    .bind(stored, id)
    .run();
}

// Rewrite a legacy plain-text value as its hash, only if the column still
// holds that exact value: an owner who changed the password meanwhile wins.
export async function upgradeProjectSharePassword(
  env: Env,
  id: string,
  from: string,
  to: string,
): Promise<void> {
  await env.DB.prepare('UPDATE projects SET share_password = ? WHERE id = ? AND share_password = ?')
    .bind(to, id, from)
    .run();
}

// The immediate hard delete of one project, which only Take Offline uses now:
// every other delete moves the project to the Trash, and its purge runs
// purgeProjects (docs/specs/013-workspace/trash.md). A tab another project
// still holds survives either.
export async function deleteProject(env: Env, id: string): Promise<void> {
  await env.DB.batch(projectRemovalStatements(env, { column: 'id', value: id }));
  // The room's storage too: an Offline project keeps nothing on the server. Best effort.
  await purgeRooms(env, [id]);
  // Drop the cached SVG snapshot (docs/specs/006-project/project-snapshots.md) alongside the row so a
  // deleted project doesn't leave an orphaned R2 object behind. Best
  // effort: a missing binding or a missing object is a no-op, and a
  // failure here must never fail the delete itself.
  if (env.SNAPSHOTS) await env.SNAPSHOTS.delete(snapshotKeys(id)).catch(() => {});
}

// R2 object key for a project's cached SVG snapshot (docs/specs/006-project/project-snapshots.md). Shared by
// the render-cache (which writes it) and deleteProject (which clears it)
// so the key shape lives in exactly one place.
export function thumbnailKey(projectId: string): string {
  return `thumb/${projectId}`;
}

// The share card a link preview shows (docs/specs/013-workspace/share-link-previews.md): the first-tab snapshot drawn
// as a 1200 x 630 PNG.
export function shareCardKey(projectId: string): string {
  return `og/${projectId}`;
}

// Every cached snapshot a project can have, for the paths that delete it.
export function snapshotKeys(projectId: string): string[] {
  return [thumbnailKey(projectId), shareCardKey(projectId)];
}

// When the cached snapshot was last rendered (docs/specs/006-project/project-snapshots.md), or null when it
// never has been. The render-on-read path compares this against the
// project's saved_at to decide whether the R2 object is still fresh.
export async function getThumbRenderedAt(env: Env, id: string): Promise<number | null> {
  const row = await env.DB.prepare('SELECT thumb_rendered_at FROM projects WHERE id = ?')
    .bind(id)
    .first<{ thumb_rendered_at: number | null }>();
  return row?.thumb_rendered_at ?? null;
}

// Stamp the snapshot as freshly rendered (docs/specs/006-project/project-snapshots.md). Called after a
// successful R2 write so the next read streams the cached bytes instead
// of re-rendering.
export async function markThumbRendered(env: Env, id: string, now: number): Promise<void> {
  await env.DB.prepare('UPDATE projects SET thumb_rendered_at = ? WHERE id = ?')
    .bind(now, id)
    .run();
}

// "Copy this project to my own files" — duplicates the source project
// under a brand-new id owned by `newOwnerId`. Carries the project
// meta and every tab's content; deliberately does NOT copy share_links or the
// shareable flag. The new project starts private so the visitor's
// copy reads as their own clean workspace, not a clone of the host's
// collab setup.
//
// The content goes from the source plan's Durable Object to the copy's (plan-room/plan-content.ts
// exportPlanCopy / importPlanCopy): the source exports it, the copy's row is made here, then the
// copy's Durable Object imports it in one transaction. Caller is expected to have already
// authorised the copy (the route checks ownership / share_code / shared_with).
export async function copyProject(
  env: Env,
  sourceId: string,
  newId: string,
  newOwnerId: string,
  newName: string,
  // A tab-scoped visitor's copy (docs/specs/013-workspace/tab-scoped-share-links.md) takes their tab only.
  onlyTabId: string | null = null,
  // A copy by anyone but the source's owner: its comments keep only the copier's own author ids, as
  // the tab read serves them (redactCommentAuthorIds). An author id is a guest's credential.
  redactAuthorsFor: string | null = null,
): Promise<ProjectDTO | null> {
  const source = await getProject(env, sourceId);
  if (!source) return null;
  const now = Date.now();
  const content = await planRoom(env, sourceId).exportCopy(onlyTabId, redactAuthorsFor);
  if (!content) return null;
  // The copy carries the source's recorded creation intent, read in the same statement, never
  // re-derived (docs/specs/013-workspace/default-folders.md "Recorded intent").
  await env.DB.prepare(
    `INSERT INTO projects (id, owner_id, name, shareable, folder_id, saved_at, created_at, ${INTENT_COLS})
     SELECT ?, ?, ?, 0, NULL, ?, ?, ${INTENT_COLS} FROM projects WHERE id = ?`,
  )
    .bind(newId, newOwnerId, newName, now, now, sourceId)
    .run();
  await planRoom(env, newId).importCopy(content);
  return await getProject(env, newId);
}

// docs/specs/014-identity/transactional-email.md (#6): total projects owned by `ownerId`, for the milestone check on
// create. Counts all of an owner's projects (a cheap indexed COUNT).
export async function countProjectsByOwner(env: Env, ownerId: string): Promise<number> {
  const row = await env.DB.prepare('SELECT COUNT(*) AS n FROM projects WHERE owner_id = ?')
    .bind(ownerId)
    .first<{ n: number }>();
  return row?.n ?? 0;
}

// docs/specs/014-identity/transactional-email.md (#1) throttle: claim the right to email the owner about a new comment
// on this project, at most once per window. Atomic conditional UPDATE so a burst
// of concurrent comment saves can't each fire an email. `cutoff` = now - window;
// returns false when we already emailed within the window.
export async function claimCommentNotify(
  env: Env,
  projectId: string,
  now: number,
  cutoff: number,
): Promise<boolean> {
  const res = await env.DB.prepare(
    'UPDATE projects SET comment_notified_at = ? WHERE id = ? AND (comment_notified_at IS NULL OR comment_notified_at < ?)',
  )
    .bind(now, projectId, cutoff)
    .run();
  return res.meta.changes === 1;
}

// docs/specs/014-identity/profile-and-email-notifications.md (a) throttle: claim the right to email the owner that
// someone joined this project, at most once per window. The same atomic conditional UPDATE as
// claimCommentNotify, on its own column, so a join and a comment never spend each other's window.
export async function claimJoinNotify(
  env: Env,
  projectId: string,
  now: number,
  cutoff: number,
): Promise<boolean> {
  const res = await env.DB.prepare(
    'UPDATE projects SET join_notified_at = ? WHERE id = ? AND (join_notified_at IS NULL OR join_notified_at < ?)',
  )
    .bind(now, projectId, cutoff)
    .run();
  return res.meta.changes === 1;
}
