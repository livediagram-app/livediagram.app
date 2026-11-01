// Closing an account (liveworkspace/docs/specs/004-index/one-explorer-contracts.md "Closing an account"): accounts calls
// POST /internal/purge-person with its own key once the account is gone, and everything the index holds
// for that person goes.
//
// - Their own items, in every app and the Trash included, are purged as a permanent delete is: the rows go
//   with a tombstone each (their favourites, opens, use days, links, passwords, Shared with me and Inbox rows
//   cascade), and the apps are asked to drop the content.
// - Items and folders in a team stay with the team, their owner anonymised; those in a team that closed
//   with the account (one they ran alone, named in `teamIds`) are theirs alone and go too.
// - Their folders, favourites, opens (Recent), use days (Most Used), Shared with me rows, placement
//   defaults and Timeline rows only they see go.
// - Rows on other people's items that only name them (comment threads they are in, actions assigned to
//   or by them, Timeline events they did) keep the row but name ANONYMISED_PERSON instead.
//
// Everything is done in chunks of CHUNK rows, so a person with any number of items stays inside D1's
// limits, and every step deletes or rewrites only what still names them, so running it again (a retry,
// or the cron picking up where a call left off) finds nothing left to do. The request is recorded first
// (person_purges), so a call that runs out of time is finished by the index's own cron rather than
// depending on accounts to ask again. The record stays for LINGER_MS after the request, and the cron
// runs the purge again over it, so anything written with an access token issued before the account
// closed (they live an hour) goes too.

import { isMergeCaller } from './auth';
import { isId } from './codec';
import { PURGE_NOW_MAX } from './config';
import type { Env } from './env';
import { badRequest, json, notFound, readObject, unauthorized } from './http';
import { drainPersonNotices, recordPersonNotices } from './person-notices';
import { drainTombstones, drainTombstonesSoon } from './purge';
import { webhookPurgeStatements } from './webhooks/purge';

// What a reference to a closed account becomes. Shaped like neither an account (`user_…`) nor a guest
// (`guest_…`), so it can never match anyone.
export const ANONYMISED_PERSON = 'deleted';

// Rows per statement.
export const CHUNK = 500;
// The teams a request may name: accounts caps how many a person makes; this is a sanity bound.
const TEAMS_MAX = 200;

// How long a request is kept and run again after it is made.
export const LINGER_MS = 2 * 60 * 60 * 1000;

// The index's frequent cron (wrangler.toml): it carries on purges a call left unfinished, and works
// through tombstones.
export const FREQUENT_CRON = '*/15 * * * *';
// Per run of the frequent cron: tombstones tried (one app call each), how long before a failed one is
// tried again, and how many person purges are looked at.
export const TOMBSTONES_PER_FREQUENT_RUN = 300;
export const TOMBSTONE_RETRY_AFTER_MS = 60 * 60 * 1000;
const PURGES_PER_RUN = 20;

// How much one invocation may spend: wall time, and D1 calls (each a subrequest).
export type Budget = { deadline: number; calls: number };
export const CALL_BUDGET = { ms: 5_000, calls: 300 };
export const CRON_BUDGET = { ms: 30_000, calls: 300 };

export const budgetOf = (limits: { ms: number; calls: number }, now = Date.now()): Budget => ({
  deadline: now + limits.ms,
  calls: limits.calls,
});

const spent = (budget: Budget) => budget.calls <= 0 || Date.now() >= budget.deadline;

type Db = D1Database;

// Runs a statement over and over until it touches fewer than a chunk's rows, or the budget runs out.
// Returns whether it finished.
async function untilDone(budget: Budget, statement: () => D1PreparedStatement): Promise<boolean> {
  for (;;) {
    if (spent(budget)) return false;
    budget.calls--;
    const result = await statement().run();
    if ((result.meta.changes ?? 0) < CHUNK) return true;
  }
}

const IN_TEAMS = 'SELECT value FROM json_each(?)';

