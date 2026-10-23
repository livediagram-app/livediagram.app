// diagrams — metadata row (name, owner, sharing flag, folder,
// timestamps) plus the copy operation. Tab content lives in tabs.ts;
// the read DTO joins owner display info from participants.

import type { DocumentDTO, DocumentSummary, Env } from '../types';
import { getParticipant } from '../liveworkspace/profiles';
import { imageGrantCopyStatements, imageGrantOwnerChangeStatement } from './image-grants';
import { documentRemovalStatements } from './document-removal';
import { purgeRooms } from '../room-purge-client';
import { docStatsSql, firstTabCountSql, isEmptyCount } from './content-summary';
import { readDocumentStats } from './tab-stats';
import { PUBLIC_LINK } from './community-links';
import type { RecordedIntent } from '@livediagram/api-schema';
import { readRecordedIntent, type RecordedIntentRow } from '../document-intent-row';
import { documentRoom } from '../document-client';
import { copyImageIds } from '../document-room/document-content';

type DocumentRow = {
  id: string;
  owner_id: string;
  name: string;
  shareable: number;
  folder_id: string | null;
  team_id: string | null;
  // Provenance (docs/specs/013-workspace/folders.md): null = user-made; 'mcp' / 'cli' = made by a tool.
  source: string | null;
  saved_at: number;
  created_at: number;
  // Derived via subquery in the SELECT; first (oldest) share_links
  // row for this document, or NULL when no share links exist. Replaces
  // the legacy diagrams.share_code column dropped in migration 0008.
  share_code: string | null;
  // The document's Community post state (docs/specs/025-community/community.md); the full document read
  // and the list projection both select it.
  community_state?: string | null;
} & RecordedIntentRow;

export type SummaryRow = DocumentRow & { first_tab_count: number | null; doc_stats: string | null };

