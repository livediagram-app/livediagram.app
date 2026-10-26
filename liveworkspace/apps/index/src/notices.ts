// What the index tells an item's app for its notification emails, and the one count it answers for them
// (liveworkspace/docs/one-explorer-contracts.md "Notices"): someone made a share link on an item, a
// person opened one through a link for the first time, and how many items a person has made in the app.
// The index sends no email; it says what happened, once, after the change is written.

import {
  itemNoticePath,
  OWNED_COUNT_MAX,
  type App,
  type ItemNotice,
} from '@liveworkspace/index-client';
import { callApp } from './app-calls';
import { isId } from './codec';
import type { Env } from './env';
import { badRequest, json, notFound } from './http';

// Tells the item's app, off the response path. A failure is logged and dropped: a notice is for an
// email, and an email is best-effort.
export function tellApp(
  waitUntil: (promise: Promise<unknown>) => void,
  env: Env,
  item: { id: string; app: App },
  notice: ItemNotice,
): void {
  waitUntil(
    callApp(env, item.app, 'POST', itemNoticePath(item.id), notice).then((res) => {
      if (!res.ok)
        console.warn('[index] notice not delivered', {
          app: item.app,
          type: notice.type,
          error: res.error,
        });
    }),
  );
}

// Batched just before the shared_with upsert: whether this person had no row for the item yet, which
// makes this their first time in through a link.
export function firstVisitStatement(
  env: Env,
  personId: string,
  itemId: string,
): D1PreparedStatement {
  return env.INDEX_DB.prepare(
    'SELECT NOT EXISTS (SELECT 1 FROM shared_with WHERE person_id = ? AND item_id = ?) AS first',
  ).bind(personId, itemId);
}

export function wasFirstVisit(result: D1Result<unknown> | undefined): boolean {
  return (result?.results[0] as { first?: unknown } | undefined)?.first === 1;
}

// GET /app/people/:id/count?limit=: the items this person has made in the calling app, the Trash's
// included, counted up to `limit` (default and most OWNED_COUNT_MAX). One walk of items_owner that stops
// at the limit.
export async function handleAppPeople(
  request: Request,
  env: Env,
  app: App,
  segments: string[],
): Promise<Response> {
  const personId = segments[2];
  if (
    segments.length !== 4 ||
    segments[3] !== 'count' ||
    request.method !== 'GET' ||
    !isId(personId)
  ) {
    return notFound();
  }
  const raw = new URL(request.url).searchParams.get('limit');
  // `?limit=` left empty is the default, as on every list (codec.ts parseLimit), not Number('') = 0.
  const limit = raw === null || raw === '' ? OWNED_COUNT_MAX : Number(raw);
  if (!Number.isInteger(limit) || limit < 1 || limit > OWNED_COUNT_MAX)
    return badRequest('invalid_query');
  const row = await env.INDEX_DB.prepare(
    `SELECT COUNT(*) AS n FROM (SELECT 1 FROM items WHERE owner_id = ? AND app = ? LIMIT ?)`,
  )
    .bind(personId, app, limit)
    .first<{ n: number }>();
  return json({ count: row?.n ?? 0 });
}
