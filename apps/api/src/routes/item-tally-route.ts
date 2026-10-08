// POST /items/tally (docs/specs/026-plan/items.md "Tally"): a session vote's tally, added to its cards' votes when the
// vote's host ends it. Each entry is a card id and its voters' dots (pseudonymous person ids to counts); a card gone
// meanwhile is skipped, the rest land. The updates go in one D1 batch, each guarded by the rev read, with one store
// rev raise and one room op; a card a concurrent write moved on is read again and retried. Edit access.
import type { ItemsResponse } from '@livediagram/api-schema';
import {
  ITEM_BULK_MAX,
  ITEM_VOTES_PER_PERSON_MAX,
  ITEM_VOTERS_MAX,
  ITEM_WRITE_RETRIES,
  applyTally,
  type Item,
  type ItemTally,
} from '@livediagram/items';
import { readItems, updateItemsAtRev } from '../db';
import { badRequest, json } from '../responses';
import { readBody, type RouteContext } from './context';
import { forCaller, itemBusy, itemCaller, itemNotFound, relay, writer } from './item-route-kit';

// A person id as items carry it: a short token.
const PERSON_ID_MAX = 64;

function readTallies(raw: unknown): ItemTally[] | Response {
  if (!Array.isArray(raw) || raw.length === 0 || raw.length > ITEM_BULK_MAX)
    return badRequest(`items must be 1 to ${ITEM_BULK_MAX} items`);
  const out: ItemTally[] = [];
  for (const entry of raw) {
    const e = entry as { id?: unknown; votes?: unknown };
    if (!e || typeof e.id !== 'string') return badRequest('each item needs its id');
    if (!e.votes || typeof e.votes !== 'object' || Array.isArray(e.votes))
      return badRequest('each item needs its votes');
    const votes: Record<string, number> = {};
    const pairs = Object.entries(e.votes as Record<string, unknown>);
    if (pairs.length > ITEM_VOTERS_MAX) return badRequest('too many voters');
    for (const [person, n] of pairs) {
      if (!person || person.length > PERSON_ID_MAX) return badRequest('a voter id is malformed');
      if (!Number.isInteger(n) || (n as number) < 1 || (n as number) > ITEM_VOTES_PER_PERSON_MAX)
        return badRequest(`a count must be 1 to ${ITEM_VOTES_PER_PERSON_MAX}`);
      votes[person] = n as number;
    }
    out.push({ id: e.id, votes });
  }
  return out;
}

export async function tally(ctx: RouteContext, documentId: string): Promise<Response> {
  const caller = await itemCaller(ctx, documentId, 'edit');
  if (caller instanceof Response) return caller;
  const body = await readBody(ctx);
  if (body instanceof Response) return body;
  const wanted = readTallies(body.items);
  if (wanted instanceof Response) return wanted;
  if (caller.scope && wanted.some((w) => !caller.scope!.has(w.id))) return itemNotFound();
  const by = await writer(ctx, caller.owner);
  const now = Date.now();
  const done = new Map<string, Item>();
  let pending = wanted;
  let rev = -1;
  for (let attempt = 1; attempt <= ITEM_WRITE_RETRIES; attempt += 1) {
    const stored = new Map(
      (await readItems(ctx.env, documentId, [...new Set(pending.map((t) => t.id))])).map((i) => [
        i.id,
        i,
      ]),
    );
    // A card gone meanwhile is skipped.
    pending = pending.filter((t) => stored.has(t.id));
    const nexts = new Map<string, Item>();
    for (const t of pending)
      nexts.set(t.id, applyTally(nexts.get(t.id) ?? stored.get(t.id)!, t.votes, { now, by }));
    if (nexts.size === 0) break;
    const written = await updateItemsAtRev(
      ctx.env,
      documentId,
      [...nexts].map(([id, next]) => ({ next, expectedRev: stored.get(id)!.rev })),
    );
    rev = written.rev;
    const landed = [...nexts.values()].filter((i) => written.landed.has(i.id));
    if (landed.length) relay(ctx, documentId, landed, [], rev);
    for (const item of landed) done.set(item.id, item);
    pending = pending.filter((t) => !written.landed.has(t.id));
    if (pending.length === 0) break;
    console.info('[items] items.write.retry', { documentId, attempt, left: pending.length });
  }
  if (pending.length) return itemBusy();
  console.info('[items] tallied', { documentId, count: done.size });
  const answer: ItemsResponse = { items: forCaller(caller, [...done.values()]), rev };
  return json(answer);
}
