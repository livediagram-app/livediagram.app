// account — owner-wide deletion + guest->authed owner-id migration.
// These touch every table keyed (directly or via project_id) on an
// owner, so they live together rather than under any one resource.

import { deleteTimelineForOwner, migrateTimelineOwner } from './timeline';
import { deleteCollabIndexForOwner, recordOwnerAlias } from './collab-index';
import { deleteProjectOpensForOwner, migrateProjectOpens } from './project-opens';
import { snapshotKeys } from './projects';
import { projectRemovalStatements } from './project-removal';
import { purgeRooms } from '../room-purge-client';
import { detachUserFromTeams } from './teams';
import { migrateTagStatements } from './tags';
import type { Env } from '../types';

// R2 batch delete takes at most 1000 keys per call. An owner has no hard
// cap on project count, so chunk the snapshot-key deletes to stay under
// it.
const R2_DELETE_CHUNK = 1000;

// Wipe every row belonging to a given owner: every owner-keyed table in
// docs/specs/015-api/api.md "Owner-keyed data", AND the R2 snapshot objects
// (docs/specs/006-project/project-snapshots.md). account-owner-columns.test.ts holds
// both functions here to that list against the real schema. Called from
// DELETE /api/account when the user opts in via the "Delete account"
// dialog. The projects go through projectRemovalStatements, which drops
// the tabs (and their history) no other owner's project still holds;
// share links and the other per-project rows cascade from `projects.id`.
// Folders carry their own owner_id and need their
// own DELETE. Participants are owner-less in the schema but their id
// IS the owner id, so a single id-match delete clears the display-
// name / colour row too.
//
// Returns `{ projects, folders }` change counts for the
// caller's log line. Idempotent: re-running with the same owner id is a
// no-op once the rows are gone.
export async function deleteAccount(
  env: Env,
  ownerId: string,
): Promise<{ projects: number; folders: number }> {
  // Teams first (docs/specs/013-workspace/teams.md/35): transfer the user's team-library projects
  // to a remaining member, drop their memberships (promoting a new
  // admin when they were the last one), and delete teams they were the
  // last joined member of. MUST run before the projects DELETE below —
  // that wipe would otherwise destroy shared team work, and the dead
  // account id would linger as a ghost (or sole-admin-blocking) member.
  await detachUserFromTeams(env, ownerId);
  // Project SVG snapshots (docs/specs/006-project/project-snapshots.md) live in R2 under thumb/<projectId>,
  // keyed off the project id rather than carried on a D1 row, so the
  // cascade can't reach them. Enumerate the
  // owner's project ids while the rows still exist, then bulk-delete
  // their snapshot objects before the projects DELETE drops the ids.
  const projectRows = await env.DB.prepare('SELECT id FROM projects WHERE owner_id = ?')
    .bind(ownerId)
    .all<{ id: string }>();
  const projectIds = (projectRows.results ?? []).map((r) => r.id);
  if (env.SNAPSHOTS) {
    const thumbKeys = projectIds.flatMap(snapshotKeys);
    for (let i = 0; i < thumbKeys.length; i += R2_DELETE_CHUNK) {
      await env.SNAPSHOTS.delete(thumbKeys.slice(i, i + R2_DELETE_CHUNK));
    }
  }
  // Link-aware (docs/specs/006-project/tab-project-many-to-many.md): a tab
  // shared into a project someone else owns stays there.
  const removal = await env.DB.batch(
    projectRemovalStatements(env, { column: 'owner_id', value: ownerId }),
  );
  const projectsRes = removal[removal.length - 1]!;
  // Their rooms' storage goes with them (the ledger keeps comment and idea text). Best effort.
  await purgeRooms(env, projectIds);
  // Personal folders only. A team folder carries its creator's owner_id but
  // belongs to the team (access is by membership), and teammates' projects
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
  // email_lifecycle (docs/specs/014-identity/transactional-email.md): drop the onboarding-email row so the address
  // isn't retained and a re-signup starts the series fresh.
  await env.DB.prepare('DELETE FROM email_lifecycle WHERE owner_id = ?').bind(ownerId).run();
  // auth_accounts (docs/specs/017-telemetry/telemetry.md): the first-seen row the sign-up count keys on.
  await env.DB.prepare('DELETE FROM auth_accounts WHERE owner_id = ?').bind(ownerId).run();
  // notify_email_claims (docs/specs/012-collaboration/comment-mentions.md "The email"): the claims of the
  // mention and action-assigned emails they sent. Hashes only, but keyed on their id.
  await env.DB.prepare('DELETE FROM notify_email_claims WHERE sender_id = ?').bind(ownerId).run();
  // shared_with rows POINTING AT this owner's projects die with the
  // projects (FK cascade), but the rows this owner accumulated by
  // visiting OTHER people's projects are keyed on their owner_id and
  // need their own DELETE — same table migrateOwnerId already handles.
  await env.DB.prepare('DELETE FROM shared_with WHERE owner_id = ?').bind(ownerId).run();
  // favourites (docs/specs/013-workspace/favourites.md): the same split as
  // shared_with. Stars on this owner's projects cascade; the stars they put on
  // teammates' and other people's projects are theirs and go here.
  await env.DB.prepare('DELETE FROM favourites WHERE owner_id = ?').bind(ownerId).run();
  // tags (docs/specs/013-workspace/tags.md): every tag they made; the links, on anyone's projects, cascade.
  await env.DB.prepare('DELETE FROM tags WHERE owner_id = ?').bind(ownerId).run();
  // form_reads (docs/specs/030-forms/forms.md "Hearing about responses"): what they had seen of other people's forms;
  // reads of forms on their own projects cascade with the projects.
  await env.DB.prepare('DELETE FROM form_reads WHERE owner_id = ?').bind(ownerId).run();
  // placement_defaults (docs/specs/013-workspace/default-folders.md): no foreign key reaches them.
  await env.DB.prepare('DELETE FROM placement_defaults WHERE owner_id = ?').bind(ownerId).run();
  // agent_changesets (docs/specs/024-agents/agent-changesets.md, CS27): the ones they wrote on other
  // people's projects; those on their own went with the projects. Parts follow by cascade.
  await env.DB.prepare('DELETE FROM agent_changesets WHERE author_id = ?').bind(ownerId).run();
  // timeline (docs/specs/013-workspace/timeline.md §3.5): the feed, the events this owner authored,
  // and the scope-state row. Hard, not soft — soft delete is a
  // user-facing affordance in this product, never a retention strategy.
  await deleteTimelineForOwner(env, ownerId);
  // Activity (docs/specs/013-workspace/inbox.md): the alias rows + the backfill stamp. The index
  // rows themselves went with the tabs projectRemovalStatements dropped above.
  await deleteCollabIndexForOwner(env, ownerId);
  // Explorer Home (docs/specs/013-workspace/explorer-home.md "Opens"): this owner's opens. Other
  // people's opens of this owner's projects went with the projects (foreign key cascade);
  // the project_opened events went with deleteTimelineForOwner above.
  await deleteProjectOpensForOwner(env, ownerId);
  return {
    projects: projectsRes.meta.changes ?? 0,
    folders: foldersRes.meta.changes ?? 0,
  };
}

