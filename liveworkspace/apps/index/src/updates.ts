// Updates in the Inbox (liveworkspace/docs/specs/004-index/one-explorer-contracts.md "What an item pushes" and
// "Inbox"; blueprints/inbox.md "Updates"): what changed on a page someone watches, within its hour (liveknowledge's
// Watching). The item pushes its whole set, which replaces its rows in one batch; the Inbox read lists the rows
// pushed for the reader on items they reach; the daily run sweeps rows past INBOX_UPDATES_MS.
import {
  INBOX_UPDATES_MS,
  isUpdateKind,
  UPDATE_ACTOR_NAME_MAX,
  UPDATE_ACTORS_MAX,
  UPDATE_PEOPLE_MAX,
  UPDATE_TAB_NAME_MAX,
  UPDATES_PUSH_MAX,
  UPDATE_KINDS,
  type App,
  type InboxUpdate,
  type UpdateActor,
  type UpdateKind,
  type UpdatePush,
} from '@liveworkspace/index-client';
import { isId, isPartId } from './codec';
import { clip, isCount, isTime } from './collab-parse';
import type { Env } from './env';
import { badRequest, noContent, readObject } from './http';

/** An update's id, at most (the index's id bound). */
const UPDATE_ID_MAX = 128;

const parseActor = (value: unknown): UpdateActor | null => {
  const a = value as Record<string, unknown> | null;
  if (!a || typeof a !== 'object' || Array.isArray(a) || !isId(a.id)) return null;
  const name = clip(a.name, UPDATE_ACTOR_NAME_MAX);
  return name === null ? null : { id: a.id, name };
};

/** One pushed update, checked and clipped, or null when it is malformed. */
export function parseUpdate(value: unknown): UpdatePush | null {
  const u = value as Record<string, unknown> | null;
  if (!u || typeof u !== 'object' || Array.isArray(u)) return null;
  if (typeof u.id !== 'string' || u.id.length === 0 || u.id.length > UPDATE_ID_MAX) return null;
  if (!isPartId(u.tabId)) return null;
  const tabName = clip(u.tabName, UPDATE_TAB_NAME_MAX);
  if (tabName === null) return null;
  if (!Array.isArray(u.kinds) || u.kinds.length === 0 || u.kinds.length > UPDATE_KINDS.length)
    return null;
  if (!u.kinds.every(isUpdateKind) || new Set(u.kinds).size !== u.kinds.length) return null;
  if (!Array.isArray(u.actors) || u.actors.length > UPDATE_ACTORS_MAX) return null;
  const actors = u.actors.map(parseActor);
  if (actors.some((a) => a === null)) return null;
  if (!isCount(u.actorCount) || u.actorCount < actors.length) return null;
  if (!isCount(u.count) || u.count < 1) return null;
  if (!isTime(u.firstAt) || !isTime(u.latestAt) || u.firstAt > u.latestAt) return null;
  if (!Array.isArray(u.people) || u.people.length === 0 || u.people.length > UPDATE_PEOPLE_MAX)
    return null;
  if (!u.people.every(isId) || new Set(u.people).size !== u.people.length) return null;
  return {
    id: u.id,
    tabId: u.tabId,
    tabName,
    kinds: u.kinds as UpdateKind[],
    actors: actors as UpdateActor[],
    actorCount: u.actorCount,
    count: u.count,
    firstAt: Math.floor(u.firstAt),
    latestAt: Math.floor(u.latestAt),
    people: u.people as string[],
  };
}

/** The whole push, or null when it is malformed: at most UPDATES_PUSH_MAX, ids unique. */
export function parseUpdates(body: Record<string, unknown> | null): UpdatePush[] | null {
  if (!body || !Array.isArray(body.updates) || body.updates.length > UPDATES_PUSH_MAX) return null;
  const updates = body.updates.map(parseUpdate);
  if (updates.some((u) => u === null)) return null;
  const parsed = updates as UpdatePush[];
  return new Set(parsed.map((u) => u.id)).size === parsed.length ? parsed : null;
}

/** `PUT /app/items/:id/updates` (the item is the app's own, checked by the caller): replaces the item's rows. An
 *  archived item keeps no Inbox, as for its threads: its push is taken and dropped. */
