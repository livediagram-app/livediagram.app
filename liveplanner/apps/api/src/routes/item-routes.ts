// The item store's endpoints (docs/specs/026-plan/items.md, blueprint item-store.md "Interfaces and
// contracts"): list, create, bulk create, patch (POST), many patches (item-patches-route.ts), many moves (item-moves-route.ts), a vote's tally (item-tally-route.ts), move and delete under
// /api/projects/:id/items, and a card's comment writes (item-comment-routes.ts). People and agents use the
// same doors. Every write applies the pure functions of @liveplanner/items, lands guarded by the item's rev
// (retried on a lost race), and reaches the room as an ordered `items` op. Comment author ids reach only their
// author: every answer is redacted for the caller, and the room hears none (docs/specs/026-plan/items.md
// "Comments").

import type { ItemResponse, ItemsResponse } from '@liveplanner/api-schema';
import { withoutLegacyThread } from '@liveplanner/project';
import {
  ITEM_WRITE_RETRIES,
  REPEAT_FIELD,
  applyMove,
  applyPatch,
  createRefusal,
  fieldsWithinBounds,
  readItemMove,
  readItemPatch,
  typesOf,
  typeIn,
  hasCalculatedFields,
  planOutline,
  doneStatusesOf,
  childIndexOf,
  calculatedValuesOf,
  type CalculatedValue,
  withDefaultStatuses,
  type Item,
  type ItemPerson,
} from '@liveplanner/items';
import { deleteItemRow, getItemsRev, listItems, readItem, updateItemAtRev } from '../db';
import { forbidden, json, methodNotAllowed, noContent } from '../responses';
import { startOnCard } from './card-thread-routes';
import { cardLeftThreads, threadLinksOf } from './card-thread-cards';
import {
  calculatedSet,
  timeTracked,
  clearedRequired,
  excludedStatus,
  forCaller,
  itemBusy,
  itemRetryPause,
  itemCaller,
  itemNotFound,
  isItemEditor,
  blockersRefused,
  rejected,
  relay,
  editorOnly,
  writer,
  type ItemCaller,
} from './item-route-kit';
import { writeSource } from './automation-source';
import { patches } from './item-patches-route';
import { moves } from './item-moves-route';
import { historyTagOf, itemHistory } from './item-history-route';
import { appendItemHistory } from '../db/item-history';
import { planTabs } from './plan-route';
import { tally } from './item-tally-route';
import { importItems } from './item-import-route';
import { pullRequestsFor } from './item-pull-requests';
import { trackTime } from './item-time-route';
import { COMMUNITY_CONTENT, readBody, type PlanRouteContext } from './context';
import {
  readCreate,
  restoreThreadsOf,
  restoresThreads,
  created,
  createMany,
  readBulkCreates,
} from './item-creates';
export {
  type ReadCreate,
  buildCreates,
  itemsFull,
  createMany,
  readBulkCreates,
  readSeedItems,
  seedItems,
} from './item-creates';

// GET /items: the store, or the items a tab-scoped caller's tab shows.
async function list(ctx: PlanRouteContext, projectId: string): Promise<Response> {
  const caller = await itemCaller(ctx, projectId, 'read', COMMUNITY_CONTENT);
  if (caller instanceof Response) return caller;
  const [items, rev] = await Promise.all([
    caller.items ?? listItems(ctx.env, projectId),
    getItemsRev(ctx.env, projectId),
  ]);
  const shown = caller.scope ? items.filter((i) => caller.scope!.has(i.id)) : items;
  const answered = forCaller(caller, shown);
  const body: ItemsResponse = { items: answered, rev };
  const pullRequests = await pullRequestsFor(ctx, caller, shown);
  if (pullRequests) body.pullRequests = pullRequests;
  if (ctx.url.searchParams.get('include') === 'calculated') {
    // Worked out from the cards as the caller sees them, so a Community visitor's values name nobody either.
    const calculated = await calculatedFor(ctx, caller, caller.community ? answered : shown);
    if (calculated) body.calculated = calculated;
  }
  return json(body);
}

