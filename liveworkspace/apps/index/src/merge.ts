// A guest becoming an account (liveworkspace/docs/one-explorer-contracts.md "Becoming an account"):
// accounts calls this with its own key, and everything the guest had moves to the account in one batch. Each
// app is then told (person-merges.ts), so it moves what it keeps for the guest beside their items.
// Where the account already has the same thing (a tag of the same name, a favourite, a default), the
// account's stays. Running it again finds nothing left to move.

import { isMergeCaller } from './auth';
import { isId } from './codec';
import type { Env } from './env';
import { badRequest, json, notFound, readObject, unauthorized } from './http';
import { drainPersonMerges, recordPersonMerges } from './person-merges';

export async function handleMerge(
  request: Request,
  env: Env,
  waitUntil: (promise: Promise<unknown>) => void = (p) => void p,
): Promise<Response> {
  if (request.method !== 'POST') return notFound();
  if (!(await isMergeCaller(request, env))) return unauthorized();
  const body = await readObject(request);
  const guest = body?.guestId;
  const user = body?.userId;
  if (
    !isId(guest) ||
    !guest.startsWith('guest_') ||
    !isId(user) ||
    user.startsWith('guest_') ||
    guest === user
  ) {
    return badRequest();
  }
  const db = env.INDEX_DB;
  const personal = `p:${user}`;
  const results = await db.batch([
    // First, so the apps hear of it however the rest goes.
    recordPersonMerges(db, guest, user, Date.now()),
    db
      .prepare(
        `UPDATE items SET owner_id = ?, scope = CASE WHEN team_id IS NULL THEN ? ELSE scope END
         WHERE owner_id = ?`,
      )
      .bind(user, personal, guest),
    db
      .prepare(
        `UPDATE folders SET owner_id = ?, scope = CASE WHEN team_id IS NULL THEN ? ELSE scope END
         WHERE owner_id = ?`,
      )
      .bind(user, personal, guest),
    // A guest tag whose name the account already uses: its items take the account's tag.
    db
      .prepare(
        `INSERT OR IGNORE INTO item_tags (tag_id, item_id, created_at)
         SELECT u.id, it.item_id, it.created_at FROM tags g
         JOIN tags u ON u.owner_id = ? AND u.name = g.name COLLATE NOCASE
         JOIN item_tags it ON it.tag_id = g.id
         WHERE g.owner_id = ?`,
      )
      .bind(user, guest),
    db
      .prepare(
        `DELETE FROM tags WHERE owner_id = ? AND EXISTS (
           SELECT 1 FROM tags u WHERE u.owner_id = ? AND u.name = tags.name COLLATE NOCASE)`,
      )
      .bind(guest, user),
    db.prepare('UPDATE tags SET owner_id = ? WHERE owner_id = ?').bind(user, guest),
    db
      .prepare(
        `INSERT OR IGNORE INTO favourites (person_id, item_id, created_at)
         SELECT ?, item_id, created_at FROM favourites WHERE person_id = ?`,
      )
      .bind(user, guest),
    db.prepare('DELETE FROM favourites WHERE person_id = ?').bind(guest),
    db
      .prepare(
        `INSERT INTO opens (person_id, item_id, last_opened_at, hidden)
         SELECT ?, item_id, last_opened_at, hidden FROM opens WHERE person_id = ?
         ON CONFLICT (person_id, item_id) DO UPDATE
           SET last_opened_at = MAX(opens.last_opened_at, excluded.last_opened_at),
               hidden = MAX(opens.hidden, excluded.hidden)`,
      )
      .bind(user, guest),
    db.prepare('DELETE FROM opens WHERE person_id = ?').bind(guest),
    db
      .prepare(
        `INSERT OR IGNORE INTO use_days (person_id, item_id, day)
         SELECT ?, item_id, day FROM use_days WHERE person_id = ?`,
      )
      .bind(user, guest),
    db.prepare('DELETE FROM use_days WHERE person_id = ?').bind(guest),
    // The Timeline: what they did is the account's, and what they saw in their own space it sees.
    db
      .prepare('UPDATE OR IGNORE timeline_event_scopes SET scope = ? WHERE scope = ?')
      .bind(personal, `p:${guest}`),
    db.prepare('DELETE FROM timeline_event_scopes WHERE scope = ?').bind(`p:${guest}`),
    db.prepare('UPDATE timeline_events SET actor_id = ? WHERE actor_id = ?').bind(user, guest),
    db
      .prepare(
        `INSERT INTO timeline_scope_state (person_id, last_seen_at)
         SELECT ?, last_seen_at FROM timeline_scope_state WHERE person_id = ?
         ON CONFLICT (person_id) DO UPDATE
           SET last_seen_at = MAX(timeline_scope_state.last_seen_at, excluded.last_seen_at)`,
      )
      .bind(user, guest),
    db.prepare('DELETE FROM timeline_scope_state WHERE person_id = ?').bind(guest),
    db
      .prepare(
        `INSERT OR IGNORE INTO timeline_dismissals (person_id, event_id, created_at)
         SELECT ?, event_id, created_at FROM timeline_dismissals WHERE person_id = ?`,
      )
      .bind(user, guest),
    db.prepare('DELETE FROM timeline_dismissals WHERE person_id = ?').bind(guest),
    db
      .prepare(
        `INSERT OR IGNORE INTO shared_with (person_id, item_id, share_code, last_seen)
         SELECT ?, item_id, share_code, last_seen FROM shared_with WHERE person_id = ?`,
      )
      .bind(user, guest),
    db.prepare('DELETE FROM shared_with WHERE person_id = ?').bind(guest),
    db
      .prepare(
        `INSERT OR IGNORE INTO placement_defaults (person_id, default_key, folder_id, updated_at)
         SELECT ?, default_key, folder_id, updated_at FROM placement_defaults WHERE person_id = ?`,
      )
      .bind(user, guest),
    db.prepare('DELETE FROM placement_defaults WHERE person_id = ?').bind(guest),
    // The Inbox follows them too.
    db.prepare('UPDATE collab_actions SET assignee_id = ? WHERE assignee_id = ?').bind(user, guest),
    db.prepare('UPDATE collab_actions SET assigner_id = ? WHERE assigner_id = ?').bind(user, guest),
    db
      .prepare(
        `INSERT OR IGNORE INTO collab_thread_people (app, item_id, tab_id, element_id, person_id)
         SELECT app, item_id, tab_id, element_id, ? FROM collab_thread_people WHERE person_id = ?`,
      )
      .bind(user, guest),
    db.prepare('DELETE FROM collab_thread_people WHERE person_id = ?').bind(guest),
    // How far they have read each form's responses: the further of the two.
    db
      .prepare(
        `INSERT INTO collab_form_reads (person_id, item_id, tab_id, seen)
         SELECT ?, item_id, tab_id, seen FROM collab_form_reads WHERE person_id = ?
         ON CONFLICT (person_id, item_id, tab_id) DO UPDATE SET seen = MAX(seen, excluded.seen)`,
      )
      .bind(user, guest),
    db.prepare('DELETE FROM collab_form_reads WHERE person_id = ?').bind(guest),
  ]);
  const items = (results[1] as D1Result).meta.changes ?? 0;
  waitUntil(
    drainPersonMerges(env).catch((err: unknown) => {
      console.warn('[index] person merges failed', { error: String(err) });
    }),
  );
  console.log('[index] merged a guest into an account', { items });
  return json({ items });
}
