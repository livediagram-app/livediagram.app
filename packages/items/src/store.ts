// An item store as a value (docs/specs/026-plan/blueprints/item-store.md): the items, the store's
// revision and the next key, with every write applied as a pure transition. The editor applies
// writes optimistically through it, and an offline document's store is written by it, so a write
// lands the same way in the browser as in the api.

import type { Item, ItemCreate, ItemMove, ItemPatch, ItemPerson } from './item';
import { itemStatus, itemVotes } from './item';
import {
  applyMove,
  applyPatch,
  applyVote,
  byRank,
  inversePatch,
  makeItem,
  newItemId,
  placeOf,
} from './apply';
import { ITEMS_MAX } from './limits';

export type ItemStoreState = { items: Item[]; rev: number; nextKey: number };

export const EMPTY_ITEM_STORE: ItemStoreState = { items: [], rev: 0, nextKey: 1 };

// `undo`: the write is an undo or redo, putting back a change already made, so a card type's left-out statuses do
// not refuse it (docs/specs/026-plan/item-types.md "An item type"). Sent to the api as `undo: true` in the body.
export type ItemWrite =
  | { kind: 'create'; creates: ItemCreate[] }
  | { kind: 'patch'; id: string; patch: ItemPatch; undo?: true }
  // Many items changed as one write (a card type's or a removed column's cards to the Trash).
  | { kind: 'patches'; patches: ItemPatchOf[]; undo?: true }
  | { kind: 'move'; id: string; move: ItemMove; undo?: true }
  | { kind: 'vote'; id: string; delta: 1 | -1 }
  | { kind: 'delete'; id: string };

export type ItemPatchOf = { id: string; patch: ItemPatch };

export type ItemWriteError = 'item_not_found' | 'item_exists' | 'items_full';

export type ItemWriteResult =
  | { ok: true; state: ItemStoreState; upserts: Item[]; removed: string[] }
  | { ok: false; error: ItemWriteError };

export type ItemWriteContext = { now: number; by: ItemPerson; newId?: () => string };

function replaced(items: Item[], next: Item): Item[] {
  return items.map((i) => (i.id === next.id ? next : i));
}

export function applyItemWrite(
  state: ItemStoreState,
  write: ItemWrite,
  ctx: ItemWriteContext,
): ItemWriteResult {
  const base = { now: ctx.now, by: ctx.by };
  if (write.kind === 'create') {
    if (state.items.length + write.creates.length > ITEMS_MAX)
      return { ok: false, error: 'items_full' };
    const pool = [...state.items];
    const ids = new Set(pool.map((i) => i.id));
    const keys = new Set(pool.map((i) => i.key));
    const made: Item[] = [];
    let nextKey = state.nextKey;
    for (const create of write.creates) {
      if (create.id && ids.has(create.id)) return { ok: false, error: 'item_exists' };
      const id = create.id ?? (ctx.newId ?? newItemId)();
      ids.add(id);
      // A restored key (undo of a delete) is honoured while it is free and was handed out before.
      const restore =
        create.key !== undefined && create.key < state.nextKey && !keys.has(create.key);
      const key = restore ? create.key! : nextKey++;
      keys.add(key);
      const item = makeItem(create, { ...base, id, key, items: pool });
      pool.push(item);
      made.push(item);
    }
    return {
      ok: true,
      state: { items: pool, rev: state.rev + 1, nextKey },
      upserts: made,
      removed: [],
    };
  }
  if (write.kind === 'patches') {
    const byId = new Map(state.items.map((i) => [i.id, i]));
    for (const { id, patch } of write.patches) {
      const item = byId.get(id);
      if (!item) return { ok: false, error: 'item_not_found' };
      byId.set(id, applyPatch(item, patch, base));
    }
    return {
      ok: true,
      state: { ...state, items: state.items.map((i) => byId.get(i.id)!), rev: state.rev + 1 },
      // An item patched twice is sent once, as it ends.
      upserts: [...new Set(write.patches.map((p) => p.id))].map((id) => byId.get(id)!),
      removed: [],
    };
  }
  const item = state.items.find((i) => i.id === write.id);
  if (!item) return { ok: false, error: 'item_not_found' };
  if (write.kind === 'delete') {
    return {
      ok: true,
      state: { ...state, items: state.items.filter((i) => i.id !== write.id), rev: state.rev + 1 },
      upserts: [],
      removed: [write.id],
    };
  }
  const next =
    write.kind === 'patch'
      ? applyPatch(item, write.patch, base)
      : write.kind === 'move'
        ? applyMove(item, write.move, state.items, base)
        : applyVote(item, ctx.by.id, write.delta, base);
  return {
    ok: true,
    state: { ...state, items: replaced(state.items, next), rev: state.rev + 1 },
    upserts: [next],
    removed: [],
  };
}