// Each card's Calculated field values (docs/specs/026-plan/item-types.md "Calculated fields"), only when asked and
// only when a type has one: the boards are read for their done columns as GET /plan reads them, a tab-scoped
// caller's tab alone, and the cards counted are the ones the caller sees.
async function calculatedFor(
  ctx: PlanRouteContext,
  caller: ItemCaller,
  items: Item[],
): Promise<Record<string, Record<string, CalculatedValue>> | null> {
  const types = typesOf(caller.doc?.itemTypes);
  if (!hasCalculatedFields(types)) return null;
  const scopedTab = caller.scope ? ctx.url.searchParams.get('tabId') : null;
  const { boards } = planOutline(
    await planTabs(ctx, caller.projectId, scopedTab),
    caller.doc?.itemTypes,
  );
  const isDone = doneStatusesOf(boards);
  const index = childIndexOf(items, types);
  const out: Record<string, Record<string, CalculatedValue>> = {};
  // The cards by id, for a Formula's Card fields ("#12 Title"; docs/specs/026-plan/item-types.md "Formula fields") and
  // a Lookup's linked card ("Rollup and Lookup fields").
  const byId = new Map(items.map((i) => [i.id, i]));
  for (const it of items) {
    const values = calculatedValuesOf(it, typeIn(types, it.type), index, isDone, byId, types);
    if (values) out[it.id] = values;
  }
  return out;
}

// The cards `creates` makes against the store as it is now, nothing written: refused past the plan's room or for an
// id already taken. createMany's, and a whole import's (item-import-route.ts), read again on each attempt.

async function create(ctx: PlanRouteContext, projectId: string): Promise<Response> {
  const caller = await itemCaller(ctx, projectId, 'participate');
  if (caller instanceof Response) return caller;
  // A tab-scoped grant makes cards only from a tab that shows every card (a board or plan view): from any other
  // tab the new card would land on boards elsewhere in the plan, outside what the grant reaches.
  if (caller.scope && !caller.scopeTakesNew) return forbidden();
  const body = await readBody(ctx);
  if (body instanceof Response) return body;
  const read = readCreate(body, caller.owner);
  if (typeof read === 'string') return rejected(read);
  // Votes, threads and a key come back only with an Editor's undo: a Participant makes a fresh card.
  const restores = read.votes !== undefined || restoresThreads(read) || read.key !== undefined;
  if (restores && !(await isItemEditor(ctx, caller))) return forbidden();
  // A card made repeating is an Editor's (docs/specs/026-plan/items.md "Repeating cards").
  if (read.fields[REPEAT_FIELD] !== undefined && !(await isItemEditor(ctx, caller)))
    return forbidden();
  // A Calculated field is worked out, never given (docs/specs/026-plan/item-types.md "Calculated fields").
  const calculated = restores ? null : calculatedSet(caller, read);
  if (calculated) return rejected('field_calculated', calculated);
  // A Time Spent field's entries come only with a card put back (docs/specs/026-plan/item-types.md "Time Spent").
  const timed = restores ? null : timeTracked(caller, read);
  if (timed) return rejected('field_time_tracked', timed);
  // A create naming no status takes its type's Default State (docs/specs/026-plan/item-types.md "An item type");
  // the project is already read for the caller, so this costs no query.
  const types = typesOf(caller.doc?.itemTypes);
  const { restoredThreads: _threads, ...create } = read;
  const input = withDefaultStatuses([create], types)[0]!;
  // A required custom field left empty (docs/specs/026-plan/item-types.md "Required fields"); a restore passes.
  const missing = createRefusal(types, input);
  if (missing) return rejected(missing.error, missing.field);
  // Blockers are an Editor's, and never close a loop (docs/specs/026-plan/item-types.md "Blocked By").
  const blocked = await blockersRefused(ctx, caller, [{ next: { ...input, id: input.id ?? '' } }]);
  if (blocked) return blocked;
  const made = await createMany(ctx, caller, [input]);
  if (made instanceof Response) return made;
  relay(ctx, projectId, made.items, [], made.rev);
  await appendItemHistory(
    ctx.env,
    projectId,
    made.items.map(created),
    historyTagOf(ctx, restores),
    writeSource(ctx, projectId),
  );
  await restoreThreadsOf(ctx, projectId, made.items, [read]);
  console.info('[items] created', { projectId, agent: ctx.token !== null });
  const answer: ItemResponse = { item: forCaller(caller, made.items)[0]!, rev: made.rev };
  return json(answer, { status: 201 });
}

