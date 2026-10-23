// Telling the apps about a closed account (liveworkspace/docs/one-explorer-contracts.md "Closing an account"):
// the index anonymises its own rows, but the person's name is also in the content of items that outlive them
// (their comments, the actions they were given or gave, the cards they edited), which only each item's app holds,
// and each app may keep something of the person's beside their items (images, a workbench).
//
// While the person purge runs (account-purge.ts), before it rewrites the rows that name them, it records here
// one row per app for the person and one per item of someone else's that names them. The frequent cron (and the
// purge request itself, at once) sends each app `POST /api/internal/people/:id/purge {items}` with up to
// PERSON_ITEMS_PER_CALL of them; the rows go when the app confirms. An app that can't be reached is tried
// again an hour later, and given up on after NOTICE_GIVE_UP_MS.

import { APPS, type App } from '@liveworkspace/index-client';
import { callApp } from './app-calls';
import type { Env } from './env';

export const PERSON_ITEMS_PER_CALL = 100;
// Items recorded per source per pass: a bound on one statement; a later pass records the rest.
const RECORD_MAX = 5_000;
const GROUPS_PER_RUN = 20;
export const NOTICE_RETRY_AFTER_MS = 60 * 60 * 1000;
export const NOTICE_GIVE_UP_MS = 7 * 24 * 60 * 60 * 1000;

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
    from('SELECT item_id FROM timeline_events WHERE actor_id = ?1 LIMIT ?3'),
    db
      .prepare(
        `INSERT OR IGNORE INTO person_app_notices (person_id, app, item_id, created_at)
         SELECT ?, value, '', ? FROM json_each(?)`,
      )
      .bind(person, now, JSON.stringify(APPS)),
  ];
}

type Group = { person_id: string; app: App };

// One run: up to GROUPS_PER_RUN (person, app) pairs that are due, one call each. Returns the pairs confirmed.
export async function drainPersonNotices(env: Env, now = Date.now()): Promise<number> {
  const db = env.INDEX_DB;
  const stale = await db
    .prepare('DELETE FROM person_app_notices WHERE created_at < ?')
    .bind(now - NOTICE_GIVE_UP_MS)
    .run();
  if ((stale.meta.changes ?? 0) > 0) {
    console.warn('[index] person notices given up', { rows: stale.meta.changes });
  }
  const { results: groups } = await db
    .prepare(
      `SELECT DISTINCT person_id, app FROM person_app_notices
        WHERE last_attempt_at IS NULL OR last_attempt_at < ? LIMIT ?`,
    )
    .bind(now - NOTICE_RETRY_AFTER_MS, GROUPS_PER_RUN)
    .all<Group>();
  let confirmed = 0;
  for (const group of groups) {
    const { results } = await db
      .prepare(
        `SELECT item_id FROM person_app_notices WHERE person_id = ? AND app = ?
          ORDER BY item_id LIMIT ?`,
      )
      .bind(group.person_id, group.app, PERSON_ITEMS_PER_CALL + 1)
      .all<{ item_id: string }>();
    const rows = results.map((r) => r.item_id);
    const items = rows.filter((id) => id !== '').slice(0, PERSON_ITEMS_PER_CALL);
    const outcome = await callApp(
      env,
      group.app,
      'POST',
      `/people/${encodeURIComponent(group.person_id)}/purge`,
      { items },
    );
    // An app this deployment does not run has nothing to hear.
    if (outcome.ok || outcome.error === 'app_not_configured') {
      const done = rows.includes('') ? [...items, ''] : items;
      await db
        .prepare(
          `DELETE FROM person_app_notices WHERE person_id = ? AND app = ?
             AND item_id IN (SELECT value FROM json_each(?))`,
        )
        .bind(group.person_id, group.app, JSON.stringify(done))
        .run();
      confirmed++;
    } else {
      await db
        .prepare(
          `UPDATE person_app_notices SET attempts = attempts + 1, last_attempt_at = ?
            WHERE person_id = ? AND app = ?`,
        )
        .bind(now, group.person_id, group.app)
        .run();
      console.warn('[index] person notice not taken', { app: group.app, error: outcome.error });
    }
  }
  return confirmed;
}
