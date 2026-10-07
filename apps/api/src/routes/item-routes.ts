// The item store's endpoints (docs/specs/026-plan/items.md, blueprint item-store.md "Interfaces and
// contracts"): list, create, bulk create, patch (POST), move, vote and delete under
// /api/documents/:id/items, and a card's comment writes (item-comment-routes.ts). People and agents use the
// same doors. Every write applies the pure functions of @livediagram/items, lands guarded by the item's rev
// (retried on a lost race), and reaches the room as an ordered `items` op. Comment author ids reach only their
// author: every answer is redacted for the caller, and the room hears none (docs/specs/026-plan/items.md
// "Comments").

import type { ItemResponse, ItemsResponse } from '@livediagram/api-schema';
import { itemForRoom, itemForViewer, readRestoredThread } from '@livediagram/document';
import {
  ITEMS_MAX,
  ITEM_BULK_MAX,
  ITEM_STATUS_MAX,
  ITEM_WRITE_RETRIES,
  isSwimlaneSettable,
  applyMove,
  applyPatch,
  applyVote,
  fieldsWithinBounds,
  isValidItemId,
  isValidItemType,
  itemIdsShownOnTab,
  itemPersonId,
  makeItem,
  newItemId,
  validateClear,
  validateFields,
  validateVotes,
  type Item,
  type ItemCreate,
  type ItemMove,
  type ItemPatch,
  type ItemPerson,
  type ItemPlace,
  type ItemRejection,
  type TabItemElement,
} from '@livediagram/items';
import {
  deleteItemRow,
  getDocument,
  getItemStoreHead,
  getItemsRev,
  getParticipant,
  getTab,
  insertItems,
  itemKeyTaken,
  listItems,
  readItem,
  updateItemAtRev,
} from '../db';
import { badRequest, forbidden, json, methodNotAllowed, noContent, notFound } from '../responses';
import { relayItems } from '../room-client';
import { refuseGuestVoteOverCap } from '../vote-integrity';
import { handleItemCommentRoutes } from './item-comment-routes';
import {
  deniedOnTab,
  gateEdit,
  gateGrant,
  gateParticipate,
  gateRead,
  missingDocument,
  readBody,
  requireOwner,
  type RouteContext,
} from './context';

type Level = 'read' | 'participate' | 'edit';

export type ItemCaller = {
  documentId: string;
  owner: string;
  // The document, for the gates a comment delete checks (item-comment-routes.ts); absent on a new document's
  // seed, which writes no comments.
  doc?: NonNullable<Awaited<ReturnType<typeof getDocument>>>;
  // The item ids the caller may touch, when their grant is confined to one tab.
  scope: Set<string> | null;
  // The store as read to work out that scope, so a list does not read it twice.
  items?: Item[];
};

const GATES = { read: gateRead, participate: gateParticipate, edit: gateEdit } as const;

function rejected(error: ItemRejection, field?: string): Response {
  console.info('[items] items.rejected', { error, field });
  return json({ error, ...(field ? { field } : {}) }, { status: 400 });
}

const itemNotFound = () => json({ error: 'item_not_found' }, { status: 404 });
const itemBusy = () => {
  console.warn('[items] items.write.busy');
  return json(
    { error: 'item_busy', message: 'the item kept changing; try again' },
    { status: 409 },
  );
};

// The caller and their reach: the whole document, or (a tab-scoped grant) the items one tab shows.
export async function itemCaller(
  ctx: RouteContext,
  documentId: string,
  level: Level,
): Promise<ItemCaller | Response> {
  const owner = requireOwner(ctx);
  if (owner instanceof Response) return owner;
  const doc = await getDocument(ctx.env, documentId);
  if (!doc) return missingDocument(ctx, documentId);
  const gate = GATES[level];
  if (await gate(ctx, documentId, doc.ownerId, doc.teamId))
    return { documentId, owner, doc, scope: null };
  const tabId = ctx.url.searchParams.get('tabId');
  if (!tabId) {
    // A whole-document grant that falls short of the level (a view link writing) is refused
    // outright; a grant confined to one tab must name it.
    const grant = await gateGrant(ctx, documentId, doc.ownerId, doc.teamId);
    return grant && grant.tabScope === null ? forbidden() : deniedOnTab(ctx, doc);
  }
  if (!(await gate(ctx, documentId, doc.ownerId, doc.teamId, tabId))) return deniedOnTab(ctx, doc);
  const tab = await getTab(ctx.env, documentId, tabId);
  if (!tab) return notFound();
  const items = await listItems(ctx.env, documentId);
  return {
    documentId,
    owner,
    doc,
    scope: itemIdsShownOnTab(tab.elements as unknown as TabItemElement[], items),
    items,
  };
}

