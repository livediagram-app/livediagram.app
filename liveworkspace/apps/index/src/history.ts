// An item's History (liveworkspace/docs/specs/004-index/one-explorer-contracts.md "The event log"): its events of the
// last EVENT_RETENTION_MS, newest first, for someone who reaches it directly (its owner, or a member of its team).
//
// Reading. One statement: a range of the events' item index (events_item: item, then time, then id), at most
// limit + 1 rows plus the few the person may not see (someone else's `favourited`; a visitor's open or copy, for
// anyone but the item's owner). Nothing is read per event; the item itself is the row the route already loaded.
import {
  EVENT_RETENTION_MS,
  HISTORY_LIMIT_MAX,
  HISTORY_PAGE,
  type EventApp,
  type EventType,
  type HistoryPage,
  type ItemEvent,
} from '@liveworkspace/index-client';
import type { Person } from './auth';
import { decodeCursor, encodeCursor } from './codec';
import type { RouteContext } from './context';
import { badRequest, json, notFound } from './http';
import { directAccess, getItemRow, toItem } from './rows';

export type HistorySpec = {
  itemId: string;
  // Who reads it: a `favourited` shows only when they did it; a visitor's open or copy only to the item's owner.
  personId: string;
  owner: boolean;
  limit: number;
  cursor?: { at: number; id: string };
  now: number;
};

export type BuiltQuery = { sql: string; args: unknown[] };

/** One page of an item's History as one statement (exported for its plan test). */
export function buildHistoryQuery(spec: HistorySpec): BuiltQuery {
  const args: unknown[] = [
    spec.itemId,
    spec.now - EVENT_RETENTION_MS,
    spec.personId,
    spec.owner ? 1 : 0,
  ];
  let cursor = '';
  if (spec.cursor) {
    cursor = ' AND (occurred_at < ?5 OR (occurred_at = ?5 AND id < ?6))';
    args.push(spec.cursor.at, spec.cursor.id);
  }
  args.push(spec.limit + 1);
  const sql = `SELECT id, app, item_id, actor_id, actor_name, type, title, detail, occurred_at
    FROM events
    WHERE item_id = ?1 AND occurred_at >= ?2
      AND (type <> 'favourited' OR actor_id = ?3)
      AND (?4 = 1 OR type NOT IN ('opened_by_visitor', 'copied_by_visitor'))${cursor}
    ORDER BY occurred_at DESC, id DESC LIMIT ?${args.length}`;
  return { sql, args };
}

type EventRow = {
  id: string;
  app: EventApp;
  item_id: string | null;
  actor_id: string | null;
  actor_name: string | null;
  type: EventType;
  title: string;
  detail: string | null;
  occurred_at: number;
};

function parseDetail(text: string | null): Record<string, string | null> | null {
  if (!text) return null;
  try {
    const value = JSON.parse(text) as unknown;
    return value && typeof value === 'object' && !Array.isArray(value)
      ? (value as Record<string, string | null>)
      : null;
  } catch {
    return null;
  }
}

const NO_EXTRAS = { favourite: false, lastOpenedAt: null, hiddenFromRecent: false };

/** GET /items/:id/history?limit=&cursor=: `{events, nextCursor}`; 404 to anyone who doesn't reach it directly. */
export async function itemHistory(ctx: RouteContext, id: string): Promise<Response> {
  const { env, url, caller } = ctx;
  const person: Person | null = caller.person;
  const limitText = url.searchParams.get('limit');
  const limit = limitText === null || limitText === '' ? HISTORY_PAGE : Number(limitText);
  if (!Number.isInteger(limit) || limit < 1 || limit > HISTORY_LIMIT_MAX) {
    return badRequest('invalid_query');
  }
  const cursor = decodeCursor(url.searchParams.get('cursor'));
  if (cursor === null) return badRequest('invalid_cursor');
  const row = person ? await getItemRow(env, id) : null;
  const access = row ? directAccess(row, person) : null;
  if (!row || !person || !access) return notFound();
  const { sql, args } = buildHistoryQuery({
    itemId: id,
    personId: person.id,
    owner: row.owner_id === person.id,
    limit,
    ...(cursor ? { cursor } : {}),
    now: Date.now(),
  });
  const { results } = await env.INDEX_DB.prepare(sql)
    .bind(...args)
    .all<EventRow>();
  const more = results.length > limit;
  const page = more ? results.slice(0, limit) : results;
  const item = toItem(row, access, NO_EXTRAS);
  const events: ItemEvent[] = page.map((r) => ({
    id: r.id,
    app: r.app,
    type: r.type,
    actorId: r.actor_id,
    actorName: r.actor_name,
    itemId: r.item_id,
    title: r.title,
    detail: parseDetail(r.detail),
    occurredAt: r.occurred_at,
    item,
  }));
  const last = page[page.length - 1];
  const body: HistoryPage = {
    events,
    nextCursor: more && last ? encodeCursor({ at: last.occurred_at, id: last.id }) : null,
  };
  return json(body);
}
