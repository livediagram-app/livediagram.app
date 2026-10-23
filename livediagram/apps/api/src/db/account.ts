// account — owner-wide deletion + guest->authed owner-id migration.
// These touch every table keyed (directly or via document_id) on an
// owner, so they live together rather than under any one resource.

import { deleteTimelineForOwner, migrateTimelineOwner } from './timeline';
import { deleteCollabIndexForOwner, recordOwnerAlias } from './collab-index';
import { deleteDocumentOpensForOwner, migrateDocumentOpens } from './document-opens';
import { snapshotKeys } from './documents';
import { documentRemovalStatements } from './document-removal';
import { purgeRooms } from '../room-purge-client';
import { detachUserFromTeams } from './teams';
import { imageGrantOwnerChangeStatement } from './image-grants';
import { disconnectDrive } from '../drive/disconnect';
import { mediaClient, mediaOwner } from '../media';
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
// dialog. The documents go through documentRemovalStatements, and their content with each document's own
// Durable Object (purgeRooms); share links and the other per-document rows cascade from `documents.id`.
// Folders carry their own owner_id and need their
// own DELETE. Images carry owner_id on their D1 row and
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
  // account id would linger as a ghost (or sole-admin-blocking) member.
  await detachUserFromTeams(env, ownerId);
  // Their images in liveworkspace's media service, from every app (src/media.ts). First, so a failure
  // leaves the account whole to delete again.
  const media = mediaClient(env);
  let mediaDeleted = 0;
  if (media) {
    const forgotten = await media.forgetOwner(await mediaOwner(ownerId));
    if (!forgotten.ok)
      throw new Error(`media: deleting the owner's images answered ${forgotten.status}`);
    mediaDeleted = forgotten.value.deleted;
  }
  await env.DB.prepare('DELETE FROM media_images WHERE owner_id = ?').bind(ownerId).run();
  // Document SVG snapshots (docs/specs/006-document/document-snapshots.md) live in R2 under thumb/<documentId>,
  // keyed off the document id rather than carried on a D1 row, so — the cascade can't reach them. Enumerate the
  // owner's document ids while the rows still exist, then bulk-delete
  // their snapshot objects before the documents DELETE drops the ids.
  const documentRows = await env.DB.prepare('SELECT id FROM documents WHERE owner_id = ?')
    .bind(ownerId)
    .all<{ id: string }>();
  const documentIds = (documentRows.results ?? []).map((r) => r.id);
  if (env.IMAGES) {
    const thumbKeys = documentIds.flatMap(snapshotKeys);
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
  // Their rooms' storage goes with them (the ledger keeps comment and idea text). Best effort.
  await purgeRooms(env, documentIds);
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
  // Their name, colour and preferences are liveworkspace's (src/liveworkspace/), and go when the route
  // closes the account there, with what liveworkspace kept of their sign-up and milestones here.
  // shape_libraries (docs/specs/013-workspace/shape-libraries.md): this owner's libraries go too.
  await env.DB.prepare('DELETE FROM shape_libraries WHERE owner_id = ?').bind(ownerId).run();
  // Workbench rows (docs/specs/013-workspace/workbench-embeds.md), before the tokens they were minted from.
  await env.DB.batch(
    [
      'workbench_sessions',
      'workbench_tickets',
      'workbench_pairings',
      'workbench_pairing_requests',
    ].map((table) => env.DB.prepare(`DELETE FROM ${table} WHERE owner_id = ?`).bind(ownerId)),
  );
  // api_tokens (docs/specs/015-api/public-api-and-tokens.md): no API credential outlives the account.
  await env.DB.prepare('DELETE FROM api_tokens WHERE owner_id = ?').bind(ownerId).run();
  // notify_email_claims (docs/specs/012-collaboration/comment-mentions.md "The email"): the claims of the
  // mention and action-assigned emails they sent. Hashes only, but keyed on their id.
  await env.DB.prepare('DELETE FROM notify_email_claims WHERE sender_id = ?').bind(ownerId).run();
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
  // agent_changesets (docs/specs/024-agents/agent-changesets.md, CS27): those on their own documents went with
  // the documents. The ones they wrote on other people's are in those documents' own stores now (each document's
  // Durable Object), out of reach of one D1 statement; they age out with the 30-day changeset retention there.
  // Community posts (docs/specs/025-community/community.md): the links of their own posts went with their
  // documents; this closes one whose document outlives them (moved to a team), so nothing stays published under a
  // deleted account. A post whose link is gone is gone: the Community sync tells the service, which deletes it with
  // its likes, copies and reports. The copies they took of other people's posts are forgotten by the account route
  // (forgetCommunityCopier), since the service keeps them.
  await env.DB.prepare(
    `DELETE FROM share_links WHERE purpose = 'community'
       AND code IN (SELECT share_code FROM community_links WHERE author_id = ?)`,
  )
    .bind(ownerId)
    .run();
  // timeline (docs/specs/013-workspace/timeline.md §3.5): the feed, the events this owner authored,
  // and the scope-state row. Hard, not soft — soft delete is a
  // user-facing affordance in this product, never a retention strategy.
  await deleteTimelineForOwner(env, ownerId);
  // Activity (docs/specs/013-workspace/inbox.md): the alias rows. The index rows themselves went with the
  // documents documentRemovalStatements dropped above.
  await deleteCollabIndexForOwner(env, ownerId);
  // Explorer Home (docs/specs/013-workspace/explorer-home.md "Opens"): this owner's opens. Other
  // people's opens of this owner's documents went with the documents (foreign key cascade);
  // the document_opened events went with deleteTimelineForOwner above.
  await deleteDocumentOpensForOwner(env, ownerId);
  return {
    documents: documentsRes.meta.changes ?? 0,
    folders: foldersRes.meta.changes ?? 0,
    images: mediaDeleted,
  };
}

