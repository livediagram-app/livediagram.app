// account — owner-wide deletion + guest->authed owner-id migration.
// These touch every table keyed (directly or via document_id) on an
// owner, so they live together rather than under any one resource.

import { deleteTimelineForOwner, migrateTimelineOwner } from './timeline';
import { deleteCollabIndexForOwner, recordOwnerAlias } from './collab-index';
import { deleteDocumentOpensForOwner, migrateDocumentOpens } from './document-opens';
import { thumbnailKey } from './documents';
import { documentRemovalStatements } from './document-removal';
import { detachUserFromTeams } from './teams';
import { disconnectDrive } from '../drive/disconnect';
import { uniqueLibraryName } from '@livediagram/api-schema';
import type { Env } from '../types';

// R2 batch delete takes at most 1000 keys per call. An owner has no hard
// cap on document count, so chunk the snapshot-key deletes to stay under
// it (the image delete above relies on the per-owner gallery cap instead).
const R2_DELETE_CHUNK = 1000;

// Wipe every row belonging to a given owner: every owner-keyed table in
// docs/specs/015-api/api.md "Owner-keyed data", AND the R2 image bytes
// (docs/specs/009-elements/images.md). account-owner-columns.test.ts holds
// both functions here to that list against the real schema. Called from
// DELETE /api/account when the user opts in via the "Delete account"
// dialog. The documents go through documentRemovalStatements, which drops
// the tabs (and their history) no other owner's document still holds;
// share links and the other per-document rows cascade from `documents.id`.
// Folders carry their own owner_id and need their
// own DELETE. Participants are owner-less in the schema but their id
// IS the owner id, so a single id-match delete clears the display-
// name / colour row too. Images carry owner_id on their D1 row and
// the R2 object key matches the row id, so we enumerate before the
// D1 wipe + bulk-delete from R2 + then drop the rows.
//
// Returns `{ documents, folders, images }` change counts for the
// caller's log line. Idempotent: re-running with the same owner id is a
// no-op once the rows are gone.
export async function deleteAccount(
  env: Env,
  ownerId: string,
): Promise<{ documents: number; folders: number; images: number }> {
  // Teams first (docs/specs/013-workspace/teams.md/35): transfer the user's team-library documents
  // to a remaining member, drop their memberships (promoting a new
  // admin when they were the last one), and delete teams they were the
  // last joined member of. MUST run before the documents DELETE below —
  // that wipe would otherwise destroy shared team work, and the dead
  // Clerk id would linger as a ghost (or sole-admin-blocking) member.
  await detachUserFromTeams(env, ownerId);
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
  // Document SVG snapshots (docs/specs/006-document/document-snapshots.md) live in R2 under thumb/<documentId>,
  // keyed off the document id rather than carried on a D1 row, so — like
  // the images above — the cascade can't reach them. Enumerate the
  // owner's document ids while the rows still exist, then bulk-delete
  // their snapshot objects before the documents DELETE drops the ids.
  if (env.IMAGES) {
    const documentRows = await env.DB.prepare('SELECT id FROM documents WHERE owner_id = ?')
      .bind(ownerId)
      .all<{ id: string }>();
    const thumbKeys = (documentRows.results ?? []).map((r) => thumbnailKey(r.id));
    for (let i = 0; i < thumbKeys.length; i += R2_DELETE_CHUNK) {
      await env.IMAGES.delete(thumbKeys.slice(i, i + R2_DELETE_CHUNK));
    }
  }
  // Link-aware (docs/specs/006-document/tab-document-many-to-many.md): a tab
  // shared into a document someone else owns stays there.
  const removal = await env.DB.batch(
    documentRemovalStatements(env, { column: 'owner_id', value: ownerId }),
  );
  const documentsRes = removal[removal.length - 1]!;
  // Personal folders only. A team folder carries its creator's owner_id but
  // belongs to the team (access is by membership), and teammates' documents
  // sit in it: deleting it dropped them out of the team library behind a
  // dangling folder_id. That includes teams this user LEFT earlier, which
  // detachUserFromTeams no longer sees.
  const foldersRes = await env.DB.prepare(
    'DELETE FROM folders WHERE owner_id = ? AND team_id IS NULL',
  )
    .bind(ownerId)
    .run();
  await env.DB.prepare('DELETE FROM participants WHERE id = ?').bind(ownerId).run();
  // user_preferences (docs/specs/007-editor/user-preferences.md) holds this owner's editor preference
  // flags (some surfaced in the Settings dialog, some attached to
  // per-tool surfaces like the pencil's recognise-shapes toggle).
  // Wipe along with everything else so a delete-account run leaves
  // no row carrying their flags.
  await env.DB.prepare('DELETE FROM user_preferences WHERE owner_id = ?').bind(ownerId).run();
  // custom_themes (docs/specs/011-theme/custom-themes.md): this owner's saved themes go too.
  await env.DB.prepare('DELETE FROM custom_themes WHERE owner_id = ?').bind(ownerId).run();
  // shape_libraries (docs/specs/013-workspace/shape-libraries.md): this owner's libraries go too.
  await env.DB.prepare('DELETE FROM shape_libraries WHERE owner_id = ?').bind(ownerId).run();
  // api_tokens (docs/specs/015-api/public-api-and-tokens.md): no API credential outlives the account.
  await env.DB.prepare('DELETE FROM api_tokens WHERE owner_id = ?').bind(ownerId).run();
  // email_lifecycle (docs/specs/014-identity/transactional-email.md): drop the onboarding-email row so the address
  // isn't retained and a re-signup starts the series fresh.
  await env.DB.prepare('DELETE FROM email_lifecycle WHERE owner_id = ?').bind(ownerId).run();
  // auth_accounts (docs/specs/017-telemetry/telemetry.md): the first-seen row the sign-up count keys on.
  await env.DB.prepare('DELETE FROM auth_accounts WHERE owner_id = ?').bind(ownerId).run();
  // Google Drive mirror (docs/specs/022-drive-mirror/drive-mirror.md): revoke the grant
  // at Google and drop the connection and every mirror row. The Drive files are
  // the user's and stay.
  await disconnectDrive(env, ownerId);
  // shared_with rows POINTING AT this owner's documents die with the
  // documents (FK cascade), but the rows this owner accumulated by
  // visiting OTHER people's documents are keyed on their owner_id and
  // need their own DELETE — same table migrateOwnerId already handles.
  await env.DB.prepare('DELETE FROM shared_with WHERE owner_id = ?').bind(ownerId).run();
  // favourites (docs/specs/013-workspace/favourites.md): the same split as
  // shared_with. Stars on this owner's documents cascade; the stars they put on
  // teammates' and other people's documents are theirs and go here.
  await env.DB.prepare('DELETE FROM favourites WHERE owner_id = ?').bind(ownerId).run();
  // placement_defaults (docs/specs/013-workspace/default-folders.md): no foreign key reaches them.
  await env.DB.prepare('DELETE FROM placement_defaults WHERE owner_id = ?').bind(ownerId).run();
  // timeline (docs/specs/013-workspace/timeline.md §3.5): the feed, the events this owner authored,
  // and the scope-state row. Hard, not soft — soft delete is a
  // user-facing affordance in this product, never a retention strategy.
  await deleteTimelineForOwner(env, ownerId);
  // Activity (docs/specs/013-workspace/activity-page.md): the alias rows + the backfill stamp. The index
  // rows themselves went with the tabs documentRemovalStatements dropped above.
  await deleteCollabIndexForOwner(env, ownerId);
  // Explorer Home (docs/specs/013-workspace/explorer-home.md "Opens"): this owner's opens. Other
  // people's opens of this owner's documents went with the documents (foreign key cascade);
  // the document_opened events went with deleteTimelineForOwner above.
  await deleteDocumentOpensForOwner(env, ownerId);
  return {
    documents: documentsRes.meta.changes ?? 0,
    folders: foldersRes.meta.changes ?? 0,
    images: imagesRes.meta.changes ?? 0,
  };
}

