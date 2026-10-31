// The item store's endpoints (docs/specs/026-plan/items.md, blueprint item-store.md "Interfaces and
// contracts"): list, create, bulk create, patch (POST), many patches (item-patches-route.ts), a vote's tally (item-tally-route.ts), move and delete under
// /api/projects/:id/items, and a card's comment writes (item-comment-routes.ts). People and agents use the
// same doors. Every write applies the pure functions of @liveplanner/items, lands guarded by the item's rev
// (retried on a lost race), and reaches the room as an ordered `items` op. Comment author ids reach only their
// author: every answer is redacted for the caller, and the room hears none (docs/specs/026-plan/items.md
// "Comments").

import type { ItemResponse, ItemsResponse } from '@liveplanner/api-schema';
import { legacyThreadOf, withoutLegacyThread, type CardThread } from '@liveplanner/project';
import {
  ITEMS_MAX,
  ITEM_BULK_MAX,
  ITEM_KEY_MAX,
  ITEM_WRITE_RETRIES,
  applyMove,
  itemPlacer,
  applyPatch,
  createRefusal,
  fieldsWithinBounds,
  readItemCreate,
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
  makeItem,
  newItemId,
  type Item,
  type ItemCreate,
  type ItemPerson,
  type ItemRejection,
} from '@liveplanner/items';
import {
  deleteItemRow,
  getItemStoreHead,
  getItemsRev,
  insertItems,
  listItems,
  readItem,
  updateItemAtRev,
} from '../db';
import { badRequest, conflict, forbidden, json, methodNotAllowed, noContent } from '../responses';
import { startOnCard } from './card-thread-routes';
import {
  cardBackOnThreads,
  cardLeftThreads,
  readRestoredThreads,
  threadLinksOf,
} from './card-thread-cards';
import {
  calculatedSet,
  clearedRequired,
  excludedStatus,
  forCaller,
  itemBusy,
  itemRetryPause,
  itemCaller,
  itemNotFound,
  isItemEditor,
  rejected,
  relay,
  retiresItem,
  writer,
  type ItemCaller,
} from './item-route-kit';
import { patches } from './item-patches-route';
import { historyTagOf, itemHistory } from './item-history-route';
import { appendItemHistory } from '../db/item-history';
import { planTabs } from './plan-route';
import { tally } from './item-tally-route';
import { readBody, type PlanRouteContext } from './context';

// A create as read, with the threads it puts the card back on (a restore), each checked as one.
type ReadCreate = ItemCreate & { restoredThreads?: CardThread[] };

// `owner` is the caller: a restored comment thread keeps author ids on their own comments only. A card's old single
// thread (`comments`, from a client from before threads) is read as its first thread (docs/specs/026-plan/items.md
// "Existing comments").
function readCreate(raw: unknown, owner: string): ReadCreate | ItemRejection {
  const read = readItemCreate(raw);
  if (typeof read === 'string') return read;
  const r = raw as { comments?: unknown; threads?: unknown };
  const threads = readRestoredThreads(r.threads, owner);
  if (threads === null) return 'field_value_invalid';
  const legacy = r.comments === undefined ? [] : legacyAsRestored(r.comments, read.id, owner);
  if (legacy === null) return 'field_value_invalid';
  const restoredThreads = [...threads, ...legacy];
  return restoredThreads.length ? { ...read, restoredThreads } : read;
}

// An old single thread a create carries, as the thread a restore would carry (its home and card set once the card is
// made, cardBackOnThreads).
function legacyAsRestored(
  raw: unknown,
  id: string | undefined,
  owner: string,
): CardThread[] | null {
  const t = legacyThreadOf(
    { id: id ?? 'new', key: 0, fields: { comments: raw as never }, updatedAt: 0 },
    '',
  );
  if (!t) return raw && typeof raw === 'object' ? [] : null;
  const back = readRestoredThreads([{ ...t, home: '~here' }], owner);
  return back;
}

// The threads a made card goes back on: a legacy thread (home '~here') becomes this plan's.
async function restoreThreadsOf(
  ctx: PlanRouteContext,
  projectId: string,
  made: Item[],
  creates: ReadCreate[],
): Promise<void> {
  for (let i = 0; i < made.length; i += 1) {
    const threads = creates[i]?.restoredThreads;
    if (!threads?.length) continue;
    const item = made[i]!;
    const homed = threads.map((t) =>
      t.home === '~here' ? { ...t, id: `c-${item.id}`, home: projectId } : t,
    );
    await cardBackOnThreads(ctx, projectId, item, homed);
  }
}