// Folds a write someone else made (the room's `items` op, an api answer) into a store: per item
// the higher rev wins, so ops arriving out of order never roll an item back.
export function mergeItemChanges(
  state: ItemStoreState,
  upserts: readonly Item[],
  removed: readonly string[],
  rev: number,
): ItemStoreState {
  const byId = new Map(state.items.map((i) => [i.id, i]));
  for (const u of upserts) {
    const have = byId.get(u.id);
    if (!have || u.rev >= have.rev) byId.set(u.id, u);
  }
  for (const id of removed) byId.delete(id);
  const maxKey = Math.max(0, ...[...byId.values()].map((i) => i.key));
  return {
    items: [...byId.values()],
    rev: Math.max(state.rev, rev),
    nextKey: Math.max(state.nextKey, maxKey + 1),
  };
}

// The writes that undo `write`, made against `before` and answered with `made` (a create's items as
// made, so its redo restores the same ids and keys). Null: not undoable (a vote is taken back by
// voting minus, docs/specs/026-plan/items.md "Undo").
export function inverseItemWrites(before: ItemStoreState, write: ItemWrite): ItemWrite[] | null {
  if (write.kind === 'vote') return null;
  if (write.kind === 'create') return write.creates.map((c) => ({ kind: 'delete', id: c.id! }));
  if (write.kind === 'patches') {
    // Each item's old values, last patch first, as one write.
    const byId = new Map(before.items.map((i) => [i.id, i]));
    const undo: ItemPatchOf[] = [];
    for (const { id, patch } of write.patches) {
      const item = byId.get(id);
      if (!item) return null;
      undo.unshift({ id, patch: inversePatch(item, patch) });
      byId.set(id, applyPatch(item, patch, { now: item.updatedAt, by: item.updatedBy }));
    }
    return [{ kind: 'patches', patches: undo }];
  }
  const item = before.items.find((i) => i.id === write.id);
  if (!item) return null;
  if (write.kind === 'delete') {
    return [
      { kind: 'create', creates: [{ ...itemAsCreate(item), place: placeOf(item, before.items) }] },
    ];
  }
  if (write.kind === 'patch')
    return [{ kind: 'patch', id: item.id, patch: inversePatch(item, write.patch) }];
  const lane = inversePatch(item, {
    set: write.move.set,
    clear: write.move.clear,
    type: write.move.type,
  });
  const move: ItemMove = { ...placeOf(item, before.items) };
  if (lane.set) move.set = lane.set;
  if (lane.clear) move.clear = lane.clear;
  if (lane.type) move.type = lane.type;
  return [{ kind: 'move', id: item.id, move }];
}

// A write marked as an undo or redo (`undo` above): a patch or a move; any other write is returned as it is.
export function asUndoWrite(write: ItemWrite): ItemWrite {
  return write.kind === 'patch' || write.kind === 'patches' || write.kind === 'move'
    ? { ...write, undo: true }
    : write;
}

// A create made replayable: every create carries the id it was given, so redo makes the same item.
export function withCreateIds(write: ItemWrite, newId: () => string = newItemId): ItemWrite {
  if (write.kind !== 'create') return write;
  return { kind: 'create', creates: write.creates.map((c) => (c.id ? c : { ...c, id: newId() })) };
}

// An item as the create that makes it again: id, type, key, fields, votes and comments (an undo of a delete).
export function itemAsCreate(item: Item): ItemCreate {
  const { votes: _votes, comments, ...fields } = item.fields;
  const votes = itemVotes(item);
  return {
    id: item.id,
    type: item.type,
    key: item.key,
    fields,
    ...(Object.keys(votes).length ? { votes } : {}),
    ...(comments !== undefined ? { comments } : {}),
  };
}

// A whole store as the creates that rebuild it in order (an offline document's sync): each column's
// items in rank order, so appending them one by one keeps every column as it was.
export function storeAsCreates(items: readonly Item[]): ItemCreate[] {
  return [...items]
    .sort((a, b) => {
      const sa = itemStatus(a) ?? '';
      const sb = itemStatus(b) ?? '';
      return sa < sb ? -1 : sa > sb ? 1 : byRank(a, b);
    })
    .map(itemAsCreate);
}
