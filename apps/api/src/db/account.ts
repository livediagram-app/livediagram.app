// account — owner-wide deletion + guest->authed owner-id migration.
// These touch every table keyed (directly or via diagram_id) on an
// owner, so they live together rather than under any one resource.

import type { Env } from '../types';

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
  // user_preferences (spec/20) holds this owner's editor preference
  // flags (some surfaced in the Settings dialog, some attached to
  // per-tool surfaces like the pencil's recognise-shapes toggle).
  // Wipe along with everything else so a delete-account run leaves
  // no row carrying their flags.
  await env.DB.prepare('DELETE FROM user_preferences WHERE owner_id = ?').bind(ownerId).run();
  return {
    diagrams: diagramsRes.meta.changes ?? 0,
    folders: foldersRes.meta.changes ?? 0,
    images: imagesRes.meta.changes ?? 0,
  };
}

// Owner-id migration. Reassigns every `diagrams.owner_id`,
// `folders.owner_id`, `shared_with.owner_id`, `user_preferences.owner_id`,
// and `images.owner_id` row from `fromOwnerId` to `toOwnerId`. Called
// from POST /api/migrate when a guest signs up: their localStorage
// participant id moves to their Clerk userId so the new account sees
// the diagrams, folders, shared-with-them list, editor preferences,
// AND uploaded images they built as a guest.
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
// images has a UNIQUE (owner_id, sha256) index that drives the
// dedupe. UPDATE OR IGNORE skips rows whose sha256 already exists
// on the Clerk side (the user uploaded the same bytes under both
// identities). The skipped guest row stays at fromOwnerId; the
// formerly-guest diagrams (now Clerk-owned) still resolve those
// image ids via the diagram-reference fallback in GET
// /api/images/:id (spec/19), so the canvas keeps rendering them.
// Only the gallery list filters by owner_id, so the dedupe loser
// stops showing up there, which is the right outcome (the Clerk
// twin is identical bytes anyway).
//
// Other tables (`change_log`, `share_links`, `tabs`) don't carry
// their own owner_id, they link via `diagram_id` which is
// owner-bound, so updating the diagrams cascade-fixes them
// implicitly.
//
// Returns `{ diagrams, folders, shared, images }`. Idempotent:
// re-running with the same `fromOwnerId` is a no-op once the rows
// have moved.
export async function migrateOwnerId(
  env: Env,
  fromOwnerId: string,
  toOwnerId: string,
): Promise<{ diagrams: number; folders: number; shared: number; images: number }> {
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
  // user_preferences (spec/20): same INSERT OR IGNORE pattern as
  // shared_with so a Clerk userId who somehow already had a row (an
  // earlier sign-in on a different device) keeps that authoritative
  // copy and the guest row gets dropped. Guest-only is the common
  // path; the existing-row case just stops the migration clobbering
  // intentional preferences with stale ones.
  await env.DB.prepare(
    `INSERT OR IGNORE INTO user_preferences (owner_id, prefs, updated_at)
     SELECT ?, prefs, updated_at
     FROM user_preferences
     WHERE owner_id = ?`,
  )
    .bind(toOwnerId, fromOwnerId)
    .run();
  await env.DB.prepare('DELETE FROM user_preferences WHERE owner_id = ?').bind(fromOwnerId).run();
  // images (spec/19). UPDATE OR IGNORE walks the unique (owner_id,
  // sha256) collision case (same bytes on both identities) and
  // leaves those guest rows in place so the image id stays
  // resolvable by every formerly-guest diagram that references it.
  const imagesRes = await env.DB.prepare(
    'UPDATE OR IGNORE images SET owner_id = ? WHERE owner_id = ?',
  )
    .bind(toOwnerId, fromOwnerId)
    .run();
  return {
    diagrams: diagramsRes.meta.changes ?? 0,
    folders: foldersRes.meta.changes ?? 0,
    shared: sharedInsertRes.meta.changes ?? 0,
    images: imagesRes.meta.changes ?? 0,
  };
}
