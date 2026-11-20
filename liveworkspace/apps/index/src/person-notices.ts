// Telling the apps about a closed account (liveworkspace/docs/specs/004-index/one-explorer-contracts.md "Closing an account"):
// the index anonymises its own rows, but the person's name is also in the content of items that outlive them
// (their comments, the actions they were given or gave, the cards they edited), which only each item's app holds,
// and each app may keep something of the person's beside their items (images, a workbench).
//
// While the person purge runs (account-purge.ts), before it rewrites the rows that name them, it records here
// one row per app for the person and one per item of someone else's that names them. The frequent cron (and the
// purge request itself, at once) sends each app `POST /api/internal/people/:id/purge {items}` with up to
// PERSON_ITEMS_PER_CALL of them, and the guests merged into the person (`guests`, person_notice_guests); the rows go
// when the app confirms, and the guests once no row for the person is left. An app that can't be reached is tried
// again an hour later, and given up on after a week (the shared retry, notice-queue.ts).

import { APPS, type App } from '@liveworkspace/index-client';
import { callApp } from './app-calls';
import type { Env } from './env';
import { dueRows, giveUpStale, settle, type NoticeQueue } from './notice-queue';
import { PERSON_ALIASES_MAX } from './person-aliases';

export const PERSON_ITEMS_PER_CALL = 100;
// Items recorded per source per pass: a bound on one statement; a later pass records the rest.
const RECORD_MAX = 5_000;
const GROUPS_PER_RUN = 20;
const QUEUE: NoticeQueue = {
  table: 'person_app_notices',
  givenUp: '[index] person notices given up',
  notTaken: '[index] person notice not taken',
};

// The statements that record what each app must hear: run first, before the rows that name the person are
// rewritten. Their own items are left out (they are purged, and the app drops them whole), except those in a team
// that outlives them (`teams`: the JSON list of teams that closed with the account), which stay with the team.
export function recordPersonNotices(
  db: D1Database,
  person: string,
  teams: string,
  now: number,
): D1PreparedStatement[] {
  const from = (source: string) =>
    db
      .prepare(
        `INSERT OR IGNORE INTO person_app_notices (person_id, app, item_id, created_at)
         SELECT ?1, i.app, i.id, ?2 FROM items i
          WHERE i.id IN (${source})
            AND (i.owner_id <> ?1
                 OR (i.team_id IS NOT NULL AND i.team_id NOT IN (SELECT value FROM json_each(?4))))`,
      )
      .bind(person, now, RECORD_MAX, teams);
  return [
    from('SELECT id FROM items WHERE owner_id = ?1 AND team_id IS NOT NULL LIMIT ?3'),
    from('SELECT item_id FROM collab_thread_people WHERE person_id = ?1 LIMIT ?3'),
    from('SELECT item_id FROM collab_actions WHERE assignee_id = ?1 LIMIT ?3'),
    from('SELECT item_id FROM collab_actions WHERE assigner_id = ?1 LIMIT ?3'),
    // The event log keeps 30 days, so what they opened (opens: kept until the item goes) and reached by a link stand
    // in for older edits and visits: a superset, and an app finding no name in an item changes nothing.
    from('SELECT item_id FROM events WHERE actor_id = ?1 LIMIT ?3'),
    from('SELECT item_id FROM opens WHERE person_id = ?1 LIMIT ?3'),
    from('SELECT item_id FROM shared_with WHERE person_id = ?1 LIMIT ?3'),
    db
      .prepare(
        `INSERT OR IGNORE INTO person_app_notices (person_id, app, item_id, created_at)
         SELECT ?, value, '', ? FROM json_each(?)`,
      )
      .bind(person, now, JSON.stringify(APPS)),
    // The guests merged into them (person-aliases.ts), read before the purge deletes the aliases: every call names
    // them, so each app anonymises what they left as a guest as it does the account's (Work Tracker 1241).
    db
      .prepare(
        `INSERT OR IGNORE INTO person_notice_guests (person_id, guest_id)
         SELECT person_id, guest_id FROM person_aliases WHERE person_id = ?
          ORDER BY merged_at DESC, guest_id LIMIT ?`,
      )
      .bind(person, PERSON_ALIASES_MAX),
  ];
}

type Group = { person_id: string; app: App };

// One run: up to GROUPS_PER_RUN (person, app) pairs that are due, one call each. Returns the pairs confirmed.
export async function drainPersonNotices(env: Env, now = Date.now()): Promise<number> {
  const db = env.INDEX_DB;
  // In the same batch, the guests of every person with no notice left (confirmed or given up) go.
  await giveUpStale(
    db,
    QUEUE,
    now,
    db.prepare(
      `DELETE FROM person_notice_guests
        WHERE person_id NOT IN (SELECT person_id FROM person_app_notices)`,
    ),
  );
  const groups = await dueRows<Group>(db, QUEUE, 'person_id, app', GROUPS_PER_RUN, now);
  let confirmed = 0;
  for (const group of groups) {
    const [notices, guestRows] = await db.batch([
      db
        .prepare(
          `SELECT item_id FROM person_app_notices WHERE person_id = ? AND app = ?
            ORDER BY item_id LIMIT ?`,
        )
        .bind(group.person_id, group.app, PERSON_ITEMS_PER_CALL + 1),
      db
        .prepare(
          'SELECT guest_id FROM person_notice_guests WHERE person_id = ? ORDER BY guest_id LIMIT ?',
        )
        .bind(group.person_id, PERSON_ALIASES_MAX),
    ]);
    const rows = (notices!.results as { item_id: string }[]).map((r) => r.item_id);
    const items = rows.filter((id) => id !== '').slice(0, PERSON_ITEMS_PER_CALL);
    const guests = (guestRows!.results as { guest_id: string }[]).map((r) => r.guest_id);
    const outcome = await callApp(
      env,
      group.app,
      'POST',
      `/people/${encodeURIComponent(group.person_id)}/purge`,
      { items, guests },
    );
    // Confirmed, the items sent go (and the '' row, once sent); a failure marks the whole (person, app) group.
    const key = { person_id: group.person_id, app: group.app };
    const done = rows.includes('') ? [...items, ''] : items;
    if (await settle(db, QUEUE, outcome, { confirm: { key, items: done }, fail: { key } }, now)) {
      confirmed++;
    }
  }
  return confirmed;
}