async function writer(ctx: RouteContext, owner: string): Promise<ItemPerson> {
  const p = await getParticipant(ctx.env, owner);
  return {
    id: await itemPersonId(owner),
    name: p?.name ?? 'Someone',
    color: p?.color ?? '#94a3b8',
  };
}

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

function relay(
  ctx: RouteContext,
  documentId: string,
  upserts: Item[],
  removed: string[],
  rev: number,
) {
  ctx.waitUntil?.(
    relayItems(ctx.env, documentId, {
      kind: 'items',
      upserts: upserts.map(itemForRoom),
      removed,
      rev,
    }),
  );
}

// What a caller is answered with: their own comment author ids, nobody else's.
const forCaller = (caller: ItemCaller, items: Item[]) =>
  items.map((i) => itemForViewer(i, caller.owner));

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

// Creates `creates` in one batch; keys from the store's next key (or a free restored key).
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
    const made: Item[] = [];
    let nextKey = head.nextKey;
    const now = Date.now();
    for (const create of creates) {
      if (create.id && ids.has(create.id)) return json({ error: 'item_exists' }, { status: 409 });
      const id =
        create.id ?? newItemId(() => crypto.getRandomValues(new Uint32Array(1))[0]! / 2 ** 32);
      ids.add(id);
      let key: number;
      if (
        create.key !== undefined &&
        create.key < head.nextKey &&
        !pool.some((i) => i.key === create.key) &&
        !(await itemKeyTaken(ctx.env, caller.documentId, create.key))
      ) {
        key = create.key;
      } else {
        key = nextKey;
        nextKey += 1;
      }
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
  const input = readCreate(body, caller.owner);
  if (typeof input === 'string') return rejected(input);
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
): Promise<Response> {
  if (caller.scope && !caller.scope.has(itemId)) return itemNotFound();
  const by = await writer(ctx, caller.owner);
  for (let attempt = 1; attempt <= ITEM_WRITE_RETRIES; attempt += 1) {
    const item = await readItem(ctx.env, caller.documentId, itemId);
    if (!item) return itemNotFound();
    const next = change(item, by);
    if (next instanceof Response) return next;
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

function readPatch(body: Record<string, unknown>): ItemPatch | ItemRejection {
  const patch: ItemPatch = {};
  if (body.set !== undefined) {
    const set = validateFields(body.set, 'patch');
    if (!set.ok) return set.error;
    patch.set = set.fields;
  }
  const clear = validateClear(body.clear);
  if (!clear.ok) return clear.error;
  if (clear.keys.length) patch.clear = clear.keys;
  if (body.type !== undefined) {
    if (!isValidItemType(body.type)) return 'type_invalid';
    patch.type = body.type;
  }
  return patch;
}

async function patch(ctx: RouteContext, documentId: string, itemId: string): Promise<Response> {
  const caller = await itemCaller(ctx, documentId, 'edit');
  if (caller instanceof Response) return caller;
  const body = await readBody(ctx);
  if (body instanceof Response) return body;
  const input = readPatch(body);
  if (typeof input === 'string') return rejected(input);
  return writeItem(ctx, caller, itemId, (item, by) =>
    applyPatch(item, input, { now: Date.now(), by }),
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
  return writeItem(ctx, caller, itemId, (item, by) =>
    applyMove(item, input, items, { now: Date.now(), by }),
  );
}

async function vote(ctx: RouteContext, documentId: string, itemId: string): Promise<Response> {
  const caller = await itemCaller(ctx, documentId, 'participate');
  if (caller instanceof Response) return caller;
  const body = await readBody(ctx);
  if (body instanceof Response) return body;
  if (body.delta !== 1 && body.delta !== -1) return badRequest('delta must be 1 or -1');
  const delta = body.delta;
  // A guest's +1 counts against its network's cap of guest voters (docs/specs/012-collaboration/vote-integrity.md);
  // taking a vote back never does.
  if (delta === 1) {
    const refused = await refuseGuestVoteOverCap(ctx, documentId, caller.owner);
    if (refused) return refused;
  }
  return writeItem(ctx, caller, itemId, (item, by) =>
    applyVote(item, by.id, delta, { now: Date.now(), by }),
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
  const itemId = segments[4]!;
  if (segments.length === 5) {
    // A field patch is a POST: the api's CORS (responses.ts) admits GET, POST, PUT and DELETE.
    if (method === 'POST') return patch(ctx, documentId, itemId);
    if (method === 'DELETE') return remove(ctx, documentId, itemId);
    return methodNotAllowed();
  }
  if (segments[5] === 'comments') return handleItemCommentRoutes(ctx, documentId, itemId);
  if (segments.length === 6 && (segments[5] === 'move' || segments[5] === 'vote')) {
    if (method !== 'POST') return methodNotAllowed();
    return segments[5] === 'move' ? move(ctx, documentId, itemId) : vote(ctx, documentId, itemId);
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