async function bulk(ctx: PlanRouteContext, projectId: string): Promise<Response> {
  const caller = await itemCaller(ctx, projectId, 'edit');
  if (caller instanceof Response) return caller;
  // Bulk writes (an offline project's items, on sync) are whole-project writes.
  if (caller.scope) return forbidden();
  const body = await readBody(ctx);
  if (body instanceof Response) return body;
  const read = readBulkCreates(caller, body.items);
  if (read instanceof Response) return read;
  const { creates, reads, putBack } = read;
  // A synced card's blockers never close a loop (docs/specs/026-plan/item-types.md "Blocked By").
  const blocked = await blockersRefused(
    ctx,
    caller,
    creates.map((c) => ({ next: { ...c, id: c.id ?? '' } })),
  );
  if (blocked) return blocked;
  const made = await createMany(ctx, caller, creates);
  if (made instanceof Response) return made;
  relay(ctx, projectId, made.items, [], made.rev);
  await appendItemHistory(
    ctx.env,
    projectId,
    made.items.map(created),
    historyTagOf(ctx, putBack),
    writeSource(ctx, projectId),
  );
  await restoreThreadsOf(ctx, projectId, made.items, reads);
  console.info('[items] bulk created', { projectId, count: made.items.length });
  const answer: ItemsResponse = { items: forCaller(caller, made.items), rev: made.rev };
  return json(answer, { status: 201 });
}

// Reads the item, applies `change` and writes at the rev read; a lost race reads again, and runs `change` again,
// so anything it reads (a move's neighbours) is read afresh on every attempt. A change may answer with a Response
// instead (a refusal, or nothing to write).
export async function writeItem(
  ctx: PlanRouteContext,
  caller: ItemCaller,
  itemId: string,
  change: (item: Item, by: ItemPerson) => Item | Response | Promise<Item | Response>,
  // An undo or redo (the body's `undo: true`): a card type's left-out statuses do not refuse it.
  opts: { undo?: boolean } = {},
): Promise<Response> {
  if (caller.scope && !caller.scope.has(itemId)) return itemNotFound();
  const by = await writer(ctx, caller.owner);
  for (let attempt = 1; attempt <= ITEM_WRITE_RETRIES; attempt += 1) {
    const item = await readItem(ctx.env, caller.projectId, itemId);
    if (!item) return itemNotFound();
    const next = await change(item, by);
    if (next instanceof Response) return next;
    if (excludedStatus(caller, next, item, opts.undo === true))
      return rejected('status_excluded', 'status');
    const calculated = calculatedSet(caller, next, item, opts.undo === true);
    if (calculated) return rejected('field_calculated', calculated);
    const timed = timeTracked(caller, next, item);
    if (timed) return rejected('field_time_tracked', timed);
    const cleared = clearedRequired(caller, next, item, opts.undo === true);
    if (cleared) return rejected('field_required', cleared);
    if (editorOnly(item, next) && !(await isItemEditor(ctx, caller))) return forbidden();
    const bound = fieldsWithinBounds(next.fields);
    if (bound) return rejected(bound);
    const blocked = await blockersRefused(ctx, caller, [{ before: item, next }]);
    if (blocked) return blocked;
    const rev = await updateItemAtRev(ctx.env, caller.projectId, next, item.rev);
    if (rev !== null) {
      relay(ctx, caller.projectId, [next], [], rev);
      await appendItemHistory(
        ctx.env,
        caller.projectId,
        [{ before: item, after: next }],
        historyTagOf(ctx, opts.undo === true),
        writeSource(ctx, caller.projectId),
      );
      const answer: ItemResponse = { item: withoutLegacyThread(next), rev };
      return json(answer);
    }
    console.info('[items] items.write.retry', { projectId: caller.projectId, attempt });
    if (attempt < ITEM_WRITE_RETRIES) await itemRetryPause(attempt);
  }
  return itemBusy();
}

async function patch(ctx: PlanRouteContext, projectId: string, itemId: string): Promise<Response> {
  const caller = await itemCaller(ctx, projectId, 'participate');
  if (caller instanceof Response) return caller;
  const body = await readBody(ctx);
  if (body instanceof Response) return body;
  const input = readItemPatch(body);
  if (typeof input === 'string') return rejected(input);
  return writeItem(
    ctx,
    caller,
    itemId,
    (item, by) => applyPatch(item, input, { now: Date.now(), by }),
    { undo: body.undo === true },
  );
}