// Items and folders in a team that outlives them: the team keeps them, under an anonymised owner.
async function anonymiseTeamWork(
  db: Db,
  budget: Budget,
  person: string,
  teams: string,
): Promise<boolean> {
  for (const table of ['items', 'folders']) {
    const done = await untilDone(budget, () =>
      db
        .prepare(
          `UPDATE ${table} SET owner_id = ? WHERE rowid IN (
             SELECT rowid FROM ${table} WHERE owner_id = ? AND team_id IS NOT NULL
               AND team_id NOT IN (${IN_TEAMS}) LIMIT ?)`,
        )
        .bind(ANONYMISED_PERSON, person, teams, CHUNK),
    );
    if (!done) return false;
  }
  return true;
}

type ItemKey = { id: string; app: string };

// Their own items (after anonymiseTeamWork, every item they still own): rows out, tombstones in, a chunk
// a batch. Returns whether it finished, and the ids it purged (for the apps to hear about at once).
async function purgeOwnItems(
  db: Db,
  budget: Budget,
  person: string,
  now: number,
): Promise<{ done: boolean; purged: string[] }> {
  const purged: string[] = [];
  for (;;) {
    if (spent(budget)) return { done: false, purged };
    budget.calls -= 2;
    const { results } = await db
      .prepare('SELECT id, app FROM items WHERE owner_id = ? LIMIT ?')
      .bind(person, CHUNK)
      .all<ItemKey>();
    if (results.length === 0) return { done: true, purged };
    const ids = JSON.stringify(results.map((r) => r.id));
    await db.batch([
      db
        .prepare(
          `INSERT INTO purge_tombstones (item_id, app, created_at)
           SELECT id, app, ? FROM items WHERE id IN (SELECT value FROM json_each(?))
           ON CONFLICT (item_id) DO NOTHING`,
        )
        .bind(now, ids),
      db.prepare('DELETE FROM items WHERE id IN (SELECT value FROM json_each(?))').bind(ids),
    ]);
    for (const r of results) purged.push(r.id);
    if (results.length < CHUNK) return { done: true, purged };
  }
}

// Everything else that is theirs, or names them. Each entry is one chunked statement.
function personalStatements(db: Db, person: string): (() => D1PreparedStatement)[] {
  const byPerson = (table: string) => () =>
    db
      .prepare(
        `DELETE FROM ${table} WHERE rowid IN (SELECT rowid FROM ${table} WHERE person_id = ? LIMIT ?)`,
      )
      .bind(person, CHUNK);
  const anonymiseAction = (column: 'assignee_id' | 'assigner_id') => () =>
    db
      .prepare(
        `UPDATE collab_actions SET ${column} = ? WHERE rowid IN (
           SELECT rowid FROM collab_actions WHERE ${column} = ? LIMIT ?)`,
      )
      .bind(ANONYMISED_PERSON, person, CHUNK);
  return [
    // Their folders: personal ones, and those in a team that closed with them (their items are gone by
    // now; anyone else's in them move to the root). Placement defaults pointing at them cascade.
    () =>
      db
        .prepare(
          'DELETE FROM folders WHERE rowid IN (SELECT rowid FROM folders WHERE owner_id = ? LIMIT ?)',
        )
        .bind(person, CHUNK),
    byPerson('favourites'),
    byPerson('opens'),
    byPerson('use_days'),
    // The Timeline: what only they saw (their own space's rows; their own items' events went with the
    // items), then the events of theirs no one else sees, then their name off the rest (team items,
    // other people's items they edited).
    () =>
      db
        .prepare(
          `DELETE FROM timeline_event_scopes WHERE rowid IN (
             SELECT rowid FROM timeline_event_scopes WHERE scope = ? LIMIT ?)`,
        )
        .bind(`p:${person}`, CHUNK),
    () =>
      db
        .prepare(
          `DELETE FROM timeline_events WHERE rowid IN (
             SELECT rowid FROM timeline_events e WHERE e.actor_id = ?
             AND NOT EXISTS (SELECT 1 FROM timeline_event_scopes s WHERE s.event_id = e.id) LIMIT ?)`,
        )
        .bind(person, CHUNK),
    () =>
      db
        .prepare(
          `UPDATE timeline_events SET actor_id = ?, actor_name = NULL WHERE rowid IN (
             SELECT rowid FROM timeline_events WHERE actor_id = ? LIMIT ?)`,
        )
        .bind(ANONYMISED_PERSON, person, CHUNK),
    byPerson('timeline_scope_state'),
    byPerson('timeline_dismissals'),
    byPerson('shared_with'),
    byPerson('placement_defaults'),
    byPerson('collab_form_reads'),
    // Their Drive mirror's flag (liveworkspace/docs/specs/005-drive/drive.md): accounts tells the service itself.
    byPerson('drive_people'),
    anonymiseAction('assignee_id'),
    anonymiseAction('assigner_id'),
  ];
}

