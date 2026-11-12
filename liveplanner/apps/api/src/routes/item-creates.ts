// Making cards (item-routes.ts, docs/specs/026-plan/items.md): a create read and checked as one, the threads a
// restore puts back, many creates written together, and a project create's seed items. The routes stay in
// item-routes.ts, which re-exports these.

import { legacyThreadOf, type CardThread } from '@liveplanner/project';
import {
  ITEMS_MAX,
  ITEM_BULK_MAX,
  ITEM_KEY_MAX,
  ITEM_WRITE_RETRIES,
  itemPlacer,
  createRefusal,
  readItemCreate,
  typesOf,
  makeItem,
  newItemId,
  type Item,
  type ItemCreate,
  type ItemPerson,
  type ItemRejection,
} from '@liveplanner/items';
import { getItemStoreHead, insertItems, listItems } from '../db';
import { badRequest, conflict, json } from '../responses';
import { cardBackOnThreads, readRestoredThreads } from './card-thread-cards';
import {
  calculatedSet,
  timeTracked,
  itemBusy,
  itemRetryPause,
  rejected,
  writer,
  type ItemCaller,
} from './item-route-kit';
import { type PlanRouteContext } from './context';

// A create as read, with the threads it puts the card back on (a restore), each checked as one.
export type ReadCreate = ItemCreate & { restoredThreads?: CardThread[] };

// `owner` is the caller: a restored comment thread keeps author ids on their own comments only. A card's old single
// thread (`comments`, from a client from before threads) is read as its first thread (docs/specs/026-plan/items.md
// "Existing comments").
export function readCreate(raw: unknown, owner: string): ReadCreate | ItemRejection {
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
export async function restoreThreadsOf(
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

export const restoresThreads = (c: ReadCreate) => (c.restoredThreads?.length ?? 0) > 0;

// A made card as its history's first entry.
export const created = (item: Item) => ({ before: null, after: item });

export async function buildCreates(
  ctx: PlanRouteContext,
  projectId: string,
  creates: readonly ItemCreate[],
  by: ItemPerson,
): Promise<Item[] | Response> {
  const head = await getItemStoreHead(ctx.env, projectId);
  if (head.count + creates.length > ITEMS_MAX) return itemsFull();
  const existing = await listItems(ctx.env, projectId);
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
  return made;
}

// A plan already holding as many cards as it may.
export const itemsFull = () =>
  json({ error: 'items_full', message: `a plan holds ${ITEMS_MAX} items` }, { status: 413 });

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
    const made = await buildCreates(ctx, caller.projectId, creates, by);
    if (made instanceof Response) return made;
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

// A many-card write's creates (`/items/bulk`, a part of `/items/import`), each read and checked as one, or the first
// refusal. `putBack`: its history says Put back only for a card that comes back with its number or votes; an
// import's cards carry a new thread (docs/specs/026-plan/tracker-import.md "Comments") and are new cards.
export function readBulkCreates(
  caller: ItemCaller,
  items: unknown,
): { creates: ItemCreate[]; reads: ReadCreate[]; putBack: boolean } | Response {
  if (!Array.isArray(items) || items.length === 0 || items.length > ITEM_BULK_MAX)
    return badRequest(`items must be 1 to ${ITEM_BULK_MAX} items`);
  const creates: ItemCreate[] = [];
  const reads: ReadCreate[] = [];
  let putBack = false;
  const types = typesOf(caller.doc?.itemTypes);
  for (const raw of items) {
    const read = readCreate(raw, caller.owner);
    if (typeof read === 'string') return rejected(read);
    const { restoredThreads: _threads, ...input } = read;
    reads.push(read);
    // A card put back (its number, votes or threads) holds what it held; any other gives no Calculated field a value.
    const restores = input.key !== undefined || input.votes !== undefined || restoresThreads(read);
    putBack ||= input.key !== undefined || input.votes !== undefined;
    const calculated = restores ? null : calculatedSet(caller, input);
    if (calculated) return rejected('field_calculated', calculated);
    const timed = restores ? null : timeTracked(caller, input);
    if (timed) return rejected('field_time_tracked', timed);
    // A new card missing a required field; a card carried across (a sync, a restore: its number) passes.
    const missing = createRefusal(types, input);
    if (missing) return rejected(missing.error, missing.field);
    creates.push(input);
  }
  return { creates, reads, putBack };
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