// Owner-id migration. Reassigns every guest-holdable owner-keyed row
// (docs/specs/015-api/api.md "Owner-keyed data") from `fromOwnerId` to
// `toOwnerId`. Called
// from POST /api/migrate when a guest signs up: their localStorage
// participant id moves to their Clerk userId so the new account sees
// the documents, folders, shared-with-them list, editor preferences,
// AND uploaded images they built as a guest.
//
// shared_with's primary key is (owner_id, document_id), so a naive
// UPDATE could PK-collide if the visitor accepted the same share
// link both as a guest AND, later in the same session, as Clerk
// (recordSharedAccess upserts a row each time). INSERT OR IGNORE
// then DELETE handles both cases in one shot: copy guest rows to
// the Clerk userId, skip rows where (clerkId, documentId) already
// exists, then drop every leftover guest row. The skipped Clerk
// rows keep the role + last_seen they already had (which is the
// more recent of the two paths the user actually used).
//
// images has a UNIQUE (owner_id, sha256) index that drives the
// dedupe. UPDATE OR IGNORE skips rows whose sha256 already exists
// on the Clerk side (the user uploaded the same bytes under both
// identities). The skipped guest row stays at fromOwnerId; the
// formerly-guest documents (now Clerk-owned) still resolve those
// image ids via the document-reference fallback in GET
// /api/images/:id (docs/specs/009-elements/images.md), so the canvas keeps rendering them.
// Only the gallery list filters by owner_id, so the dedupe loser
// stops showing up there, which is the right outcome (the Clerk
// twin is identical bytes anyway).
//
// Other tables (`share_links`, `tabs`) don't carry
// their own owner_id, they link via `document_id` which is
// owner-bound, so updating the documents cascade-fixes them
// implicitly.
//
// Returns `{ documents, folders, shared, images }`. Idempotent:
// re-running with the same `fromOwnerId` is a no-op once the rows
// have moved.
export async function migrateOwnerId(
  env: Env,
  fromOwnerId: string,
  toOwnerId: string,
): Promise<{ documents: number; folders: number; shared: number; images: number }> {
  const documentsRes = await env.DB.prepare('UPDATE documents SET owner_id = ? WHERE owner_id = ?')
    .bind(toOwnerId, fromOwnerId)
    .run();
  const foldersRes = await env.DB.prepare('UPDATE folders SET owner_id = ? WHERE owner_id = ?')
    .bind(toOwnerId, fromOwnerId)
    .run();
  const sharedInsertRes = await env.DB.prepare(
    `INSERT OR IGNORE INTO shared_with (owner_id, document_id, role, last_seen)
     SELECT ?, document_id, role, last_seen
     FROM shared_with
     WHERE owner_id = ?`,
  )
    .bind(toOwnerId, fromOwnerId)
    .run();
  await env.DB.prepare('DELETE FROM shared_with WHERE owner_id = ?').bind(fromOwnerId).run();
  // user_preferences (docs/specs/007-editor/user-preferences.md): same INSERT OR IGNORE pattern as
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
  // favourites (docs/specs/013-workspace/favourites.md): the primary key is
  // (owner_id, document_id), and both identities may have starred the same
  // document, so INSERT OR IGNORE then DELETE like shared_with. A collision
  // keeps the account's star and its original created_at.
  await env.DB.prepare(
    `INSERT OR IGNORE INTO favourites (owner_id, document_id, created_at)
     SELECT ?, document_id, created_at
     FROM favourites
     WHERE owner_id = ?`,
  )
    .bind(toOwnerId, fromOwnerId)
    .run();
  await env.DB.prepare('DELETE FROM favourites WHERE owner_id = ?').bind(fromOwnerId).run();
  // placement_defaults (docs/specs/013-workspace/default-folders.md): the primary key is
  // (owner_id, default_key), so INSERT OR IGNORE then DELETE: where both identities set a default
  // for one key, the account's stays. The guest's folders move above, so its defaults stay valid.
  await env.DB.prepare(
    `INSERT OR IGNORE INTO placement_defaults (owner_id, default_key, folder_id, updated_at)
     SELECT ?, default_key, folder_id, updated_at
     FROM placement_defaults
     WHERE owner_id = ?`,
  )
    .bind(toOwnerId, fromOwnerId)
    .run();
  await env.DB.prepare('DELETE FROM placement_defaults WHERE owner_id = ?').bind(fromOwnerId).run();
  // participants: the guest's name and colour. The id IS the owner id, so an
  // account that already has a row keeps it (a signed-in name comes from Clerk
  // anyway); the guest row goes, since nothing reads a retired guest id.
  await env.DB.prepare(
    `INSERT OR IGNORE INTO participants (id, name, color, created_at)
     SELECT ?, name, color, created_at
     FROM participants
     WHERE id = ?`,
  )
    .bind(toOwnerId, fromOwnerId)
    .run();
  await env.DB.prepare('DELETE FROM participants WHERE id = ?').bind(fromOwnerId).run();
  // timeline (docs/specs/013-workspace/timeline.md §9): a week of drawing as a guest is history
  // worth keeping, so the feed, the authored events, and the
  // scope-state row all follow the user to their new account. The
  // scope-state row matters as much as the events: without it the
  // backfill would run again against the Clerk id and re-seed what
  // just migrated.
  await migrateTimelineOwner(env, fromOwnerId, toOwnerId);
  // Activity (docs/specs/013-workspace/activity-page.md §2.2): the ids INSIDE the tab blobs (comment
  // authors, self-assigned actions) are not rewritten, so the old
  // identity is recorded as an alias of the new one and the Activity
  // read matches both. Cheaper and safer than touching every tab.
  await recordOwnerAlias(env, toOwnerId, fromOwnerId);
  // Explorer Home (docs/specs/013-workspace/explorer-home.md "Opens"): the guest's opens follow
  // them, and a document opened under both identities keeps both histories.
  const opens = await migrateDocumentOpens(env, fromOwnerId, toOwnerId);
  console.info(`home: opens-migrated moved=${opens.moved} merged=${opens.merged}`);
  // images (docs/specs/009-elements/images.md). UPDATE OR IGNORE walks the unique (owner_id,
  // sha256) collision case (same bytes on both identities) and
  // leaves those guest rows in place so the image id stays
  // resolvable by every formerly-guest document that references it.
  const imagesRes = await env.DB.prepare(
    'UPDATE OR IGNORE images SET owner_id = ? WHERE owner_id = ?',
  )
    .bind(toOwnerId, fromOwnerId)
    .run();
  // custom_themes (docs/specs/011-theme/custom-themes.md): move the guest's saved themes onto the
  // authed identity so the documents that reference them keep their look
  // after sign-up. Plain UPDATE — the id is the PK (no per-owner unique
  // constraint to collide on), so no OR IGNORE needed.
  await env.DB.prepare('UPDATE custom_themes SET owner_id = ? WHERE owner_id = ?')
    .bind(toOwnerId, fromOwnerId)
    .run();
  await migrateShapeLibraries(env, fromOwnerId, toOwnerId);
  return {
    documents: documentsRes.meta.changes ?? 0,
    folders: foldersRes.meta.changes ?? 0,
    shared: sharedInsertRes.meta.changes ?? 0,
    images: imagesRes.meta.changes ?? 0,
  };
}

