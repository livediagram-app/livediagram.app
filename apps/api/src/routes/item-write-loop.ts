// The bulk item write both /items/patches and /items/tally make (docs/specs/026-plan/items.md): read the wanted
// items, build each one's next state, write them in one D1 batch guarded by the revs read, relay what landed, and
// retry the rest a concurrent write moved on. A failure after some items landed (a refusal while building a retry,
// or still busy after the last attempt) carries them (`items`, `rev`, as a success's answer), so the caller keeps
// them rather than taking the whole request as unwritten, and never sends a landed tally again.
import type { ItemsResponse } from '@livediagram/api-schema';
import { ITEM_WRITE_RETRIES, type Item } from '@livediagram/items';
import { readItems, updateItemsAtRev } from '../db';
import { json } from '../responses';
import type { RouteContext } from './context';
import { forCaller, itemBusy, relay, type ItemCaller } from './item-route-kit';

// One attempt's next states by id, or a refusal. `missing`: how many wanted ids were not found on this read.
type BuildItems<T> = (
  pending: T[],
  stored: Map<string, Item>,
  read: { attempt: number; missing: number },
) => Promise<Map<string, Item> | Response>;

// A failure after some items landed: the refusal's body with the landed items added.
async function withLanded(
  refusal: Response,
  caller: ItemCaller,
  done: Map<string, Item>,
  rev: number,
): Promise<Response> {
  if (done.size === 0) return refusal;
  const body = (await refusal.json()) as Record<string, unknown>;
  console.info('[items] items.write.partial', { landed: done.size, error: body.error });
  const answer: ItemsResponse = { items: forCaller(caller, [...done.values()]), rev };
  return json({ ...body, ...answer }, { status: refusal.status });
}

// The written items, or a refusal (carrying any that landed). An id gone since is left out of the retry.
export async function writeItemsWithRetry<T extends { id: string }>(
  ctx: RouteContext,
  caller: ItemCaller,
  documentId: string,
  wanted: T[],
  build: BuildItems<T>,
): Promise<{ done: Map<string, Item>; rev: number } | Response> {
  const done = new Map<string, Item>();
  let pending = wanted;
  let rev = -1;
  for (let attempt = 1; attempt <= ITEM_WRITE_RETRIES; attempt += 1) {
    const ids = [...new Set(pending.map((p) => p.id))];
    const stored = new Map((await readItems(ctx.env, documentId, ids)).map((i) => [i.id, i]));
    pending = pending.filter((p) => stored.has(p.id));
    const nexts = await build(pending, stored, { attempt, missing: ids.length - stored.size });
    if (nexts instanceof Response) return withLanded(nexts, caller, done, rev);
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
    pending = pending.filter((p) => !written.landed.has(p.id));
    if (pending.length === 0) break;
    console.info('[items] items.write.retry', { documentId, attempt, left: pending.length });
  }
  if (pending.length) return withLanded(itemBusy(), caller, done, rev);
  return { done, rev };
}