export async function pushUpdates(
  request: Request,
  env: Env,
  app: App,
  itemId: string,
  scope: string,
): Promise<Response> {
  const updates = parseUpdates(await readObject(request));
  if (!updates) return badRequest('invalid_updates');
  if (scope.startsWith('a:')) return noContent();
  const db = env.INDEX_DB;
  const rows = JSON.stringify(
    updates.map((u) => ({
      ...u,
      kinds: JSON.stringify(u.kinds),
      actors: JSON.stringify(u.actors),
    })),
  );
  const people = JSON.stringify(
    updates.flatMap((u) => u.people.map((person) => [person, u.id, u.latestAt])),
  );
  // Each table one statement through json_each, under D1's bound-parameter cap whatever the count. The people go
  // with their update by its foreign key.
  await db.batch([
    db.prepare('DELETE FROM item_updates WHERE item_id = ?').bind(itemId),
    db
      .prepare(
        `INSERT INTO item_updates (item_id, update_id, app, tab_id, tab_name, kinds, actors, actor_count, count,
           first_at, latest_at)
         SELECT ?1, json_extract(value, '$.id'), ?2, json_extract(value, '$.tabId'),
           json_extract(value, '$.tabName'), json_extract(value, '$.kinds'), json_extract(value, '$.actors'),
           json_extract(value, '$.actorCount'), json_extract(value, '$.count'), json_extract(value, '$.firstAt'),
           json_extract(value, '$.latestAt')
         FROM json_each(?3)`,
      )
      .bind(itemId, app, rows),
    db
      .prepare(
        `INSERT INTO item_update_people (person_id, item_id, update_id, latest_at)
         SELECT json_extract(value, '$[0]'), ?1, json_extract(value, '$[1]'), json_extract(value, '$[2]')
         FROM json_each(?2)`,
      )
      .bind(itemId, people),
  ]);
  return noContent();
}

export type UpdateRow = {
  update_id: string;
  app: App;
  item_id: string;
  item_title: string;
  item_team_id: string | null;
  tab_id: string;
  tab_name: string;
  kinds: string;
  actors: string;
  actor_count: number;
  count: number;
  first_at: number;
  latest_at: number;
};

/** The reader's updates of the last INBOX_UPDATES_MS, newest first, from the people index; `reachable` is the
 *  threads' own reach clause for the row alias `u` and `reachArgs` its arguments. */
export function updatesQuery(
  personId: string,
  app: App | null,
  limit: number,
  now: number,
  reachable: string,
  reachArgs: readonly unknown[],
) {
  return {
    sql: `SELECT u.update_id, u.app, u.item_id, i.title AS item_title, i.team_id AS item_team_id, u.tab_id,
        u.tab_name, u.kinds, u.actors, u.actor_count, u.count, u.first_at, u.latest_at
      FROM item_update_people p
      JOIN item_updates u ON u.item_id = p.item_id AND u.update_id = p.update_id
      JOIN items i ON i.id = u.item_id
      WHERE p.person_id = ? AND p.latest_at >= ? AND i.trashed_at IS NULL ${app ? 'AND u.app = ?' : ''}
        AND ${reachable}
      ORDER BY p.latest_at DESC LIMIT ?`,
    args: [personId, now - INBOX_UPDATES_MS, ...(app ? [app] : []), ...reachArgs, limit],
  };
}

const parseList = <T>(text: string): T[] => {
  try {
    const value = JSON.parse(text) as unknown;
    return Array.isArray(value) ? (value as T[]) : [];
  } catch {
    return [];
  }
};

export const inboxUpdateOf = (r: UpdateRow): InboxUpdate => ({
  id: r.update_id,
  app: r.app,
  itemId: r.item_id,
  itemTitle: r.item_title,
  itemTeamId: r.item_team_id,
  tabId: r.tab_id,
  tabName: r.tab_name,
  kinds: parseList<UpdateKind>(r.kinds).filter(isUpdateKind),
  actors: parseList<UpdateActor>(r.actors),
  actorCount: r.actor_count,
  count: r.count,
  firstAt: r.first_at,
  latestAt: r.latest_at,
});

/** The daily sweep's chunk, and its rounds a run: as the event log's. */
export const UPDATE_SWEEP_CHUNK = 500;
export const UPDATE_SWEEP_ROUNDS = 20;

/** Deletes updates past INBOX_UPDATES_MS (their people with them), oldest first; whether some are left. */
export async function sweepUpdates(
  env: Env,
  now = Date.now(),
  { chunk = UPDATE_SWEEP_CHUNK, rounds = UPDATE_SWEEP_ROUNDS } = {},
): Promise<{ deleted: number; more: boolean }> {
  const statement = env.INDEX_DB.prepare(
    `DELETE FROM item_updates WHERE rowid IN (
       SELECT rowid FROM item_updates WHERE latest_at < ? ORDER BY latest_at LIMIT ?)`,
  ).bind(now - INBOX_UPDATES_MS, chunk);
  let deleted = 0;
  for (let round = 0; round < rounds; round++) {
    const changes = (await statement.run()).meta.changes ?? 0;
    deleted += changes;
    if (changes < chunk) return { deleted, more: false };
  }
  return { deleted, more: true };
}