// The comment threads they are in on other people's items: their id in each thread's participants and
// mentions becomes ANONYMISED_PERSON, and their own "threads I am in" rows go. The same chunk of rows, in
// the people table's own order, in one batch.
async function anonymiseThreads(db: Db, budget: Budget, person: string): Promise<boolean> {
  const chunk = `SELECT app, item_id, tab_id, element_id FROM collab_thread_people WHERE person_id = ?
                 ORDER BY app, item_id, tab_id, element_id LIMIT ?`;
  const swap = (column: string) =>
    `(SELECT json_group_array(CASE WHEN value = ? THEN ? ELSE value END) FROM json_each(${column}))`;
  for (;;) {
    if (spent(budget)) return false;
    budget.calls--;
    const [, removed] = await db.batch([
      db
        .prepare(
          `UPDATE collab_threads
           SET participant_ids = ${swap('participant_ids')}, mentioned_ids = ${swap('mentioned_ids')}
           WHERE (app, item_id, tab_id, element_id) IN (${chunk})`,
        )
        .bind(person, ANONYMISED_PERSON, person, ANONYMISED_PERSON, person, CHUNK),
      db
        .prepare(
          `DELETE FROM collab_thread_people WHERE person_id = ?
           AND (app, item_id, tab_id, element_id) IN (${chunk})`,
        )
        .bind(person, person, CHUNK),
    ]);
    if (((removed as D1Result).meta.changes ?? 0) < CHUNK) return true;
  }
}

export type PurgeOutcome = { done: boolean; items: number; purged: string[] };

// One pass over everything the index holds for `person`, within `budget`. Safe to run any number of
// times; `done` says nothing was left when it stopped.
export async function purgePerson(
  env: Env,
  person: string,
  teamIds: string[],
  budget: Budget,
  now = Date.now(),
): Promise<PurgeOutcome> {
  const db = env.INDEX_DB;
  const teams = JSON.stringify(teamIds);
  // What each app must hear (person-notices.ts), recorded before the rows that name them are rewritten.
  if (spent(budget)) return { done: false, items: 0, purged: [] };
  budget.calls--;
  // In the same batch, their webhooks: their own and a closed team's deleted, an outliving team's paused
  // (webhooks/purge.ts).
  await db.batch([
    ...recordPersonNotices(db, person, teams, now),
    ...webhookPurgeStatements(db, person, teams, ANONYMISED_PERSON, now),
  ]);
  if (!(await anonymiseTeamWork(db, budget, person, teams))) {
    return { done: false, items: 0, purged: [] };
  }
  const own = await purgeOwnItems(db, budget, person, now);
  if (!own.done) return { done: false, items: own.purged.length, purged: own.purged };
  for (const statement of personalStatements(db, person)) {
    if (!(await untilDone(budget, statement)))
      return { done: false, items: own.purged.length, purged: own.purged };
  }
  const done = await anonymiseThreads(db, budget, person);
  return { done, items: own.purged.length, purged: own.purged };
}

type PurgeRow = { person_id: string; team_ids: string; requested_at: number };

function teamIdsOf(text: string): string[] {
  try {
    const value = JSON.parse(text) as unknown;
    return Array.isArray(value) ? value.filter(isId) : [];
  } catch {
    return [];
  }
}

// Records (or renews) the request, so it outlives this call.
async function recordRequest(
  db: Db,
  person: string,
  teamIds: string[],
  now: number,
): Promise<void> {
  await db
    .prepare(
      `INSERT INTO person_purges (person_id, team_ids, requested_at) VALUES (?, ?, ?)
       ON CONFLICT (person_id) DO UPDATE SET
         team_ids = (SELECT json_group_array(value) FROM (
           SELECT value FROM json_each(person_purges.team_ids)
           UNION SELECT value FROM json_each(excluded.team_ids))),
         requested_at = excluded.requested_at, finished_at = NULL`,
    )
    .bind(person, JSON.stringify(teamIds), now)
    .run();
}

