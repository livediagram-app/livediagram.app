// Who is in a call, from its Space's room (liveworkspace/docs/specs/004-index/item-calls.md "Joining"):
//
//   PUT /app/items/:space/call-people  {people, names}  livehuddle's key only  → 204
//
// The names are merged into the meeting's, first come, at most ITEM_CALL_NAMES_MAX. Someone in it makes it live again;
// nobody ends it. When the count moved, the item's app is told (`source-changed` with `calls`), so its open editors
// read the item's calls again.

import {
  callNames,
  ITEM_CALL_APP,
  readCallPeoplePush,
  type App,
} from '@liveworkspace/index-client';
import type { Env } from './env';
import { badRequest, fail, noContent, notFound, readObject } from './http';
import { tellItemCalls } from './item-call-reads';
import { getItemRow } from './rows';

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
  const call = await env.INDEX_DB.prepare(
    'SELECT id, item_id, people, names FROM item_calls WHERE space_id = ?',
  )
    .bind(spaceId)
    .first<{ id: string; item_id: string; people: number; names: string }>();
  if (!call) return notFound();
  let held: unknown = [];
  try {
    held = JSON.parse(call.names);
  } catch {
    held = [];
  }
  const names = callNames([...(Array.isArray(held) ? held : []), ...push.names]);
  const now = Date.now();
  await env.INDEX_DB.prepare(
    `UPDATE item_calls SET people = ?1, names = ?2, updated_at = ?3,
       live_at = CASE WHEN ?1 > 0 THEN COALESCE(live_at, ?3) ELSE live_at END,
       ended_at = CASE WHEN ?1 > 0 THEN NULL ELSE COALESCE(ended_at, ?3) END
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
