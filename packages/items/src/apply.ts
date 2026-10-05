// The item writes as pure functions (docs/specs/025-plan/items.md "Changing
// items"). The api, the offline store and the editor's optimistic updates all
// apply the same functions, so a write lands identically wherever it runs.

import type {
  Item,
  ItemCreate,
  ItemFields,
  ItemMove,
  ItemPatch,
  ItemPerson,
  ItemPlace,
} from './item';
import { itemStatus, itemVotes } from './item';
import { compareRank, rankBetween } from './rank';

export interface WriteContext {
  now: number;
  by: ItemPerson;
}

// Items in one status's column, in rank order (ties by key).
export function columnItems(
  items: Iterable<Item>,
  status: string | undefined,
  exceptId?: string,
): Item[] {
  const out: Item[] = [];
  for (const it of items) if (it.id !== exceptId && itemStatus(it) === status) out.push(it);
  return out.sort(byRank);
}

export function byRank(a: Item, b: Item): number {
  return compareRank(a.rank, b.rank) || a.key - b.key;
}

// The rank that places an item at `place` among `items` (the item itself
// excluded). A neighbour that is gone, or in another column, means the end.
export function rankForPlace(items: Iterable<Item>, place: ItemPlace, exceptId?: string): string {
  const column = columnItems(items, place.status, exceptId);
  const at = (id: string | null | undefined) => (id ? column.findIndex((i) => i.id === id) : -1);
  let index: number;
  if (place.after !== undefined) {
    index = place.after === null ? 0 : at(place.after) === -1 ? column.length : at(place.after) + 1;
  } else if (place.before !== undefined) {
    index =
      place.before === null
        ? column.length
        : at(place.before) === -1
          ? column.length
          : at(place.before);
  } else {
    index = column.length;
  }
  const prev = column[index - 1]?.rank ?? null;
  const next = column[index]?.rank ?? null;
  // Equal neighbours (a concurrent insert) leave no gap; go after the pair.
  if (prev !== null && next !== null && compareRank(prev, next) >= 0)
    return rankBetween(prev, null);
  return rankBetween(prev, next);
}

export function makeItem(
  create: ItemCreate,
  ctx: WriteContext & { id: string; key: number; items: Iterable<Item> },
): Item {
  const fields: ItemFields = { ...create.fields };
  const status = create.place?.status;
  if (status !== undefined) fields['status'] = status;
  const place: ItemPlace = {
    ...create.place,
    status: typeof fields['status'] === 'string' ? fields['status'] : undefined,
  };
  return {
    id: ctx.id,
    type: create.type,
    key: ctx.key,
    rank: rankForPlace(ctx.items, place),
    fields,
    rev: 1,
    createdAt: ctx.now,
    updatedAt: ctx.now,
    createdBy: ctx.by,
    updatedBy: ctx.by,
  };
}

export function applyPatch(item: Item, patch: ItemPatch, ctx: WriteContext): Item {
  const fields: ItemFields = { ...item.fields, ...patch.set };
  for (const k of patch.clear ?? []) delete fields[k];
  return {
    ...item,
    type: patch.type ?? item.type,
    fields,
    rev: item.rev + 1,
    updatedAt: ctx.now,
    updatedBy: ctx.by,
  };
}

export function applyMove(
  item: Item,
  move: ItemMove,
  items: Iterable<Item>,
  ctx: WriteContext,
): Item {
  const status = move.status ?? itemStatus(item);
  const fields: ItemFields = { ...item.fields, ...move.set };
  if (status !== undefined) fields['status'] = status;
  return {
    ...item,
    fields,
    rank: rankForPlace(items, { status, after: move.after, before: move.before }, item.id),
    rev: item.rev + 1,
    updatedAt: ctx.now,
    updatedBy: ctx.by,
  };
}

// A person's votes never drop below zero; a zero count is dropped.
export function applyVote(item: Item, personId: string, delta: 1 | -1, ctx: WriteContext): Item {
  const votes = itemVotes(item);
  const next = Math.max(0, (votes[personId] ?? 0) + delta);
  if (next === 0) delete votes[personId];
  else votes[personId] = next;
  return {
    ...item,
    fields: { ...item.fields, votes },
    rev: item.rev + 1,
    updatedAt: ctx.now,
    updatedBy: ctx.by,
  };
}

// The patch that undoes `patch` on `before`: old values back, new keys cleared.
export function inversePatch(before: Item, patch: ItemPatch): ItemPatch {
  const set: ItemFields = {};
  const clear: string[] = [];
  const touched = [...Object.keys(patch.set ?? {}), ...(patch.clear ?? [])];
  for (const k of touched) {
    if (Object.prototype.hasOwnProperty.call(before.fields, k)) set[k] = before.fields[k]!;
    else clear.push(k);
  }
  const inv: ItemPatch = {};
  if (Object.keys(set).length) inv.set = set;
  if (clear.length) inv.clear = clear;
  if (patch.type !== undefined && patch.type !== before.type) inv.type = before.type;
  return inv;
}

// Where an item sits now, as a place a move can return it to.
export function placeOf(item: Item, items: Iterable<Item>): ItemPlace {
  const status = itemStatus(item);
  const column = columnItems(items, status);
  const i = column.findIndex((x) => x.id === item.id);
  const before = i >= 0 ? column[i + 1] : undefined;
  return before ? { status, before: before.id } : { status, before: null };
}

export function newItemId(random: () => number = Math.random): string {
  const alphabet = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let id = '';
  for (let i = 0; i < 12; i++) id += alphabet[Math.floor(random() * alphabet.length)];
  return id;
}