// shape_libraries (docs/specs/013-workspace/shape-libraries.md): the guest's libraries move onto the
// account; one whose name the account already uses takes the next free " (n)" first, so the account
// never holds two libraries of one name. The cap applies to creates, never to this move.
async function migrateShapeLibraries(env: Env, fromOwnerId: string, toOwnerId: string) {
  const names = async (owner: string) =>
    (
      await env.DB.prepare(
        'SELECT id, name FROM shape_libraries WHERE owner_id = ? ORDER BY created_at',
      )
        .bind(owner)
        .all<{ id: string; name: string }>()
    ).results ?? [];
  const guest = await names(fromOwnerId);
  if (guest.length === 0) return;
  const taken = (await names(toOwnerId)).map((r) => r.name);
  let renamed = 0;
  for (const row of guest) {
    const name = uniqueLibraryName(row.name, taken);
    taken.push(name);
    if (name === row.name) continue;
    renamed++;
    await env.DB.prepare('UPDATE shape_libraries SET name = ? WHERE id = ?')
      .bind(name, row.id)
      .run();
  }
  await env.DB.prepare('UPDATE shape_libraries SET owner_id = ? WHERE owner_id = ?')
    .bind(toOwnerId, fromOwnerId)
    .run();
  console.info('[shape-libraries] migrated', { moved: guest.length, renamed });
}
