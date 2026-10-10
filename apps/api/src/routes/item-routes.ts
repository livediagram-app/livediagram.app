// The item store's endpoints (docs/specs/026-plan/items.md, blueprint item-store.md "Interfaces and
// contracts"): list, create, bulk create, patch (POST), many patches (item-patches-route.ts), a vote's tally (item-tally-route.ts), move and delete under
// /api/documents/:id/items, and a card's comment writes (item-comment-routes.ts). People and agents use the
// same doors. Every write applies the pure functions of @livediagram/items, lands guarded by the item's rev
// (retried on a lost race), and reaches the room as an ordered `items` op. Comment author ids reach only their
// author: every answer is redacted for the caller, and the room hears none (docs/specs/026-plan/items.md
// "Comments").

import type { ItemResponse, ItemsResponse } from '@livediagram/api-schema';
import { itemForViewer, readRestoredThread } from '@livediagram/document';
import {
  ITEMS_MAX,
  ITEM_BULK_MAX,
  ITEM_KEY_MAX,
  ITEM_STATUS_MAX,
  ITEM_WRITE_RETRIES,
  isSwimlaneSettable,
  applyMove,
  applyPatch,
  fieldsWithinBounds,
  isValidItemId,
  isValidItemType,
  typesOf,
  withDefaultStatuses,
  makeItem,
  newItemId,
  validateFields,
  validateVotes,
  type Item,
  type ItemCreate,
  type ItemMove,
  type ItemPerson,
  type ItemPlace,
  type ItemRejection,
} from '@livediagram/items';
import {
  deleteItemRow,
  getItemStoreHead,
  getItemsRev,
  insertItems,
  itemKeyTaken,
  listItems,
  readItem,
  updateItemAtRev,
} from '../db';
import { badRequest, conflict, forbidden, json, methodNotAllowed, noContent } from '../responses';
import { handleItemCommentRoutes } from './item-comment-routes';
import {
  excludedStatus,
  forCaller,
  itemBusy,
  itemCaller,
  itemNotFound,
  readPatch,
  rejected,
  relay,
  writer,
  type ItemCaller,
} from './item-route-kit';
import { patches } from './item-patches-route';
import { tally } from './item-tally-route';
import { readBody, type RouteContext } from './context';

function readPlace(raw: unknown): ItemPlace | ItemRejection {
  if (raw === undefined) return {};
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return 'place_invalid';
  const p = raw as Record<string, unknown>;
  const place: ItemPlace = {};
  if (p.status !== undefined) {
    if (typeof p.status !== 'string' || !p.status.trim() || p.status.length > ITEM_STATUS_MAX)
      return 'place_invalid';
    place.status = p.status.trim();
  }
  for (const side of ['after', 'before'] as const) {
    const v = p[side];
    if (v === undefined) continue;
    if (v !== null && !isValidItemId(v)) return 'place_invalid';
    place[side] = v;
  }
  return place;
}

// `owner` is the caller: a restored comment thread keeps author ids on their own comments only.
function readCreate(raw: unknown, owner: string): ItemCreate | ItemRejection {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return 'field_value_invalid';
  const b = raw as Record<string, unknown>;
  if (!isValidItemType(b.type)) return 'type_invalid';
  if (b.id !== undefined && !isValidItemId(b.id)) return 'id_invalid';
  const fields = validateFields(b.fields, 'create');
  if (!fields.ok) return fields.error;
  const place = readPlace(b.place);
  if (typeof place === 'string') return place;
  const bound = fieldsWithinBounds(fields.fields);
  if (bound) return bound;
  const votes = validateVotes(b.votes);
  if (!votes) return 'field_value_invalid';
  const comments = b.comments === undefined ? undefined : readRestoredThread(b.comments, owner);
  if (comments === null) return 'field_value_invalid';
  return {
    type: b.type,
    fields: fields.fields,
    place,
    ...(Object.keys(votes).length ? { votes } : {}),
    ...(comments ? { comments: comments as unknown as ItemCreate['comments'] } : {}),
    ...(typeof b.id === 'string' ? { id: b.id } : {}),
    ...(typeof b.key === 'number' && Number.isInteger(b.key) && b.key > 0 ? { key: b.key } : {}),
  };
}

// GET /items: the store, or the items a tab-scoped caller's tab shows.
async function list(ctx: RouteContext, documentId: string): Promise<Response> {
  const caller = await itemCaller(ctx, documentId, 'read');
  if (caller instanceof Response) return caller;
  const [items, rev] = await Promise.all([
    caller.items ?? listItems(ctx.env, documentId),
    getItemsRev(ctx.env, documentId),
  ]);
  const shown = caller.scope ? items.filter((i) => caller.scope!.has(i.id)) : items;
  const body: ItemsResponse = { items: forCaller(caller, shown), rev };
  return json(body);
}