// After a pass: a finished request past its linger window is forgotten; otherwise the outcome is noted.
async function settleRequest(db: Db, row: PurgeRow, done: boolean, now: number): Promise<void> {
  if (done && now >= row.requested_at + LINGER_MS) {
    await db.prepare('DELETE FROM person_purges WHERE person_id = ?').bind(row.person_id).run();
    return;
  }
  await db
    .prepare('UPDATE person_purges SET finished_at = ?, runs = runs + 1 WHERE person_id = ?')
    .bind(done ? now : null, row.person_id)
    .run();
}

const isPerson = (value: unknown): value is string =>
  isId(value) && (value.startsWith('user_') || value.startsWith('guest_'));

// POST /internal/purge-person {personId, teamIds?}, with accounts' key. Answers 200 {done, items} once
// the request is recorded, whether or not this call finished it: what is left, the cron finishes.
export async function handlePersonPurge(
  request: Request,
  env: Env,
  waitUntil: (promise: Promise<unknown>) => void,
): Promise<Response> {
  if (request.method !== 'POST') return notFound();
  if (!(await isMergeCaller(request, env))) return unauthorized();
  const body = await readObject(request);
  const person = body?.personId;
  const teamIds = body?.teamIds ?? [];
  if (
    !isPerson(person) ||
    !Array.isArray(teamIds) ||
    teamIds.length > TEAMS_MAX ||
    !teamIds.every(isId)
  ) {
    return badRequest();
  }
  const now = Date.now();
  const db = env.INDEX_DB;
  await recordRequest(db, person, teamIds as string[], now);
  const row = await db
    .prepare('SELECT person_id, team_ids, requested_at FROM person_purges WHERE person_id = ?')
    .bind(person)
    .first<PurgeRow>();
  const outcome = await purgePerson(
    env,
    person,
    teamIdsOf(row!.team_ids),
    budgetOf(CALL_BUDGET),
    now,
  );
  await settleRequest(db, row!, outcome.done, now);
  // The first few apps hear at once; the cron tells them about the rest.
  if (outcome.purged.length > 0) {
    waitUntil(drainTombstonesSoon(env, outcome.purged.slice(0, PURGE_NOW_MAX)));
  }
  // And the apps hear of the person (person-notices.ts).
  waitUntil(
    drainPersonNotices(env, now).catch((err: unknown) =>
      console.warn('[index] person notices', String(err)),
    ),
  );
  console.log('[index] purged a closed account', { items: outcome.items, done: outcome.done });
  return json({ done: outcome.done, items: outcome.items });
}

// The frequent cron: carry on every recorded purge (oldest first) while the budget lasts, then tell the
// apps about tombstones not yet tried, or not tried for TOMBSTONE_RETRY_AFTER_MS.
export async function continuePurges(
  env: Env,
  now = Date.now(),
): Promise<{ persons: number; finished: number; confirmed: number; told: number }> {
  const db = env.INDEX_DB;
  const budget = budgetOf(CRON_BUDGET, now);
  const { results } = await db
    .prepare(
      'SELECT person_id, team_ids, requested_at FROM person_purges ORDER BY requested_at LIMIT ?',
    )
    .bind(PURGES_PER_RUN)
    .all<PurgeRow>();
  let finished = 0;
  for (const row of results) {
    if (spent(budget)) break;
    const outcome = await purgePerson(env, row.person_id, teamIdsOf(row.team_ids), budget, now);
    await settleRequest(db, row, outcome.done, now);
    if (outcome.done) finished++;
  }
  const due = await db
    .prepare(
      `SELECT item_id FROM purge_tombstones WHERE last_attempt_at IS NULL OR last_attempt_at < ?
       ORDER BY last_attempt_at LIMIT ?`,
    )
    .bind(now - TOMBSTONE_RETRY_AFTER_MS, TOMBSTONES_PER_FREQUENT_RUN)
    .all<{ item_id: string }>();
  const ids = due.results.map((r) => r.item_id);
  const confirmed =
    ids.length > 0 ? await drainTombstones(env, { ids, limit: ids.length }, now) : 0;
  const told = await drainPersonNotices(env, now);
  return { persons: results.length, finished, confirmed, told };
}
