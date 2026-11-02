// POST /items/moves (docs/specs/026-plan/items.md "Move many"; blueprint item-store.md "Many moves"): many items moved
// as one write, such as a group of cards dragged on a board or a selection's Move To. Each attempt reads the store for
// the neighbours, lays each wanted item's stored copy over it, and applies the moves in order (applyMoves), so a move
// naming an earlier one ranks after it as moved and the group lands together. Every resulting item is checked as a
// patch's are before anything is written, so one refusal refuses the request, naming the item; the batch then lands as
// /items/patches' does (item-write-loop.ts): one D1 batch at the revs read, one room op, history, and a retry of an
// item a concurrent write moved on, ranked against the store as it then is.
import type { ItemsResponse } from '@liveplanner/api-schema';
import {
  ITEM_BULK_MAX,
  applyMoves,
  fieldsWithinBounds,
  readItemMove,
  type Item,
  type ItemMoveOf,
  type ItemRejection,
} from '@liveplanner/items';
import { listItems } from '../db';
import { badRequest, forbidden, json } from '../responses';
import { readBody, type PlanRouteContext } from './context';
import {
  calculatedSet,
  clearedRequired,
  excludedStatus,
  forCaller,
  isItemEditor,
  itemCaller,
  itemNotFound,
  retiresItem,
  timeTracked,
  writer,
} from './item-route-kit';
import { writeItemsWithRetry } from './item-write-loop';
import { historyTagOf } from './item-history-route';

// A refusal that names the item it is about.
function rejectedFor(id: string, error: ItemRejection, field?: string): Response {
  console.info('[items] items.rejected', { error, field, id });
  return json({ error, id, ...(field ? { field } : {}) }, { status: 400 });
}

function readMoves(raw: unknown): ItemMoveOf[] | Response {
  if (!Array.isArray(raw) || raw.length === 0 || raw.length > ITEM_BULK_MAX)
    return badRequest(`items must be 1 to ${ITEM_BULK_MAX} items`);
  const out: ItemMoveOf[] = [];
  for (const entry of raw) {
    if (!entry || typeof entry !== 'object' || typeof (entry as { id?: unknown }).id !== 'string')
      return badRequest('each item needs its id');
    const { id, ...body } = entry as Record<string, unknown> & { id: string };
    const move = readItemMove(body);
    if (typeof move === 'string') return rejectedFor(id, move);
    out.push({ id, move });
  }
  return out;
}

export async function moves(ctx: PlanRouteContext, projectId: string): Promise<Response> {
  const caller = await itemCaller(ctx, projectId, 'participate');
  if (caller instanceof Response) return caller;
  const body = await readBody(ctx);
  if (body instanceof Response) return body;
  const wanted = readMoves(body.items);
  if (wanted instanceof Response) return wanted;
  if (caller.scope && wanted.some((w) => !caller.scope!.has(w.id))) return itemNotFound();
  const undo = body.undo === true;
  const by = await writer(ctx, caller.owner);
  const now = Date.now();
  const result = await writeItemsWithRetry(
    ctx,
    caller,
    projectId,
    wanted,
    async (pending, stored, read) => {
      // On the first read, a missing item refuses the request; a retried one deleted meanwhile is left out.
      if (read.attempt === 1 && read.missing > 0) return itemNotFound();
      // The whole store for the neighbours, each wanted item as just read (its rev guards the write).
      const pool = new Map((await listItems(ctx.env, projectId)).map((i) => [i.id, i]));
      for (const [id, item] of stored) pool.set(id, item);
      const applied = applyMoves(pool.values(), pending, { now, by });
      if (!applied.ok) return itemNotFound();
      const nexts: Map<string, Item> = applied.moved;
      // Every item is checked before any of this attempt's batch is written.
      for (const [id, next] of nexts) {
        const before = stored.get(id)!;
        if (excludedStatus(caller, next, before, undo))
          return rejectedFor(id, 'status_excluded', 'status');
        const calculated = calculatedSet(caller, next, before, undo);
        if (calculated) return rejectedFor(id, 'field_calculated', calculated);
        const timed = timeTracked(caller, next, before);
        if (timed) return rejectedFor(id, 'field_time_tracked', timed);
        const cleared = clearedRequired(caller, next, before, undo);
        if (cleared) return rejectedFor(id, 'field_required', cleared);
        if (retiresItem(before, next) && !(await isItemEditor(ctx, caller))) return forbidden();
        const bound = fieldsWithinBounds(next.fields);
        if (bound) return rejectedFor(id, bound);
      }
      return nexts;
    },
    { tag: historyTagOf(ctx, undo) },
  );
  if (result instanceof Response) return result;
  console.info('[items] moved', { projectId, count: result.done.size });
  const answer: ItemsResponse = {
    items: forCaller(caller, [...result.done.values()]),
    rev: result.rev,
  };
  return json(answer);
}
