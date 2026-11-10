// Opens (items.ts): recording an open, the person's use days and the shared-with list.

import { USE_WINDOW_DAYS, OPEN_DEBOUNCE_MS } from '@liveworkspace/index-client';
import { loadItem } from '../access';
import { isArchived, archivedRefusal } from '../archive';
import { OPEN_MEMORY_MAX } from '../config';
import type { RouteContext } from '../context';
import type { Env } from '../env';
import { noContent } from '../http';
import { firstVisitStatement, wasFirstVisit, tellApp } from '../notices';

const DAY_MS = 86_400_000;

const recentOpens = new Map<string, number>();
// The UTC day each person's use days were last pruned here, so a prune runs at most once a day per person per
// isolate. Bounded like recentOpens.
const prunedOn = new Map<string, number>();

/** The UTC day number of `at`: what a use day counts by. */
export const useDayOf = (at: number) => Math.floor(at / DAY_MS);

function pruneDue(personId: string, day: number): boolean {
  if (prunedOn.get(personId) === day) return false;
  prunedOn.delete(personId);
  prunedOn.set(personId, day);
  if (prunedOn.size > OPEN_MEMORY_MAX) {
    const oldest = prunedOn.keys().next().value;
    if (oldest !== undefined) prunedOn.delete(oldest);
  }
  return true;
}

/** The statements that count a use of `itemId` by `personId` on the day of `at`, and, at most once a day, drop the
 * person's days that have left the window. An open adds one to the day's opens (Most Used ranks by them); any other
 * use (an edit an app reports) only makes sure the day is there, as one open, so an item only edited still counts
 * without an edit adding to the opens. Both read through use_days' (person_id, …) indexes. */
export function useDayStatements(
  env: Env,
  personId: string,
  itemId: string,
  at: number,
  use: 'open' | 'edit',
) {
  const db = env.INDEX_DB;
  const day = useDayOf(at);
  const statements = [
    db
      .prepare(
        use === 'open'
          ? `INSERT INTO use_days (person_id, item_id, day, opens) VALUES (?, ?, ?, 1)
             ON CONFLICT (person_id, item_id, day) DO UPDATE SET opens = use_days.opens + 1`
          : 'INSERT OR IGNORE INTO use_days (person_id, item_id, day) VALUES (?, ?, ?)',
      )
      .bind(personId, itemId, day),
  ];
  if (pruneDue(personId, day)) {
    statements.push(
      db
        .prepare('DELETE FROM use_days WHERE person_id = ? AND day < ?')
        .bind(personId, day - USE_WINDOW_DAYS + 1),
    );
  }
  return statements;
}

function rememberOpen(key: string, at: number): boolean {
  const last = recentOpens.get(key);
  if (last !== undefined && at - last < OPEN_DEBOUNCE_MS) return false;
  recentOpens.delete(key);
  recentOpens.set(key, at);
  if (recentOpens.size > OPEN_MEMORY_MAX) {
    const oldest = recentOpens.keys().next().value;
    if (oldest !== undefined) recentOpens.delete(oldest);
  }
  return true;
}

// The statement that records a link a person opened, under Shared. Rewrites only when the code changed or
// a minute has passed.
export function sharedWithUpsert(
  env: Env,
  personId: string,
  itemId: string,
  code: string,
  at: number,
) {
  return env.INDEX_DB.prepare(
    `INSERT INTO shared_with (person_id, item_id, share_code, last_seen) VALUES (?, ?, ?, ?)
     ON CONFLICT (person_id, item_id) DO UPDATE SET share_code = excluded.share_code, last_seen = excluded.last_seen
     WHERE shared_with.share_code <> excluded.share_code OR excluded.last_seen - shared_with.last_seen >= ?`,
  ).bind(personId, itemId, code, at, OPEN_DEBOUNCE_MS);
}

export async function recordOpen(ctx: RouteContext, id: string): Promise<Response> {
  const { env, caller } = ctx;
  const loaded = await loadItem(env, id, caller, 'view');
  if (loaded instanceof Response) return loaded;
  // Never opened while archived: no Recent or Most Used row comes back.
  if (isArchived(loaded.row)) return archivedRefusal();
  const person = caller.person;
  // A link visitor with no identity has no Recent to keep.
  if (!person) return noContent();
  const now = Date.now();
  if (!rememberOpen(`${person.id} ${id}`, now)) return noContent();
  const db = env.INDEX_DB;
  const statements = [
    // At most one write a minute per person and item, even across isolates.
    db
      .prepare(
        `INSERT INTO opens (person_id, item_id, last_opened_at) VALUES (?, ?, ?)
         ON CONFLICT (person_id, item_id) DO UPDATE SET last_opened_at = excluded.last_opened_at
         WHERE excluded.last_opened_at - opens.last_opened_at >= ?`,
      )
      .bind(person.id, id, now, OPEN_DEBOUNCE_MS),
    // Most Used: one more open today (at most one a minute, by the debounce above).
    ...useDayStatements(env, person.id, id, now, 'open'),
  ];
  // Through a link: kept for Shared with me, and a first time in tells the app (notices.ts). Not a public link's (a
  // Community post's): its visitors are not added to Shared, and its author is not told.
  const { access } = loaded;
  const visitAt = access.via === 'link' && access.code && !access.public ? statements.length : -1;
  if (visitAt >= 0) {
    statements.push(firstVisitStatement(env, person.id, id));
    statements.push(sharedWithUpsert(env, person.id, id, access.code!, now));
  }
  const results = await db.batch(statements);
  if (visitAt >= 0 && wasFirstVisit(results[visitAt])) {
    tellApp(ctx.waitUntil, env, loaded.row, {
      type: 'joined',
      personId: person.id,
      level: loaded.access.level,
    });
  }
  return noContent();
}