async function move(ctx: PlanRouteContext, projectId: string, itemId: string): Promise<Response> {
  const caller = await itemCaller(ctx, projectId, 'participate');
  if (caller instanceof Response) return caller;
  const body = await readBody(ctx);
  if (body instanceof Response) return body;
  const input = readItemMove(body);
  if (typeof input === 'string') return rejected(input);
  // The neighbours are read on every attempt: a retry after a lost race ranks against the column as it now is.
  return writeItem(
    ctx,
    caller,
    itemId,
    async (item, by) =>
      applyMove(item, input, await listItems(ctx.env, projectId), { now: Date.now(), by }),
    { undo: body.undo === true },
  );
}

async function remove(ctx: PlanRouteContext, projectId: string, itemId: string): Promise<Response> {
  const caller = await itemCaller(ctx, projectId, 'edit');
  if (caller instanceof Response) return caller;
  if (caller.scope && !caller.scope.has(itemId)) return itemNotFound();
  // Read before the row goes: its delete takes its links (plan-room/card-thread-schema.ts items_threads_gone).
  const links = await threadLinksOf(ctx, projectId, itemId);
  const deleted = await deleteItemRow(ctx.env, projectId, itemId);
  if (deleted === null) return itemNotFound();
  relay(ctx, projectId, [], [itemId], deleted.rev);
  await cardLeftThreads(ctx, projectId, itemId, links);
  console.info('[items] deleted', { projectId, agent: ctx.token !== null });
  return noContent();
}

// The item routes, or null for a path that is not theirs.
export async function handleItemRoutes(ctx: PlanRouteContext): Promise<Response | null> {
  const { segments, request } = ctx;
  if (segments[3] !== 'items') return null;
  const projectId = segments[2]!;
  const method = request.method;
  if (segments.length === 4) {
    if (method === 'GET') return list(ctx, projectId);
    if (method === 'POST') return create(ctx, projectId);
    return methodNotAllowed();
  }
  if (segments.length === 5 && segments[4] === 'bulk')
    return method === 'POST' ? bulk(ctx, projectId) : methodNotAllowed();
  // A whole import, in parts (docs/specs/026-plan/blueprints/tracker-import.md "A whole import").
  if (segments.length === 5 && segments[4] === 'import')
    return method === 'POST' ? importItems(ctx, projectId) : methodNotAllowed();
  if (segments.length === 5 && segments[4] === 'patches')
    return method === 'POST' ? patches(ctx, projectId) : methodNotAllowed();
  // Many moves as one write (docs/specs/026-plan/items.md "Move many").
  if (segments.length === 5 && segments[4] === 'moves')
    return method === 'POST' ? moves(ctx, projectId) : methodNotAllowed();
  if (segments.length === 5 && segments[4] === 'tally')
    return method === 'POST' ? tally(ctx, projectId) : methodNotAllowed();
  const itemId = segments[4]!;
  if (segments.length === 5) {
    // A field patch is a POST: the api's CORS (responses.ts) admits GET, POST, PUT and DELETE.
    if (method === 'POST') return patch(ctx, projectId, itemId);
    if (method === 'DELETE') return remove(ctx, projectId, itemId);
    return methodNotAllowed();
  }
  // A new comment thread on the card (docs/specs/026-plan/items.md "Comments"); the thread's own writes are under
  // /threads (card-thread-routes.ts).
  // The card's history (docs/specs/026-plan/items.md "History"), read when its panel opens.
  if (segments.length === 6 && segments[5] === 'history')
    return itemHistory(ctx, projectId, itemId);
  // A time write to a Time Spent field (docs/specs/026-plan/item-types.md "Time Spent").
  if (segments.length === 6 && segments[5] === 'time')
    return method === 'POST' ? trackTime(ctx, projectId, itemId) : methodNotAllowed();
  if (segments.length === 6 && segments[5] === 'threads')
    return method === 'POST' ? startOnCard(ctx, projectId, itemId) : methodNotAllowed();
  // A card is voted on through the tab's session vote, its tally added at the end (`/items/tally`); the old
  // per-card vote route is gone (docs/specs/012-collaboration/session-tools.md "Voting on Plan cards").
  if (segments.length === 6 && segments[5] === 'move') {
    if (method !== 'POST') return methodNotAllowed();
    return move(ctx, projectId, itemId);
  }
  return null;
}