async function rowToDocument(env: Env, row: DocumentRow): Promise<DocumentDTO> {
  // Join owner participant info onto the response so visitors can
  // render "Owner: <name>" without waiting for the owner to come
  // online in the realtime room. Null when the owner has no
  // participant row yet (e.g. a signed-in owner who's never set a
  // name on a document); the UI hides the badge in that case.
  // The participant lookup and the outline read are independent,
  // so issue them concurrently rather than paying two serial round
  // trips on every document fetch (this path is hit by nearly every
  // owned-document / share / WS-upgrade request).
  // The tabs and the slide deck are content: one call to the document's Durable Object (a local call when this
  // already runs inside it, document-client.ts).
  const [ownerParticipant, outline] = await Promise.all([
    getParticipant(env, row.owner_id),
    documentRoom(env, row.id).outline(),
  ]);
  return {
    id: row.id,
    ownerId: row.owner_id,
    name: row.name,
    tabs: outline.tabs,
    shareable: row.shareable === 1,
    shareCode: row.share_code,
    communityState:
      row.community_state === 'listed' || row.community_state === 'hidden'
        ? row.community_state
        : null,
    folderId: row.folder_id,
    teamId: row.team_id ?? null,
    source: (row.source as DocumentDTO['source']) ?? null,
    presentation: outline.presentation,
    // The document's own is newer while its push to D1 is pending.
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
// minted for the document.
const SHARE_CODE_EXPR =
  "(SELECT code FROM share_links WHERE share_links.document_id = documents.id AND share_links.purpose = 'share' ORDER BY created_at ASC LIMIT 1) AS share_code";
// `opens_in`, `tab_kind`, `template_family`: the recorded creation intent.
const INTENT_COLS = 'opens_in, tab_kind, template_family';
// The document's Community post state, for the owner's header badge and the Explorer's Public badge
// (docs/specs/025-community/community.md). 'listed' only while the post is public by the rule every public read
// uses (PUBLIC_LINK): a listed post whose document moved into a team library, changed owner or took a password reads
// as no post, so its badge falls back to Team, Shared or Private. Read from this api's own community links
// (db/community-links.ts), never the Community service: community_links.document_id is UNIQUE and d is the same row
// by its primary key, so two index lookups a row.
const COMMUNITY_STATE_EXPR = `(SELECT CASE WHEN cl.hidden_at IS NOT NULL THEN 'hidden' WHEN ${PUBLIC_LINK} THEN 'listed' END
  FROM community_links cl JOIN documents d ON d.id = cl.document_id
  WHERE cl.document_id = documents.id) AS community_state`;
const DOCUMENT_COLS = `id, owner_id, name, shareable, folder_id, team_id, source, ${INTENT_COLS}, saved_at, created_at, ${SHARE_CODE_EXPR}, ${COMMUNITY_STATE_EXPR}`;
// The list projection reads no content: the counts and stats come from the summary the document pushes
// (content-summary.ts).
export const DOCUMENT_SUMMARY_COLS = `id, owner_id, name, shareable, folder_id, team_id, source, ${INTENT_COLS}, saved_at, created_at, ${SHARE_CODE_EXPR}, ${COMMUNITY_STATE_EXPR}, ${firstTabCountSql('documents.id')}, ${docStatsSql('documents.id')}`;

// Gate-only projection: the columns access checks need (owner + team +
// name for notifications) in ONE query — no participant join, no tab
// summaries, no share-code subquery. getDocument costs 3 queries; the
// room-ticket mint and WS upgrade run on every room join and use none
// of the extra data.
//
// Both document reads see LIVE documents only: a trashed one reads as missing
// (docs/specs/013-workspace/trash.md, "fail closed"). A door that owes an
// authorised caller the deleted state asks getTrashedDocumentMeta on a miss.
export async function getDocumentMeta(
  env: Env,
  id: string,
): Promise<{ id: string; ownerId: string; teamId: string | null; name: string } | null> {
  const row = await env.DB.prepare(
    'SELECT id, owner_id, team_id, name FROM documents WHERE id = ? AND trashed_at IS NULL',
  )
    .bind(id)
    .first<{ id: string; owner_id: string; team_id: string | null; name: string }>();
  return row
    ? { id: row.id, ownerId: row.owner_id, teamId: row.team_id ?? null, name: row.name }
    : null;
}

// Thumbnail projection (docs/specs/006-document/document-snapshots.md): what the
// snapshot route needs to gate access AND decide cache freshness, in ONE
// query. getDocument (3 queries) plus a separate thumb_rendered_at read put
// four dependent D1 round trips in front of every Explorer preview, even a
// fresh cache hit; this is one.
export type DocumentThumbMeta = {
  id: string;
  ownerId: string;
  teamId: string | null;
  name: string;
  savedAt: number;
  thumbRenderedAt: number | null;
};

export async function getDocumentThumbMeta(
  env: Env,
  id: string,
): Promise<DocumentThumbMeta | null> {
  const row = await env.DB.prepare(
    'SELECT id, owner_id, team_id, name, saved_at, thumb_rendered_at FROM documents WHERE id = ? AND trashed_at IS NULL',
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

export async function getDocument(env: Env, id: string): Promise<DocumentDTO | null> {
  const row = await env.DB.prepare(
    `SELECT ${DOCUMENT_COLS} FROM documents WHERE id = ? AND trashed_at IS NULL`,
  )
    .bind(id)
    .first<DocumentRow>();
  return row ? rowToDocument(env, row) : null;
}

export function rowToSummary(row: SummaryRow): DocumentSummary {
  return {
    id: row.id,
    ownerId: row.owner_id,
    name: row.name,
    shareable: row.shareable === 1,
    shareCode: row.share_code,
    communityListed: row.community_state === 'listed',
    folderId: row.folder_id,
    teamId: row.team_id ?? null,
    source: (row.source as DocumentSummary['source']) ?? null,
    ...readRecordedIntent(row),
    savedAt: row.saved_at,
    createdAt: row.created_at,
    empty: isEmptyCount(row.first_tab_count),
    stats: readDocumentStats(row.doc_stats),
  };
}

// Personal library only (docs/specs/013-workspace/team-shared-documents.md): a document moved into a team's
// shared library leaves the owner's personal lists and renders on
// the team page instead.
export async function listDocumentsByOwner(env: Env, ownerId: string): Promise<DocumentSummary[]> {
  const result = await env.DB.prepare(
    `SELECT ${DOCUMENT_SUMMARY_COLS} FROM documents WHERE owner_id = ? AND team_id IS NULL AND trashed_at IS NULL ORDER BY saved_at DESC`,
  )
    .bind(ownerId)
    .all<SummaryRow>();
  return (result.results ?? []).map(rowToSummary);
}

// One team's shared library (docs/specs/013-workspace/team-shared-documents.md), any owner.
export async function listDocumentsByTeam(env: Env, teamId: string): Promise<DocumentSummary[]> {
  const result = await env.DB.prepare(
    `SELECT ${DOCUMENT_SUMMARY_COLS} FROM documents WHERE team_id = ? AND trashed_at IS NULL ORDER BY saved_at DESC`,
  )
    .bind(teamId)
    .all<SummaryRow>();
  return (result.results ?? []).map(rowToSummary);
}

// Metadata upsert only — document name, sharing state, owner id, and
// timestamps. Tabs live in their own table now (see upsertTab /
// reorderTabs / deleteTab). Used both by the new metadata-only PUT
// /documents/:id and by the create endpoint.
// Write-side meta upsert. Read-derived fields (`tabs`, `ownerName`,
// `ownerColor`) are pruned from the input shape since none of them
// are stored on the documents row directly — tabs live in their own
// table, owner info comes via a participants join on read.
export async function upsertDocumentMeta(
  env: Env,
  // The recorded creation intent (docs/specs/013-workspace/default-folders.md "Recorded intent")
  // rides the same shape: written by the INSERT, never by the update.
  d: Omit<
    DocumentDTO,
    'tabs' | 'ownerName' | 'ownerColor' | 'presentation' | keyof RecordedIntent
  > &
    Partial<RecordedIntent>,
): Promise<void> {
  // `shareCode` is intentionally absent from the INSERT — it now
  // lives only in share_links. The DTO field is read-only (derived
  // via subquery on selects).
  // `source` (provenance, docs/specs/013-workspace/folders.md) is written on INSERT but deliberately
  // absent from the DO UPDATE SET, so it's set once at create time and
  // never rewritten by a later metadata upsert (rename / autosave / move).
  // The slide deck is content: the document's own row holds it (document-room/document-content.ts).
  // `folder_id` and `team_id` are the placement, written by the INSERT that creates the row
  // (docs/specs/013-workspace/folders.md "Placement on create") and never by the DO UPDATE: a
  // re-commit keeps its place, and moving is setDocumentFolder's job.
  // `opens_in`, `tab_kind` and `template_family` are the recorded creation intent, written here once
  // and never by the DO UPDATE, so nothing after the create re-derives or rewrites them.
  await env.DB.prepare(
    `INSERT INTO documents (id, owner_id, name, shareable, folder_id, team_id, source, saved_at, created_at, opens_in, tab_kind, template_family)
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

// Placement write (docs/specs/013-workspace/folders.md + docs/specs/013-workspace/team-shared-documents.md): folder and team scope move
// together in one UPDATE so a document can never point at a folder in
// a scope it isn't in. `newOwnerId` transfers ownership in the same
// write: a joined member moving a team document out into their own
// personal library becomes its owner (docs/specs/013-workspace/team-shared-documents.md), and folders are
// owner-scoped so the row must follow them. Omit to keep the owner.
//
// The folder's existence and scope are checked INSIDE the UPDATE, not only by the caller's read
// beforehand: a folder deleted (or moved to the other space) between that read and this write would
// otherwise leave the document filed under a folder that is gone. Answers whether the row changed;
// false means the folder (or the document) is not there any more, and the caller answers 404.
export async function setDocumentFolder(
  env: Env,
  id: string,
  folderId: string | null,
  teamId: string | null = null,
  newOwnerId?: string,
): Promise<boolean> {
  const owner = newOwnerId ?? null;
  const update = env.DB.prepare(
    `UPDATE documents SET folder_id = ?2, team_id = ?3, owner_id = COALESCE(?4, owner_id)
     WHERE id = ?1
       AND (?2 IS NULL OR EXISTS (
         SELECT 1 FROM folders f
         WHERE f.id = ?2
           AND f.team_id IS ?3
           AND (?3 IS NOT NULL OR f.owner_id = COALESCE(?4, documents.owner_id))
       ))`,
  ).bind(id, folderId, teamId, owner);
  if (newOwnerId === undefined) {
    const res = await update.run();
    return (res.meta.changes ?? 0) > 0;
  }
  // An owner change: the previous owner's images in it keep serving once it is the new owner's, granted in
  // the same batch (a refused move leaves only a redundant grant, the old owner still owning it).
  const [, res] = await env.DB.batch([
    imageGrantOwnerChangeStatement(
      env,
      'd.id = ?2 AND d.owner_id <> ?3',
      [id, newOwnerId],
      Date.now(),
    ),
    update,
  ]);
  return (res?.meta.changes ?? 0) > 0;
}

// Toggle the shareable flag on a document. The actual codes live in
// share_links (managed by createShareLink / deleteShareLink); this
// helper only flips the boolean that gates the realtime room + the
// share-code resolver.
export async function setDocumentShare(env: Env, id: string, shareable: boolean): Promise<void> {
  await env.DB.prepare('UPDATE documents SET shareable = ? WHERE id = ?')
    .bind(shareable ? 1 : 0, id)
    .run();
}

// Share password (docs/specs/013-workspace/share-password.md). The column holds a PBKDF2 hash
// (auth/share-password-hash.ts), or a plain-text value saved before hashing
// shipped, which the first correct entry rewrites. NULL / empty means the
// document has no password. Kept OUT of the document DTO columns
// (DOCUMENT_COLS) and never returned by any route; only the share-access
// check reads it.
export async function getDocumentSharePassword(env: Env, id: string): Promise<string | null> {
  const row = await env.DB.prepare('SELECT share_password FROM documents WHERE id = ?')
    .bind(id)
    .first<{ share_password: string | null }>();
  const value = row?.share_password ?? null;
  // An all-whitespace value counts as "no password" so a stray space
  // can't lock a document in a way the owner can't see in the dialog.
  return value && value.trim() ? value : null;
}

// `stored` is what the column should hold: a hash from hashSharePassword, or
// null to clear. The route hashes; this layer never sees a plain password.
export async function setDocumentSharePassword(
  env: Env,
  id: string,
  stored: string | null,
): Promise<void> {
  await env.DB.prepare('UPDATE documents SET share_password = ? WHERE id = ?')
    .bind(stored, id)
    .run();
}

// Rewrite a legacy plain-text value as its hash, only if the column still
// holds that exact value: an owner who changed the password meanwhile wins.
export async function upgradeDocumentSharePassword(
  env: Env,
  id: string,
  from: string,
  to: string,
): Promise<void> {
  await env.DB.prepare(
    'UPDATE documents SET share_password = ? WHERE id = ? AND share_password = ?',
  )
    .bind(to, id, from)
    .run();
}

// The immediate hard delete of one document, which only Take Offline uses now:
// every other delete moves the document to the Trash, and its purge runs
// purgeDocuments (docs/specs/013-workspace/trash.md). A tab another document
// still holds survives either.
export async function deleteDocument(env: Env, id: string): Promise<void> {
  await env.DB.batch(documentRemovalStatements(env, { column: 'id', value: id }));
  // The room's storage too: an Offline document keeps nothing on the server. Best effort.
  await purgeRooms(env, [id]);
  // Drop the cached SVG snapshot (docs/specs/006-document/document-snapshots.md) alongside the row so a
  // deleted document doesn't leave an orphaned R2 object behind. Best
  // effort: a missing binding or a missing object is a no-op, and a
  // failure here must never fail the delete itself.
  if (env.IMAGES) await env.IMAGES.delete(snapshotKeys(id)).catch(() => {});
}

// R2 object key for a document's cached SVG snapshot (docs/specs/006-document/document-snapshots.md). Shared by
// the render-cache (which writes it) and deleteDocument (which clears it)
// so the key shape lives in exactly one place.
export function thumbnailKey(documentId: string): string {
  return `thumb/${documentId}`;
}

// The Community's own snapshot (docs/specs/025-community/community.md "Viewing a post's document"): drawn from the
// redacted tab (no comments, no people), so the public card image never serves the owner's snapshot.
export function communityThumbnailKey(documentId: string): string {
  return `thumb-community/${documentId}`;
}

// The share card a link preview shows (docs/specs/013-workspace/share-link-previews.md): the first-tab snapshot drawn
// as a 1200 x 630 PNG, and the Community's own, drawn from its redacted snapshot.
export function shareCardKey(documentId: string): string {
  return `og/${documentId}`;
}

export function communityShareCardKey(documentId: string): string {
  return `og-community/${documentId}`;
}

// Every cached snapshot a document can have, for the paths that delete it.
export function snapshotKeys(documentId: string): string[] {
  return [
    thumbnailKey(documentId),
    communityThumbnailKey(documentId),
    shareCardKey(documentId),
    communityShareCardKey(documentId),
  ];
}

// When the cached snapshot was last rendered (docs/specs/006-document/document-snapshots.md), or null when it
// never has been. The render-on-read path compares this against the
// document's saved_at to decide whether the R2 object is still fresh.
export async function getThumbRenderedAt(env: Env, id: string): Promise<number | null> {
  const row = await env.DB.prepare('SELECT thumb_rendered_at FROM documents WHERE id = ?')
    .bind(id)
    .first<{ thumb_rendered_at: number | null }>();
  return row?.thumb_rendered_at ?? null;
}

// Stamp the snapshot as freshly rendered (docs/specs/006-document/document-snapshots.md). Called after a
// successful R2 write so the next read streams the cached bytes instead
// of re-rendering.
export async function markThumbRendered(env: Env, id: string, now: number): Promise<void> {
  await env.DB.prepare('UPDATE documents SET thumb_rendered_at = ? WHERE id = ?')
    .bind(now, id)
    .run();
}

// "Copy this document to my own files" — duplicates the source document
// under a brand-new id owned by `newOwnerId`. Carries the document
// meta and every tab's content; deliberately does NOT copy share_links or the
// shareable flag. The new document starts private so the visitor's
// copy reads as their own clean workspace, not a clone of the host's
// collab setup.
//
// The content goes from the source document's Durable Object to the copy's (document-room/document-content.ts
// exportDocumentCopy / importDocumentCopy): the source exports it, the copy's row is made here, then the
// copy's Durable Object imports it in one transaction. Caller is expected to have already
// authorised the copy (the route checks ownership / share_code / shared_with).
export async function copyDocument(
  env: Env,
  sourceId: string,
  newId: string,
  newOwnerId: string,
  newName: string,
  // A tab-scoped visitor's copy (docs/specs/013-workspace/tab-scoped-share-links.md) takes their tab only.
  onlyTabId: string | null = null,
  // A copy through a Community post's link (docs/specs/025-community/community.md) carries the document
  // without its comments or the people on its actions, and so none of their index rows.
  redactForCommunity = false,
  // A copy by anyone but the source's owner: its comments keep only the copier's own author ids, as
  // the tab read serves them (redactCommentAuthorIds). An author id is a guest's credential.
  redactAuthorsFor: string | null = null,
): Promise<DocumentDTO | null> {
  const source = await getDocument(env, sourceId);
  if (!source) return null;
  const now = Date.now();
  const content = await documentRoom(env, sourceId).exportCopy(
    onlyTabId,
    redactAuthorsFor,
    redactForCommunity,
  );
  if (!content) return null;
  // The copy's row, and the placement grants it carries (docs/specs/009-elements/images.md): the copy may serve
  // what its source could, so its images keep rendering once its own push names them. The copy carries the
  // source's recorded creation intent, read in the same statement, never re-derived
  // (docs/specs/013-workspace/default-folders.md "Recorded intent").
  await env.DB.batch([
    env.DB.prepare(
      `INSERT INTO documents (id, owner_id, name, shareable, folder_id, saved_at, created_at, ${INTENT_COLS})
       SELECT ?, ?, ?, 0, NULL, ?, ?, ${INTENT_COLS} FROM documents WHERE id = ?`,
    ).bind(newId, newOwnerId, newName, now, now, sourceId),
    ...imageGrantCopyStatements(env, sourceId, newId, copyImageIds(content), now),
  ]);
  await documentRoom(env, newId).importCopy(content);
  return await getDocument(env, newId);
}
// docs/specs/014-identity/transactional-email.md (#6): total documents owned by `ownerId`, for the milestone check on
// create. Counts all of an owner's documents (a cheap indexed COUNT).
export async function countDocumentsByOwner(env: Env, ownerId: string): Promise<number> {
  const row = await env.DB.prepare('SELECT COUNT(*) AS n FROM documents WHERE owner_id = ?')
    .bind(ownerId)
    .first<{ n: number }>();
  return row?.n ?? 0;
}

// docs/specs/014-identity/transactional-email.md (#1) throttle: claim the right to email the owner about a new comment
// on this document, at most once per window. Atomic conditional UPDATE so a burst
// of concurrent comment saves can't each fire an email. `cutoff` = now - window;
// returns false when we already emailed within the window.
export async function claimCommentNotify(
  env: Env,
  documentId: string,
  now: number,
  cutoff: number,
): Promise<boolean> {
  const res = await env.DB.prepare(
    'UPDATE documents SET comment_notified_at = ? WHERE id = ? AND (comment_notified_at IS NULL OR comment_notified_at < ?)',
  )
    .bind(now, documentId, cutoff)
    .run();
  return res.meta.changes === 1;
}

// docs/specs/014-identity/profile-and-email-notifications.md (a) throttle: claim the right to email the owner that
// someone joined this document, at most once per window. The same atomic conditional UPDATE as
// claimCommentNotify, on its own column, so a join and a comment never spend each other's window.
export async function claimJoinNotify(
  env: Env,
  documentId: string,
  now: number,
  cutoff: number,
): Promise<boolean> {
  const res = await env.DB.prepare(
    'UPDATE documents SET join_notified_at = ? WHERE id = ? AND (join_notified_at IS NULL OR join_notified_at < ?)',
  )
    .bind(now, documentId, cutoff)
    .run();
  return res.meta.changes === 1;
}
