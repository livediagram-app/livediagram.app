// POST /items/:id/time (docs/specs/026-plan/item-types.md "Time Spent"): one time write to a card's Time Spent field:
// a timer started or stopped, a manual entry added, an entry or a running timer removed, or an entry put back (an
// undo). The write is made to the card as stored, guarded by the rev read and retried on a lost race
// (item-write-loop.ts), so two people's timers and entries never overwrite each other. Participate access: a
// Participant starts and stops their own timer and adds and removes their own entries; touching another person's
// timer or entry needs an Editor (403 `time_not_yours`). A Viewer is refused by the gate. No history entry: tracking
// time is no edit of the card, as a vote's tally is not.
import type { ItemResponse } from '@liveplanner/api-schema';
import {
  CUSTOM_FIELD_ID_PATTERN,
  applyTimeOp,
  fieldsWithinBounds,
  readTimeOp,
  readTimeValue,
  timeOpOwner,
  timeWriteRefusal,
  typesOf,
  type Item,
} from '@liveplanner/items';
import { json } from '../responses';
import { readBody, type PlanRouteContext } from './context';
import {
  forCaller,
  isItemEditor,
  itemCaller,
  itemNotFound,
  rejected,
  writer,
} from './item-route-kit';
import { writeItemsWithRetry } from './item-write-loop';

const notYours = () => {
  console.info('[items] items.time.not_yours');
  return json({ error: 'time_not_yours' }, { status: 403 });
};

export async function trackTime(
  ctx: PlanRouteContext,
  projectId: string,
  itemId: string,
): Promise<Response> {
  const caller = await itemCaller(ctx, projectId, 'participate');
  if (caller instanceof Response) return caller;
  if (caller.scope && !caller.scope.has(itemId)) return itemNotFound();
  const body = await readBody(ctx);
  if (body instanceof Response) return body;
  const field = body.field;
  const op = readTimeOp(body);
  if (typeof field !== 'string' || !CUSTOM_FIELD_ID_PATTERN.test(field) || typeof op === 'string')
    return rejected('time_invalid', 'field');
  const types = typesOf(caller.doc?.itemTypes);
  const by = await writer(ctx, caller.owner);
  // A write with nothing to do (a timer already stopped on another device, an entry already gone): the card as it is,
  // rev -1, nothing written.
  const asItIs = (item: Item) => {
    console.info('[items] items.time', { projectId, op: op.op, changed: false });
    const answer: ItemResponse = { item: forCaller(caller, [item])[0]!, rev: -1 };
    return json(answer);
  };
  const result = await writeItemsWithRetry(
    ctx,
    caller,
    projectId,
    [{ id: itemId }],
    async (pending, stored) => {
      const item = pending.length ? stored.get(itemId) : undefined;
      if (!item) return new Map();
      if (timeWriteRefusal(types, item, field)) return rejected('time_invalid', field);
      // Whose timer or entry it touches: another person's needs an Editor.
      const owner = timeOpOwner(readTimeValue(item.fields[field]), op, by.id);
      if (owner !== null && owner !== by.id && !(await isItemEditor(ctx, caller)))
        return notYours();
      const timed = applyTimeOp(item, field, op, { now: Date.now(), by });
      if (!timed.ok) return rejected(timed.error, field);
      if (timed.item === item) return asItIs(item);
      const bound = fieldsWithinBounds(timed.item.fields);
      if (bound) return rejected(bound, field);
      return new Map([[itemId, timed.item]]);
    },
  );
  if (result instanceof Response) return result;
  const written = result.done.get(itemId);
  if (!written) return itemNotFound();
  console.info('[items] items.time', { projectId, op: op.op, changed: true });
  const answer: ItemResponse = { item: forCaller(caller, [written])[0]!, rev: result.rev };
  return json(answer);
}