const restoresThreads = (c: ReadCreate) => (c.restoredThreads?.length ?? 0) > 0;

// A made card as its history's first entry.
const created = (item: Item) => ({ before: null, after: item });

// GET /items: the store, or the items a tab-scoped caller's tab shows.
async function list(ctx: PlanRouteContext, projectId: string): Promise<Response> {
  const caller = await itemCaller(ctx, projectId, 'read');
  if (caller instanceof Response) return caller;
  const [items, rev] = await Promise.all([
    caller.items ?? listItems(ctx.env, projectId),
    getItemsRev(ctx.env, projectId),
  ]);
  const shown = caller.scope ? items.filter((i) => caller.scope!.has(i.id)) : items;
  const body: ItemsResponse = { items: forCaller(caller, shown), rev };
  if (ctx.url.searchParams.get('include') === 'calculated') {
    const calculated = await calculatedFor(ctx, caller, shown);
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

// Creates `creates` in one batch. A named key (a restore, an offline sync, a copy) is kept while it is free, below
// the store's next key or above it; every other create takes the next key not already in use. The store is read
// once per attempt: its keys answer whether a named key is free (a key taken by a racing write fails the insert,
// which retries), and one placer ranks every create (itemPlacer), so a seed of n cards costs no per-card query and
// no per-card sort.
// `by` names who made them when that is not the caller: a form's response (docs/specs/030-forms/forms.md).
export async function createMany(
  ctx: PlanRouteContext,
  caller: Pick<ItemCaller, 'projectId' | 'owner'>,
  creates: ItemCreate[],
  opts?: { by: ItemPerson },
): Promise<{ items: Item[]; rev: number } | Response> {
  const by = opts?.by ?? (await writer(ctx, caller.owner));
  for (let attempt = 1; attempt <= ITEM_WRITE_RETRIES; attempt += 1) {
    const head = await getItemStoreHead(ctx.env, caller.projectId);
    if (head.count + creates.length > ITEMS_MAX) {
      return json(
        { error: 'items_full', message: `a plan holds ${ITEMS_MAX} items` },
        { status: 413 },
      );
    }
    const existing = await listItems(ctx.env, caller.projectId);
    const ids = new Set(existing.map((i) => i.id));
    const placer = itemPlacer(existing);
    const keys = new Set(existing.map((i) => i.key));
    const made: Item[] = [];
    let nextKey = head.nextKey;
    const now = Date.now();
    for (const create of creates) {
      if (create.id && ids.has(create.id)) return conflict('item_exists');
      const id =
        create.id ?? newItemId(() => crypto.getRandomValues(new Uint32Array(1))[0]! / 2 ** 32);
      ids.add(id);
      let key: number;
      if (create.key !== undefined && create.key <= ITEM_KEY_MAX && !keys.has(create.key)) {
        key = create.key;
      } else {
        // A key named earlier in this batch may sit at or above the next key.
        while (keys.has(nextKey)) nextKey += 1;
        key = nextKey;
        nextKey += 1;
      }
      keys.add(key);
      const item = makeItem(create, { id, key, now, by, items: placer });
      placer.add(item);
      made.push(item);
    }
    try {
      const rev = await insertItems(ctx.env, caller.projectId, made);
      return { items: made, rev };
    } catch (err) {
      // A key or id taken by a write that raced this one: read again and retry.
      console.info('[items] items.write.retry', {
        projectId: caller.projectId,
        attempt,
        error: String(err),
      });
      if (attempt < ITEM_WRITE_RETRIES) await itemRetryPause(attempt);
    }
  }
  return itemBusy();
}

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
  // A Calculated field is worked out, never given (docs/specs/026-plan/item-types.md "Calculated fields").
  const calculated = restores ? null : calculatedSet(caller, read);
  if (calculated) return rejected('field_calculated', calculated);
  // A create naming no status takes its type's Default State (docs/specs/026-plan/item-types.md "An item type");
  // the project is already read for the caller, so this costs no query.
  const types = typesOf(caller.doc?.itemTypes);
  const { restoredThreads: _threads, ...create } = read;
  const input = withDefaultStatuses([create], types)[0]!;
  // A required custom field left empty (docs/specs/026-plan/item-types.md "Required fields"); a restore passes.
  const missing = createRefusal(types, input);
  if (missing) return rejected(missing.error, missing.field);
  const made = await createMany(ctx, caller, [input]);
  if (made instanceof Response) return made;
  relay(ctx, projectId, made.items, [], made.rev);
  await appendItemHistory(ctx.env, projectId, made.items.map(created), historyTagOf(ctx, restores));
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
  if (!Array.isArray(body.items) || body.items.length === 0 || body.items.length > ITEM_BULK_MAX)
    return badRequest(`items must be 1 to ${ITEM_BULK_MAX} items`);
  const creates: ItemCreate[] = [];
  const reads: ReadCreate[] = [];
  let restoring = false;
  const types = typesOf(caller.doc?.itemTypes);
  for (const raw of body.items) {
    const read = readCreate(raw, caller.owner);
    if (typeof read === 'string') return rejected(read);
    const { restoredThreads: _threads, ...input } = read;
    reads.push(read);
    // A card put back (its number, votes or threads) holds what it held; any other gives no Calculated field a value.
    const restores = input.key !== undefined || input.votes !== undefined || restoresThreads(read);
    restoring ||= restores;
    const calculated = restores ? null : calculatedSet(caller, input);
    if (calculated) return rejected('field_calculated', calculated);
    // A new card missing a required field; a card carried across (a sync, a restore: its number) passes.
    const missing = createRefusal(types, input);
    if (missing) return rejected(missing.error, missing.field);
    creates.push(input);
  }
  const made = await createMany(ctx, caller, creates);
  if (made instanceof Response) return made;
  relay(ctx, projectId, made.items, [], made.rev);
  await appendItemHistory(
    ctx.env,
    projectId,
    made.items.map(created),
    historyTagOf(ctx, restoring),
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
    const cleared = clearedRequired(caller, next, item, opts.undo === true);
    if (cleared) return rejected('field_required', cleared);
    if (retiresItem(item, next) && !(await isItemEditor(ctx, caller))) return forbidden();
    const bound = fieldsWithinBounds(next.fields);
    if (bound) return rejected(bound);
    const rev = await updateItemAtRev(ctx.env, caller.projectId, next, item.rev);
    if (rev !== null) {
      relay(ctx, caller.projectId, [next], [], rev);
      await appendItemHistory(
        ctx.env,
        caller.projectId,
        [{ before: item, after: next }],
        historyTagOf(ctx, opts.undo === true),
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
  if (segments.length === 5 && segments[4] === 'patches')
    return method === 'POST' ? patches(ctx, projectId) : methodNotAllowed();
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

// A project create's seed items (an offline project's, on sync), validated
// before anything is written: the items, or the refusal.
export function readSeedItems(raw: unknown, owner: string): ReadCreate[] | Response {
  if (raw === undefined) return [];
  if (!Array.isArray(raw) || raw.length > ITEMS_MAX)
    return badRequest(`items must be at most ${ITEMS_MAX}`);
  const creates: ReadCreate[] = [];
  for (const entry of raw) {
    const input = readCreate(entry, owner);
    if (typeof input === 'string') return rejected(input);
    creates.push(input);
  }
  return creates;
}

// Writes a new project's seed items, in batches of the bulk cap. No room is open yet, so
// nothing is relayed.
export async function seedItems(
  ctx: PlanRouteContext,
  projectId: string,
  owner: string,
  creates: ReadCreate[],
): Promise<Response | null> {
  const caller: ItemCaller = { projectId, owner, scope: null };
  for (let i = 0; i < creates.length; i += ITEM_BULK_MAX) {
    const chunk = creates.slice(i, i + ITEM_BULK_MAX);
    const made = await createMany(
      ctx,
      caller,
      chunk.map(({ restoredThreads: _threads, ...c }) => c),
    );
    if (made instanceof Response) return made;
    // An offline plan's threads, synced with its cards.
    await restoreThreadsOf(ctx, projectId, made.items, chunk);
  }
  return null;
}