// Owner-id migration. Reassigns every guest-holdable owner-keyed row
// (docs/specs/015-api/api.md "Owner-keyed data") from `fromOwnerId` to
// `toOwnerId`. Called
// from POST /api/migrate when a guest signs up: their localStorage
// participant id moves to their account id so the new account sees
// the projects, folders, shared-with-them list and editor preferences
// they built as a guest.
//
// shared_with's primary key is (owner_id, project_id), so a naive
// UPDATE could PK-collide if the visitor accepted the same share
// link both as a guest AND, later in the same session, signed in
// (recordSharedAccess upserts a row each time). INSERT OR IGNORE
// then DELETE handles both cases in one shot: copy guest rows to
// the account id, skip rows where (clerkId, projectId) already
// exists, then drop every leftover guest row. The skipped account
// rows keep the role + last_seen they already had (which is the
// more recent of the two paths the user actually used).
//
// Other tables (`share_links`, `tabs`) don't carry
// their own owner_id, they link via `project_id` which is
// owner-bound, so updating the projects cascade-fixes them
// implicitly.
//
// Returns `{ projects, folders, shared }`. Idempotent:
// re-running with the same `fromOwnerId` is a no-op once the rows
// have moved.
export async function migrateOwnerId(
  env: Env,
  fromOwnerId: string,
  toOwnerId: string,
): Promise<{ projects: number; folders: number; shared: number }> {
  // One batch: one round trip, and all or nothing, where it was a round trip per statement and a failure
  // part-way left a half-moved account. No foreign key reads an owner column, so only each table's own order
  // matters, and the batch keeps it: each INSERT OR IGNORE copy before its DELETE.
  const now = Date.now();
  const move = (sql: string, ...binds: unknown[]) => env.DB.prepare(sql).bind(...binds);
  const statements = {
    projects: move('UPDATE projects SET owner_id = ? WHERE owner_id = ?', toOwnerId, fromOwnerId),
    folders: move('UPDATE folders SET owner_id = ? WHERE owner_id = ?', toOwnerId, fromOwnerId),
    // tab_id carried too: a tab-scoped visit (docs/specs/013-workspace/tab-scoped-share-links.md) stays
    // scoped to its tab once its visitor signs up; a NULL would read as an All-tabs visit.
    shared: move(
      `INSERT OR IGNORE INTO shared_with (owner_id, project_id, role, level, last_seen, tab_id, share_code)
       SELECT ?, project_id, role, level, last_seen, tab_id, share_code
       FROM shared_with
       WHERE owner_id = ?`,
      toOwnerId,
      fromOwnerId,
    ),
    sharedDrop: move('DELETE FROM shared_with WHERE owner_id = ?', fromOwnerId),
    // A visit is to someone else's project. The guest may have visited one the account owns, and
    // the account may have visited one the guest owned (now the account's): either way the visit
    // would list the account's own project under its "Shared with you", so drop it.
    sharedOwn: move(
      `DELETE FROM shared_with WHERE owner_id = ?1
         AND project_id IN (SELECT id FROM projects WHERE owner_id = ?1)`,
      toOwnerId,
    ),
    // user_preferences (docs/specs/007-editor/user-preferences.md): same INSERT OR IGNORE pattern as
    // shared_with so an account id who somehow already had a row (an
    // earlier sign-in on a different device) keeps that authoritative
    // copy and the guest row gets dropped. Guest-only is the common
    // path; the existing-row case just stops the migration clobbering
    // intentional preferences with stale ones.
    prefs: move(
      `INSERT OR IGNORE INTO user_preferences (owner_id, prefs, updated_at)
       SELECT ?, prefs, updated_at
       FROM user_preferences
       WHERE owner_id = ?`,
      toOwnerId,
      fromOwnerId,
    ),
    prefsDrop: move('DELETE FROM user_preferences WHERE owner_id = ?', fromOwnerId),
    // favourites (docs/specs/013-workspace/favourites.md): the primary key is
    // (owner_id, project_id), and both identities may have starred the same
    // project, so INSERT OR IGNORE then DELETE like shared_with. A collision
    // keeps the account's star and its original created_at.
    favourites: move(
      `INSERT OR IGNORE INTO favourites (owner_id, project_id, created_at)
       SELECT ?, project_id, created_at
       FROM favourites
       WHERE owner_id = ?`,
      toOwnerId,
      fromOwnerId,
    ),
    favouritesDrop: move('DELETE FROM favourites WHERE owner_id = ?', fromOwnerId),
    // tags (docs/specs/013-workspace/tags.md "Tags follow the owner"): a guest tag whose name the account uses
    // merges into the account's, the rest move over.
    ...migrateTagStatements(env, fromOwnerId, toOwnerId),
    // form_reads (docs/specs/030-forms/forms.md): the primary key is (code, owner_id); where both identities read
    // one form, the account's row stays.
    formReads: move(
      `INSERT OR IGNORE INTO form_reads (code, owner_id, seen_number)
       SELECT code, ?, seen_number
       FROM form_reads
       WHERE owner_id = ?`,
      toOwnerId,
      fromOwnerId,
    ),
    formReadsDrop: move('DELETE FROM form_reads WHERE owner_id = ?', fromOwnerId),
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
    // participants: the guest's name and colour. The id IS the owner id, so an
    // account that already has a row keeps it (a signed-in name comes from the
    // account anyway). The copy is stamped NOW, never with the source's created_at: a row
    // older than GUEST_SIGNING_LIVE_AT marks a legacy id that may upgrade unsigned
    // (auth/guest-rest.ts isLegacyGuestEra), and the new id is a signed one, so
    // carrying the old date over would let anyone holding the new id move its data
    // without the signature. The guest row goes, since nothing reads a retired guest id.
    participant: move(
      `INSERT OR IGNORE INTO participants (id, name, color, created_at)
       SELECT ?, name, color, ?
       FROM participants
       WHERE id = ?`,
      toOwnerId,
      now,
      fromOwnerId,
    ),
    participantDrop: move('DELETE FROM participants WHERE id = ?', fromOwnerId),
    // custom_themes (docs/specs/011-theme/custom-themes.md): move the guest's saved themes onto the
    // authed identity so the projects that reference them keep their look
    // after sign-up. Plain UPDATE — the id is the PK (no per-owner unique
    // constraint to collide on), so no OR IGNORE needed.
    themes: move(
      'UPDATE custom_themes SET owner_id = ? WHERE owner_id = ?',
      toOwnerId,
      fromOwnerId,
    ),
    // agent_changesets (docs/specs/024-agents/agent-changesets.md, CS27): what they wrote and reverted
    // as a guest stays theirs.
    changesets: move(
      'UPDATE agent_changesets SET author_id = ? WHERE author_id = ?',
      toOwnerId,
      fromOwnerId,
    ),
  };
  const keys = Object.keys(statements) as (keyof typeof statements)[];
  const results = await env.DB.batch(keys.map((key) => statements[key]));
  const changes = (key: keyof typeof statements) => results[keys.indexOf(key)]?.meta.changes ?? 0;
  // timeline (docs/specs/013-workspace/timeline.md §9): a week of drawing as a guest is history
  // worth keeping, so the memberships, the authored events, and the
  // scope-state row (Home's unread mark) all follow the user to their new account.
  await migrateTimelineOwner(env, fromOwnerId, toOwnerId);
  // Activity (docs/specs/013-workspace/inbox.md §2.2): the ids INSIDE the tab blobs (comment
  // authors, self-assigned actions) are not rewritten, so the old
  // identity is recorded as an alias of the new one and the Activity
  // read matches both. Cheaper and safer than touching every tab.
  await recordOwnerAlias(env, toOwnerId, fromOwnerId);
  // Explorer Home (docs/specs/013-workspace/explorer-home.md "Opens"): the guest's opens follow
  // them, and a project opened under both identities keeps both histories.
  const opens = await migrateProjectOpens(env, fromOwnerId, toOwnerId);
  console.info(`home: opens-migrated moved=${opens.moved} merged=${opens.merged}`);
  return {
    projects: changes('projects'),
    folders: changes('folders'),
    shared: changes('shared'),
  };
}