// Creates `creates` in one batch. A named key (a restore, an offline sync, a copy) is kept while it is free, below
// the store's next key or above it; every other create takes the next key not already in use.
async function createMany(
  ctx: RouteContext,
  caller: ItemCaller,
  creates: ItemCreate[],
): Promise<{ items: Item[]; rev: number } | Response> {
  const by = await writer(ctx, caller.owner);
  for (let attempt = 1; attempt <= ITEM_WRITE_RETRIES; attempt += 1) {
    const head = await getItemStoreHead(ctx.env, caller.documentId);
    if (head.count + creates.length > ITEMS_MAX) {
      return json(
        { error: 'items_full', message: `a document holds ${ITEMS_MAX} items` },
        { status: 413 },
      );
    }
    const existing = await listItems(ctx.env, caller.documentId);
    const ids = new Set(existing.map((i) => i.id));
    const pool = [...existing];
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
      if (
        create.key !== undefined &&
        create.key <= ITEM_KEY_MAX &&
        !keys.has(create.key) &&
        !(await itemKeyTaken(ctx.env, caller.documentId, create.key))
      ) {
        key = create.key;
      } else {
        // A key named earlier in this batch may sit at or above the next key.
        while (keys.has(nextKey)) nextKey += 1;
        key = nextKey;
        nextKey += 1;
      }
      keys.add(key);
      const item = makeItem(create, { id, key, now, by, items: pool });
      pool.push(item);
      made.push(item);
    }
    try {
      const rev = await insertItems(ctx.env, caller.documentId, made);
      return { items: made, rev };
    } catch (err) {
      // A key or id taken by a write that raced this one: read again and retry.
      console.info('[items] items.write.retry', {
        documentId: caller.documentId,
        attempt,
        error: String(err),
      });
    }
  }
  return itemBusy();
}

async function create(ctx: RouteContext, documentId: string): Promise<Response> {
  const caller = await itemCaller(ctx, documentId, 'edit');
  if (caller instanceof Response) return caller;
  const body = await readBody(ctx);
  if (body instanceof Response) return body;
  const read = readCreate(body, caller.owner);
  if (typeof read === 'string') return rejected(read);
  // A create naming no status takes its type's Default State (docs/specs/026-plan/item-types.md "An item type");
  // the document is already read for the caller, so this costs no query.
  const input = withDefaultStatuses([read], typesOf(caller.doc?.itemTypes))[0]!;
  const made = await createMany(ctx, caller, [input]);
  if (made instanceof Response) return made;
  relay(ctx, documentId, made.items, [], made.rev);
  console.info('[items] created', { documentId, agent: ctx.token !== null });
  const answer: ItemResponse = { item: forCaller(caller, made.items)[0]!, rev: made.rev };
  return json(answer, { status: 201 });
}

async function bulk(ctx: RouteContext, documentId: string): Promise<Response> {
  const caller = await itemCaller(ctx, documentId, 'edit');
  if (caller instanceof Response) return caller;
  // Bulk writes (an offline document's items, on sync) are whole-document writes.
  if (caller.scope) return forbidden();
  const body = await readBody(ctx);
  if (body instanceof Response) return body;
  if (!Array.isArray(body.items) || body.items.length === 0 || body.items.length > ITEM_BULK_MAX)
    return badRequest(`items must be 1 to ${ITEM_BULK_MAX} items`);
  const creates: ItemCreate[] = [];
  for (const raw of body.items) {
    const input = readCreate(raw, caller.owner);
    if (typeof input === 'string') return rejected(input);
    creates.push(input);
  }
  const made = await createMany(ctx, caller, creates);
  if (made instanceof Response) return made;
  relay(ctx, documentId, made.items, [], made.rev);
  console.info('[items] bulk created', { documentId, count: made.items.length });
  const answer: ItemsResponse = { items: forCaller(caller, made.items), rev: made.rev };
  return json(answer, { status: 201 });
}

// Reads the item, applies `change` and writes at the rev read; a lost race reads again. A change may answer
// with a Response instead (a refusal, or nothing to write).
export async function writeItem(
  ctx: RouteContext,
  caller: ItemCaller,
  itemId: string,
  change: (item: Item, by: ItemPerson) => Item | Response,
  // An undo or redo (the body's `undo: true`): a card type's left-out statuses do not refuse it.
  opts: { undo?: boolean } = {},
): Promise<Response> {
  if (caller.scope && !caller.scope.has(itemId)) return itemNotFound();
  const by = await writer(ctx, caller.owner);
  for (let attempt = 1; attempt <= ITEM_WRITE_RETRIES; attempt += 1) {
    const item = await readItem(ctx.env, caller.documentId, itemId);
    if (!item) return itemNotFound();
    const next = change(item, by);
    if (next instanceof Response) return next;
    if (excludedStatus(caller, next, item, opts.undo === true))
      return rejected('status_excluded', 'status');
    const bound = fieldsWithinBounds(next.fields);
    if (bound) return rejected(bound);
    const rev = await updateItemAtRev(ctx.env, caller.documentId, next, item.rev);
    if (rev !== null) {
      relay(ctx, caller.documentId, [next], [], rev);
      const answer: ItemResponse = { item: itemForViewer(next, caller.owner), rev };
      return json(answer);
    }
    console.info('[items] items.write.retry', { documentId: caller.documentId, attempt });
  }
  return itemBusy();
}

