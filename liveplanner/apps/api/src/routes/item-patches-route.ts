// POST /items/patches (blueprint item-store.md "Interfaces and contracts: REST"): many items changed at once, such
// as a deleted card type's or a removed column's cards sent to the Trash. Every id must exist (and, in a tab-scoped
// grant, be in scope), each patch is read as a single one is, and every resulting item is checked before anything
// is written, so one refusal refuses the request, naming the item. The updates land in one D1 batch, each guarded
// by the rev read, with one store rev raise and one room op; an item a concurrent write moved on is read again and
// retried, the others kept (item-write-loop.ts): a retry that then fails carries the items already landed.
import type { ItemsResponse } from '@liveplanner/api-schema';
import {
  ITEM_BULK_MAX,
  applyPatch,
  fieldsWithinBounds,
  readItemPatch,
  type Item,
  type ItemPatchOf,
  type ItemRejection,
} from '@liveplanner/items';
import { badRequest, forbidden, json } from '../responses';
import { readBody, type PlanRouteContext } from './context';
import {
  calculatedSet,
  timeTracked,
  clearedRequired,
  excludedStatus,
  forCaller,
  itemCaller,
  itemNotFound,
  isItemEditor,
  blockersRefused,
  editorOnly,
  writer,
} from './item-route-kit';
import { writeItemsWithRetry } from './item-write-loop';
import { historyTagOf } from './item-history-route';

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

export async function patches(ctx: PlanRouteContext, projectId: string): Promise<Response> {
  const caller = await itemCaller(ctx, projectId, 'participate');
  if (caller instanceof Response) return caller;
  const body = await readBody(ctx);
  if (body instanceof Response) return body;
  const wanted = readPatches(body.items);
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
      // Each item's patches applied in order: an item patched twice is written once, as it ends.
      const nexts = new Map<string, Item>();
      for (const { id, patch } of pending)
        nexts.set(id, applyPatch(nexts.get(id) ?? stored.get(id)!, patch, { now, by }));
      // Every item is checked before any of this attempt's batch is written.
      for (const [id, next] of nexts) {
        if (excludedStatus(caller, next, stored.get(id)!, undo))
          return rejectedFor(id, 'status_excluded', 'status');
        const calculated = calculatedSet(caller, next, stored.get(id), undo);
        if (calculated) return rejectedFor(id, 'field_calculated', calculated);
        const timed = timeTracked(caller, next, stored.get(id));
        if (timed) return rejectedFor(id, 'field_time_tracked', timed);
        const cleared = clearedRequired(caller, next, stored.get(id)!, undo);
        if (cleared) return rejectedFor(id, 'field_required', cleared);
        if (editorOnly(stored.get(id)!, next) && !(await isItemEditor(ctx, caller)))
          return forbidden();
        const bound = fieldsWithinBounds(next.fields);
        if (bound) return rejectedFor(id, bound);
      }
      // Blockers are an Editor's, and the batch never closes a loop (docs/specs/026-plan/item-types.md "Blocked By").
      const blocked = await blockersRefused(
        ctx,
        caller,
        [...nexts].map(([id, next]) => ({ before: stored.get(id)!, next })),
      );
      if (blocked) return blocked;
      return nexts;
    },
    { tag: historyTagOf(ctx, undo) },
  );
  if (result instanceof Response) return result;
  console.info('[items] patched', { projectId, count: result.done.size });
  const answer: ItemsResponse = {
    items: forCaller(caller, [...result.done.values()]),
    rev: result.rev,
  };
  return json(answer);
}
