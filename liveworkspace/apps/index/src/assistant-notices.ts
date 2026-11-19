// Telling the apps about a revoked AI tool's token (liveworkspace/docs/specs/004-index/one-explorer-contracts.md
// "Revoking an AI tool's token", Work Tracker 1294): an app that keeps assistants (a liveplanner plan remembers each
// tool that reached its cards, and can hand it cards) must forget the tool once its person's last writable token under
// that name is revoked, and only the index knows which items the person reaches.
//
// Accounts asks here after the revoke (POST /internal/assistant-revoked {personId, client, teamIds}, its merge key),
// off the revoke's path. One batch records a row per item the person may have reached (a superset, as a closed
// account's notices are); then, after the answer and on the frequent cron, each app hears
// `POST /api/internal/people/:id/assistant-revoked {client, items}` with up to ASSISTANT_ITEMS_PER_CALL of them. The
// rows go when the app confirms; an app that can't be reached is tried again an hour later, and given up on after a
// week. The app's side is safe to run twice.

import type { App } from '@liveworkspace/index-client';
import { callApp } from './app-calls';
import { isMergeCaller, teamScope } from './auth';
import { isId } from './codec';
import type { Env } from './env';
import { badRequest, json, notFound, readObject, unauthorized } from './http';

// The apps whose items remember AI tools: only they are told.
export const ASSISTANT_APPS: readonly App[] = ['liveplanner'];
export const ASSISTANT_ITEMS_PER_CALL = 100;
// Items recorded per source per revoke: a bound on one statement.
export const ASSISTANT_RECORD_MAX = 5_000;
// The calls one drain makes at most, across its groups.
export const ASSISTANT_CALLS_PER_RUN = 50;
const GROUPS_PER_RUN = 20;
export const ASSISTANT_RETRY_AFTER_MS = 60 * 60 * 1000;
export const ASSISTANT_GIVE_UP_MS = 7 * 24 * 60 * 60 * 1000;
// A token's name, as accounts bounds it (TOKEN_NAME_MAX_LENGTH).
export const CLIENT_MAX = 80;
const TEAMS_MAX = 200;

const isAccount = (value: unknown): value is string => isId(value) && value.startsWith('user_');

// The statements that record what each app must hear, in one batch: the person's own items, their teams' live ones,
// and any shared with them, opened by them or in the event log as theirs, of the apps in ASSISTANT_APPS.
export function recordAssistantNotices(
  db: D1Database,
  person: string,
  client: string,
  teamIds: readonly string[],
  now: number,
): D1PreparedStatement[] {
  const apps = JSON.stringify(ASSISTANT_APPS);
  const insert = (source: string) =>
    `INSERT OR IGNORE INTO assistant_notices (person_id, client, app, item_id, created_at)
     SELECT ?1, ?2, i.app, i.id, ?3 FROM items i
      WHERE i.id IN (${source}) AND i.app IN (SELECT value FROM json_each(?4))`;
  const from = (source: string) =>
    db.prepare(insert(source)).bind(person, client, now, apps, ASSISTANT_RECORD_MAX);
  return [
    from(
      'SELECT id FROM items WHERE owner_id = ?1 AND app IN (SELECT value FROM json_each(?4)) LIMIT ?5',
    ),
    db
      .prepare(
        insert(
          `SELECT id FROM items WHERE scope IN (SELECT value FROM json_each(?6))
              AND app IN (SELECT value FROM json_each(?4)) AND trashed_at IS NULL LIMIT ?5`,
        ),
      )
      .bind(
        person,
        client,
        now,
        apps,
        ASSISTANT_RECORD_MAX,
        JSON.stringify(teamIds.map(teamScope)),
      ),
    from('SELECT item_id FROM shared_with WHERE person_id = ?1 LIMIT ?5'),
    from('SELECT item_id FROM opens WHERE person_id = ?1 LIMIT ?5'),
    from('SELECT DISTINCT item_id FROM events WHERE actor_id = ?1 LIMIT ?5'),
  ];
}