async function patch(ctx: RouteContext, documentId: string, itemId: string): Promise<Response> {
  const caller = await itemCaller(ctx, documentId, 'edit');
  if (caller instanceof Response) return caller;
  const body = await readBody(ctx);
  if (body instanceof Response) return body;
  const input = readPatch(body);
  if (typeof input === 'string') return rejected(input);
  return writeItem(
    ctx,
    caller,
    itemId,
    (item, by) => applyPatch(item, input, { now: Date.now(), by }),
    { undo: body.undo === true },
  );
}

function readMove(body: Record<string, unknown>): ItemMove | ItemRejection {
  const place = readPlace(body);
  if (typeof place === 'string') return place;
  const move: ItemMove = place;
  const lane = readPatch(body);
  if (typeof lane === 'string') return lane;
  const touched = [...Object.keys(lane.set ?? {}), ...(lane.clear ?? [])];
  // A move sets only what a swimlane stands for (docs/specs/026-plan/plan-board.md "Swimlanes by a field").
  if (touched.some((k) => !isSwimlaneSettable(k))) return 'place_invalid';
  if (lane.set) move.set = lane.set;
  if (lane.clear) move.clear = lane.clear;
  if (lane.type) move.type = lane.type;
  return move;
}

async function move(ctx: RouteContext, documentId: string, itemId: string): Promise<Response> {
  const caller = await itemCaller(ctx, documentId, 'edit');
  if (caller instanceof Response) return caller;
  const body = await readBody(ctx);
  if (body instanceof Response) return body;
  const input = readMove(body);
  if (typeof input === 'string') return rejected(input);
  // The neighbours are read before the change runs (the change itself is synchronous).
  const items = await listItems(ctx.env, documentId);
  return writeItem(
    ctx,
    caller,
    itemId,
    (item, by) => applyMove(item, input, items, { now: Date.now(), by }),
    { undo: body.undo === true },
  );
}

async function remove(ctx: RouteContext, documentId: string, itemId: string): Promise<Response> {
  const caller = await itemCaller(ctx, documentId, 'edit');
  if (caller instanceof Response) return caller;
  if (caller.scope && !caller.scope.has(itemId)) return itemNotFound();
  const rev = await deleteItemRow(ctx.env, documentId, itemId);
  if (rev === null) return itemNotFound();
  relay(ctx, documentId, [], [itemId], rev);
  console.info('[items] deleted', { documentId, agent: ctx.token !== null });
  return noContent();
}

// The item routes, or null for a path that is not theirs.
export async function handleItemRoutes(ctx: RouteContext): Promise<Response | null> {
  const { segments, request } = ctx;
  if (segments[3] !== 'items') return null;
  const documentId = segments[2]!;
  const method = request.method;
  if (segments.length === 4) {
    if (method === 'GET') return list(ctx, documentId);
    if (method === 'POST') return create(ctx, documentId);
    return methodNotAllowed();
  }
  if (segments.length === 5 && segments[4] === 'bulk')
    return method === 'POST' ? bulk(ctx, documentId) : methodNotAllowed();
  if (segments.length === 5 && segments[4] === 'patches')
    return method === 'POST' ? patches(ctx, documentId) : methodNotAllowed();
  if (segments.length === 5 && segments[4] === 'tally')
    return method === 'POST' ? tally(ctx, documentId) : methodNotAllowed();
  const itemId = segments[4]!;
  if (segments.length === 5) {
    // A field patch is a POST: the api's CORS (responses.ts) admits GET, POST, PUT and DELETE.
    if (method === 'POST') return patch(ctx, documentId, itemId);
    if (method === 'DELETE') return remove(ctx, documentId, itemId);
    return methodNotAllowed();
  }
  if (segments[5] === 'comments') return handleItemCommentRoutes(ctx, documentId, itemId);
  // A card is voted on through the tab's session vote, its tally added at the end (`/items/tally`); the old
  // per-card vote route is gone (docs/specs/012-collaboration/session-tools.md "Voting on Plan cards").
  if (segments.length === 6 && segments[5] === 'move') {
    if (method !== 'POST') return methodNotAllowed();
    return move(ctx, documentId, itemId);
  }
  return null;
}

// A document create's seed items (an offline document's, on sync), validated
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

// Writes a new document's seed items, in batches of the bulk cap. No room is open yet, so
// nothing is relayed.
export async function seedItems(
  ctx: RouteContext,
  documentId: string,
  owner: string,
  creates: ItemCreate[],
): Promise<Response | null> {
  const caller: ItemCaller = { documentId, owner, scope: null };
  for (let i = 0; i < creates.length; i += ITEM_BULK_MAX) {
    const made = await createMany(ctx, caller, creates.slice(i, i + ITEM_BULK_MAX));
    if (made instanceof Response) return made;
  }
  return null;
}
