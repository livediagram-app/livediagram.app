// Who is in a call, from its Space's room (liveworkspace/docs/specs/004-index/item-calls.md "Joining"):
//
//   PUT /app/items/:space/call-people  {people, names}  livehuddle's key only  → 204
//
// The names are merged into the meeting's, first come, at most ITEM_CALL_NAMES_MAX. Someone in it makes it live again;
// nobody ends it. The Space's call is its newest row; a Calls Space's call, once over for good, takes nothing more. When the count moved, the item's app is told (`source-changed` with `calls`), so its open editors
// read the item's calls again.

import {
  callNames,
  ITEM_CALL_APP,
  ITEM_CALL_START_GRACE_MS,
  readCallPeoplePush,
  type App,
} from '@liveworkspace/index-client';
import type { Env } from './env';
import { badRequest, fail, noContent, notFound, readObject } from './http';
import { tellItemCalls } from './item-call-reads';
import { getItemRow } from './rows';

type CallPeopleRow = {
  id: string;
  item_id: string;
  people: number;
  names: string;
  live_at: number | null;
  ended_at: number | null;
  chosen: number;
};

/** Whether a Calls Space's call is over for good: it was live once and has been empty past the start's grace. */
export const endedForGood = (
  call: Pick<CallPeopleRow, 'chosen' | 'live_at' | 'ended_at'>,
  now: number,
): boolean =>
  call.chosen === 1 &&
  call.live_at !== null &&
  call.ended_at !== null &&
  call.ended_at < now - ITEM_CALL_START_GRACE_MS;

export async function handleCallPeople(
  request: Request,
  env: Env,
  app: App,
  spaceId: string,
  waitUntil: (promise: Promise<unknown>) => void,
): Promise<Response> {
  if (request.method !== 'PUT') return notFound();
  if (app !== ITEM_CALL_APP) return fail(403, 'wrong_app');
  const push = readCallPeoplePush(await readObject(request));
  if (!push) return badRequest();
  // The Space's call is its newest row: a Calls Space holds one call after another.
  const call = await env.INDEX_DB.prepare(
    `SELECT id, item_id, people, names, live_at, ended_at, chosen FROM item_calls WHERE space_id = ?
     ORDER BY started_at DESC LIMIT 1`,
  )
    .bind(spaceId)
    .first<CallPeopleRow>();
  if (!call) return notFound();
  const now = Date.now();
  // A call in someone's Calls Space that has been live and has stood empty past the grace has ended for good: people
  // back in the Space later are not that item's call (item-calls.md "Your Calls Space").
  if (endedForGood(call, now)) return noContent();
  let held: unknown = [];
  try {
    held = JSON.parse(call.names);
  } catch {
    held = [];
  }
  const names = callNames([...(Array.isArray(held) ? held : []), ...push.names]);
  // An empty Space ends only a call someone has been in: the room's first push comes as it is marked, before the
  // starter's tab arrives, and must not cut the start's grace short (a second press would make a second call).
  await env.INDEX_DB.prepare(
    `UPDATE item_calls SET people = ?1, names = ?2, updated_at = ?3,
       live_at = CASE WHEN ?1 > 0 THEN COALESCE(live_at, ?3) ELSE live_at END,
       ended_at = CASE WHEN ?1 > 0 THEN NULL WHEN live_at IS NULL THEN ended_at ELSE COALESCE(ended_at, ?3) END
     WHERE id = ?4`,
  )
    .bind(push.people, JSON.stringify(names), now, call.id)
    .run();
  if (push.people !== call.people) {
    const item = await getItemRow(env, call.item_id);
    if (item) waitUntil(tellItemCalls(env, item, spaceId));
  }
  return noContent();
}
