// POST /items/patches (blueprint item-store.md "Interfaces and contracts: REST"): many items changed at once, such
// as a deleted card type's or a removed column's cards sent to the Trash. Every id must exist (and, in a tab-scoped
// grant, be in scope), each patch is read as a single one is, and every resulting item is checked before anything
// is written, so one refusal refuses the request, naming the item. The updates land in one D1 batch, each guarded
// by the rev read, with one store rev raise and one room op; an item a concurrent write moved on is read again and
// retried, the others kept. A retry that then fails (the item kept changing, or as read again it is refused) has
// already landed the others: its refusal carries them (`items`, `rev`, as a success's answer), so the caller keeps
// them and can undo them rather than taking the whole request as unwritten.
import type { ItemsResponse } from '@livediagram/api-schema';
import {
  ITEM_BULK_MAX,
  ITEM_WRITE_RETRIES,
  applyPatch,
  fieldsWithinBounds,
  readItemPatch,
  type Item,
  type ItemPatchOf,
  type ItemRejection,
} from '@livediagram/items';
import { readItems, updateItemsAtRev } from '../db';
import { badRequest, forbidden, json } from '../responses';
import { readBody, type RouteContext } from './context';
import {
  excludedStatus,
  forCaller,
  itemBusy,
  itemCaller,
  itemNotFound,
  isItemEditor,
  relay,
  retiresItem,
  writer,
  type ItemCaller,
} from './item-route-kit';

// A refusal that names the item it is about.
function rejectedFor(id: string, error: ItemRejection, field?: string): Response {
  console.info('[items] items.rejected', { error, field, id });
  return json({ error, id, ...(field ? { field } : {}) }, { status: 400 });
}

function readPatches(raw: unknown): ItemPatchOf[] | Response {
  if (!Array.isArray(raw) || raw.length === 0 || raw.length > ITEM_BULK_MAX)
    return badRequest(`items must be 1 to ${ITEM_BULK_MAX} items`);
  const out: ItemPatchOf[] = [];
  for (const entry of raw) {
    if (!entry || typeof entry !== 'object' || typeof (entry as { id?: unknown }).id !== 'string')
      return badRequest('each item needs its id');
    const { id, ...body } = entry as Record<string, unknown> & { id: string };
    const patch = readItemPatch(body);
    if (typeof patch === 'string') return rejectedFor(id, patch);
    out.push({ id, patch });
  }
  return out;
}

// A failure after some items landed: the refusal's body with the landed items added.
async function withLanded(
  refusal: Response,
  caller: ItemCaller,
  done: Map<string, Item>,
  rev: number,
): Promise<Response> {
  if (done.size === 0) return refusal;
  const body = (await refusal.json()) as Record<string, unknown>;
  console.info('[items] items.patches.partial', { landed: done.size, error: body.error });
  const answer: ItemsResponse = { items: forCaller(caller, [...done.values()]), rev };
  return json({ ...body, ...answer }, { status: refusal.status });
}

export async function patches(ctx: RouteContext, documentId: string): Promise<Response> {
  const caller = await itemCaller(ctx, documentId, 'participate');
  if (caller instanceof Response) return caller;
  const body = await readBody(ctx);
  if (body instanceof Response) return body;
  const wanted = readPatches(body.items);
  if (wanted instanceof Response) return wanted;
  if (caller.scope && wanted.some((w) => !caller.scope!.has(w.id))) return itemNotFound();
  const undo = body.undo === true;
  const by = await writer(ctx, caller.owner);
  const now = Date.now();
  const done = new Map<string, Item>();
  let pending = wanted;
  let rev = -1;
  for (let attempt = 1; attempt <= ITEM_WRITE_RETRIES; attempt += 1) {
    const ids = [...new Set(pending.map((p) => p.id))];
    const stored = new Map((await readItems(ctx.env, documentId, ids)).map((i) => [i.id, i]));
    // A retried item deleted meanwhile is left out; on the first read, a missing one refuses the request.
    if (attempt === 1 && stored.size < ids.length) return itemNotFound();
    pending = pending.filter((p) => stored.has(p.id));
    // Each item's patches applied in order: an item patched twice is written once, as it ends.
    const nexts = new Map<string, Item>();
    for (const { id, patch } of pending)
      nexts.set(id, applyPatch(nexts.get(id) ?? stored.get(id)!, patch, { now, by }));
    // Every item is checked before any of this attempt's batch is written.
    for (const [id, next] of nexts) {
      if (excludedStatus(caller, next, stored.get(id)!, undo))
        return withLanded(rejectedFor(id, 'status_excluded', 'status'), caller, done, rev);
      if (retiresItem(stored.get(id)!, next) && !(await isItemEditor(ctx, caller)))
        return withLanded(forbidden(), caller, done, rev);
      const bound = fieldsWithinBounds(next.fields);
      if (bound) return withLanded(rejectedFor(id, bound), caller, done, rev);
    }
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
  console.info('[items] patched', { documentId, count: done.size });
  const answer: ItemsResponse = { items: forCaller(caller, [...done.values()]), rev };
  return json(answer);
}