// POST /internal/assistant-revoked {personId, client, teamIds}, with accounts' key. Answers 200 {items} once the
// notices are recorded (how many rows this call added); the apps hear after the answer.
export async function handleAssistantRevoked(
  request: Request,
  env: Env,
  waitUntil: (promise: Promise<unknown>) => void,
): Promise<Response> {
  if (request.method !== 'POST') return notFound();
  if (!(await isMergeCaller(request, env))) return unauthorized();
  const body = await readObject(request);
  const person = body?.personId;
  const raw = body?.client;
  const client = typeof raw === 'string' ? raw.trim() : '';
  const teamIds = body?.teamIds ?? [];
  if (
    !isAccount(person) ||
    client.length === 0 ||
    client.length > CLIENT_MAX ||
    !Array.isArray(teamIds) ||
    teamIds.length > TEAMS_MAX ||
    !teamIds.every(isId)
  ) {
    return badRequest();
  }
  const now = Date.now();
  const results = await env.INDEX_DB.batch(
    recordAssistantNotices(env.INDEX_DB, person, client, teamIds as string[], now),
  );
  const items = results.reduce((n, r) => n + (r.meta.changes ?? 0), 0);
  if (items > 0) {
    waitUntil(
      drainAssistantNotices(env, now).catch((err: unknown) =>
        console.warn('[index] assistant notices', String(err)),
      ),
    );
  }
  console.info('[index] assistant revoked', { items });
  return json({ items });
}

type Group = { person_id: string; client: string; app: App };

// One run: up to GROUPS_PER_RUN due (person, tool, app) groups, each told in calls of up to ASSISTANT_ITEMS_PER_CALL
// items until its rows run out, a call fails, or the run has made ASSISTANT_CALLS_PER_RUN calls. Returns the calls the
// apps confirmed.
export async function drainAssistantNotices(env: Env, now = Date.now()): Promise<number> {
  const db = env.INDEX_DB;
  const stale = await db
    .prepare('DELETE FROM assistant_notices WHERE created_at < ?')
    .bind(now - ASSISTANT_GIVE_UP_MS)
    .run();
  if ((stale.meta.changes ?? 0) > 0) {
    console.warn('[index] assistant notices given up', { rows: stale.meta.changes });
  }
  const { results: groups } = await db
    .prepare(
      `SELECT DISTINCT person_id, client, app FROM assistant_notices
        WHERE last_attempt_at IS NULL OR last_attempt_at < ? LIMIT ?`,
    )
    .bind(now - ASSISTANT_RETRY_AFTER_MS, GROUPS_PER_RUN)
    .all<Group>();
  let calls = 0;
  let confirmed = 0;
  for (const group of groups) {
    while (calls < ASSISTANT_CALLS_PER_RUN) {
      const { results } = await db
        .prepare(
          `SELECT item_id FROM assistant_notices WHERE person_id = ? AND client = ? AND app = ?
             AND (last_attempt_at IS NULL OR last_attempt_at < ?) ORDER BY item_id LIMIT ?`,
        )
        .bind(
          group.person_id,
          group.client,
          group.app,
          now - ASSISTANT_RETRY_AFTER_MS,
          ASSISTANT_ITEMS_PER_CALL,
        )
        .all<{ item_id: string }>();
      if (results.length === 0) break;
      const items = results.map((r) => r.item_id);
      calls++;
      const outcome = await callApp(
        env,
        group.app,
        'POST',
        `/people/${encodeURIComponent(group.person_id)}/assistant-revoked`,
        { client: group.client, items },
      );
      const ok = outcome.ok || outcome.error === 'app_not_configured';
      await db
        .prepare(
          ok
            ? `DELETE FROM assistant_notices WHERE person_id = ? AND client = ? AND app = ?
                 AND item_id IN (SELECT value FROM json_each(?))`
            : `UPDATE assistant_notices SET attempts = attempts + 1, last_attempt_at = ?5
                WHERE person_id = ?1 AND client = ?2 AND app = ?3
                  AND item_id IN (SELECT value FROM json_each(?4))`,
        )
        .bind(group.person_id, group.client, group.app, JSON.stringify(items), ...(ok ? [] : [now]))
        .run();
      if (!ok) {
        console.warn('[index] assistant notice not taken', {
          app: group.app,
          error: outcome.error,
        });
        break;
      }
      confirmed++;
    }
  }
  return confirmed;
}
