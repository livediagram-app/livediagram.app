// The item store's endpoints (docs/specs/026-plan/items.md, blueprint item-store.md "Interfaces and
// contracts"): list, create, bulk create, patch (POST), many patches (item-patches-route.ts), a vote's tally (item-tally-route.ts), move and delete under
// /api/projects/:id/items, and a card's comment writes (item-comment-routes.ts). People and agents use the
// same doors. Every write applies the pure functions of @liveplanner/items, lands guarded by the item's rev
// (retried on a lost race), and reaches the room as an ordered `items` op. Comment author ids reach only their
// author: every answer is redacted for the caller, and the room hears none (docs/specs/026-plan/items.md
// "Comments").

import type { ItemResponse, ItemsResponse } from '@liveplanner/api-schema';
import { itemForViewer, readRestoredThread } from '@liveplanner/project';
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
import { handleItemCommentRoutes } from './item-comment-routes';
import {
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
import { tally } from './item-tally-route';
import { readBody, type PlanRouteContext } from './context';

// `owner` is the caller: a restored comment thread keeps author ids on their own comments only.
function readCreate(raw: unknown, owner: string): ItemCreate | ItemRejection {
  const read = readItemCreate(raw);
  if (typeof read === 'string') return read;
  const thread = (raw as { comments?: unknown }).comments;
  const comments = thread === undefined ? undefined : readRestoredThread(thread, owner);
  if (comments === null) return 'field_value_invalid';
  return comments ? { ...read, comments: comments as unknown as ItemCreate['comments'] } : read;
}

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
  return json(body);
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
  // Votes, a thread and a key come back only with an Editor's undo: a Participant makes a fresh card.
  const restores =
    read.votes !== undefined || read.comments !== undefined || read.key !== undefined;
  if (restores && !(await isItemEditor(ctx, caller))) return forbidden();
  // A create naming no status takes its type's Default State (docs/specs/026-plan/item-types.md "An item type");
  // the project is already read for the caller, so this costs no query.
  const types = typesOf(caller.doc?.itemTypes);
  const input = withDefaultStatuses([read], types)[0]!;
  // A required custom field left empty (docs/specs/026-plan/item-types.md "Required fields"); a restore passes.
  const missing = createRefusal(types, input);
  if (missing) return rejected(missing.error, missing.field);
  const made = await createMany(ctx, caller, [input]);
  if (made instanceof Response) return made;
  relay(ctx, projectId, made.items, [], made.rev);
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
  const types = typesOf(caller.doc?.itemTypes);
  for (const raw of body.items) {
    const input = readCreate(raw, caller.owner);
    if (typeof input === 'string') return rejected(input);
    // A new card missing a required field; a card carried across (a sync, a restore: its number) passes.
    const missing = createRefusal(types, input);
    if (missing) return rejected(missing.error, missing.field);
    creates.push(input);
  }
  const made = await createMany(ctx, caller, creates);
  if (made instanceof Response) return made;
  relay(ctx, projectId, made.items, [], made.rev);
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
    const cleared = clearedRequired(caller, next, item, opts.undo === true);
    if (cleared) return rejected('field_required', cleared);
    if (retiresItem(item, next) && !(await isItemEditor(ctx, caller))) return forbidden();
    const bound = fieldsWithinBounds(next.fields);
    if (bound) return rejected(bound);
    const rev = await updateItemAtRev(ctx.env, caller.projectId, next, item.rev);
    if (rev !== null) {
      relay(ctx, caller.projectId, [next], [], rev);
      const answer: ItemResponse = { item: itemForViewer(next, caller.owner), rev };
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
  const deleted = await deleteItemRow(ctx.env, projectId, itemId);
  if (deleted === null) return itemNotFound();
  relay(ctx, projectId, [], [itemId], deleted.rev);
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
  if (segments[5] === 'comments') return handleItemCommentRoutes(ctx, projectId, itemId);
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
export function readSeedItems(raw: unknown, owner: string): ItemCreate[] | Response {
  if (raw === undefined) return [];
  if (!Array.isArray(raw) || raw.length > ITEMS_MAX)
    return badRequest(`items must be at most ${ITEMS_MAX}`);
  const creates: ItemCreate[] = [];
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
  creates: ItemCreate[],
): Promise<Response | null> {
  const caller: ItemCaller = { projectId, owner, scope: null };
  for (let i = 0; i < creates.length; i += ITEM_BULK_MAX) {
    const made = await createMany(ctx, caller, creates.slice(i, i + ITEM_BULK_MAX));
    if (made instanceof Response) return made;
  }
  return null;
}