// Owner-id migration. Reassigns every guest-holdable owner-keyed row
// (docs/specs/015-api/api.md "Owner-keyed data") from `fromOwnerId` to
// `toOwnerId`. Called
// from POST /api/migrate when a guest signs up: their localStorage
// participant id moves to their account id so the new account sees
// the documents, folders, shared-with-them list AND uploaded images they
// built as a guest. Their name, colour and preferences are liveworkspace's;
// the route moves those (liveworkspace/guest-merge.ts).
//
// shared_with's primary key is (owner_id, document_id), so a naive
// UPDATE could PK-collide if the visitor accepted the same share
// link both as a guest AND, later in the same session, signed in
// (recordSharedAccess upserts a row each time). INSERT OR IGNORE
// then DELETE handles both cases in one shot: copy guest rows to
// the account id, skip rows where (accountId, documentId) already
// exists, then drop every leftover guest row. The skipped account
// rows keep the role + last_seen they already had (which is the
// more recent of the two paths the user actually used).
//
// Before the documents move, every guest image those documents place is granted to them, in the same
// batch (docs/specs/009-elements/images.md "Placement grants"), so the canvas keeps rendering them.
//
// Other tables (`share_links`, `document_images`) don't carry
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
  // One batch: one round trip, and all or nothing, where it was a round trip per statement and a failure
  // part-way left a half-moved account. No foreign key reads an owner column, so only each table's own order
  // matters, and the batch keeps it: the grant before the documents move (it joins the guest's documents),
  // each INSERT OR IGNORE copy before its DELETE, and the copy counts recounted after the copies move.
  const now = Date.now();
  // The guest's images in liveworkspace's media service become the account's (src/media.ts). First, so a
  // failure leaves the guest whole to migrate again; the merge is idempotent.
  const media = mediaClient(env);
  let mediaMoved = 0;
  if (media) {
    const merged = await media.mergeOwner(
      await mediaOwner(fromOwnerId),
      await mediaOwner(toOwnerId),
    );
    if (!merged.ok) throw new Error(`media: merging the guest's images answered ${merged.status}`);
    mediaMoved = merged.value.moved.length;
  }
  const move = (sql: string, ...binds: unknown[]) => env.DB.prepare(sql).bind(...binds);
  const statements = {
    // The grant first, while the guest still owns the documents: an image left on the guest id by the
    // dedupe below keeps serving in them.
    grant: imageGrantOwnerChangeStatement(env, 'd.owner_id = ?2', [fromOwnerId], now),
    documents: move('UPDATE documents SET owner_id = ? WHERE owner_id = ?', toOwnerId, fromOwnerId),
    folders: move('UPDATE folders SET owner_id = ? WHERE owner_id = ?', toOwnerId, fromOwnerId),
    // tab_id carried too: a tab-scoped visit (docs/specs/013-workspace/tab-scoped-share-links.md) stays
    // scoped to its tab once its visitor signs up; a NULL would read as an All-tabs visit.
    shared: move(
      `INSERT OR IGNORE INTO shared_with (owner_id, document_id, role, level, last_seen, tab_id, share_code)
       SELECT ?, document_id, role, level, last_seen, tab_id, share_code
       FROM shared_with
       WHERE owner_id = ?`,
      toOwnerId,
      fromOwnerId,
    ),
    sharedDrop: move('DELETE FROM shared_with WHERE owner_id = ?', fromOwnerId),
    // A visit is to someone else's document. The guest may have visited one the account owns, and
    // the account may have visited one the guest owned (now the account's): either way the visit
    // would list the account's own document under its "Shared with you", so drop it.
    sharedOwn: move(
      `DELETE FROM shared_with WHERE owner_id = ?1
         AND document_id IN (SELECT id FROM documents WHERE owner_id = ?1)`,
      toOwnerId,
    ),
    // favourites (docs/specs/013-workspace/favourites.md): the primary key is
    // (owner_id, document_id), and both identities may have starred the same
    // document, so INSERT OR IGNORE then DELETE like shared_with. A collision
    // keeps the account's star and its original created_at.
    favourites: move(
      `INSERT OR IGNORE INTO favourites (owner_id, document_id, created_at)
       SELECT ?, document_id, created_at
       FROM favourites
       WHERE owner_id = ?`,
      toOwnerId,
      fromOwnerId,
    ),
    favouritesDrop: move('DELETE FROM favourites WHERE owner_id = ?', fromOwnerId),
    // placement_defaults (docs/specs/013-workspace/default-folders.md): the primary key is
    // (owner_id, default_key), so INSERT OR IGNORE then DELETE: where both identities set a default
    // for one key, the account's stays. The guest's folders move above, so its defaults stay valid.
    placement: move(
      `INSERT OR IGNORE INTO placement_defaults (owner_id, default_key, folder_id, updated_at)
       SELECT ?, default_key, folder_id, updated_at
       FROM placement_defaults
       WHERE owner_id = ?`,
      toOwnerId,
      fromOwnerId,
    ),
    placementDrop: move('DELETE FROM placement_defaults WHERE owner_id = ?', fromOwnerId),
    // Community copies (docs/specs/025-community/community.md "Likes") are the Community service's: the migrate
    // route moves the guest's to the account there (mergeCommunityCopier).
    // media_images (src/media.ts): after the grant above, which reads it. Every one moves, those the
    // service kept on the guest too (the account already had those bytes): the grant keeps them served
    // in the guest's documents, and the bytes are read by id.
    mediaImages: move(
      'UPDATE media_images SET owner_id = ? WHERE owner_id = ?',
      toOwnerId,
      fromOwnerId,
    ),
    // agent_changesets (docs/specs/024-agents/agent-changesets.md, CS27) are each document's own now (its Durable
    // Object): a guest's stay under the guest id there until they age out (30 days).
  };
  const keys = Object.keys(statements) as (keyof typeof statements)[];
  const results = await env.DB.batch(keys.map((key) => statements[key]));
  const changes = (key: keyof typeof statements) => results[keys.indexOf(key)]?.meta.changes ?? 0;
  // timeline (docs/specs/013-workspace/timeline.md §9): a week of drawing as a guest is history
  // worth keeping, so the feed, the authored events, and the
  // scope-state row all follow the user to their new account. The
  // scope-state row matters as much as the events: without it the
  // backfill would run again against the account id and re-seed what
  // just migrated.
  await migrateTimelineOwner(env, fromOwnerId, toOwnerId);
  // Activity (docs/specs/013-workspace/inbox.md §2.2): the ids INSIDE the tab blobs (comment
  // authors, self-assigned actions) are not rewritten, so the old
  // identity is recorded as an alias of the new one and the Activity
  // read matches both. Cheaper and safer than touching every tab.
  await recordOwnerAlias(env, toOwnerId, fromOwnerId);
  // Explorer Home (docs/specs/013-workspace/explorer-home.md "Opens"): the guest's opens follow
  // them, and a document opened under both identities keeps both histories.
  const opens = await migrateDocumentOpens(env, fromOwnerId, toOwnerId);
  console.info(`home: opens-migrated moved=${opens.moved} merged=${opens.merged}`);
  await migrateShapeLibraries(env, fromOwnerId, toOwnerId);
  return {
    documents: changes('documents'),
    folders: changes('folders'),
    shared: changes('shared'),
    images: mediaMoved,
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
