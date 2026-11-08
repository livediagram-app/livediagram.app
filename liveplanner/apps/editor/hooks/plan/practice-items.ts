// Practice cards (docs/specs/026-plan/plan-tour.md "Practice cards"): items that live in this screen's store alone,
// for the Boards tour's Practice Sprint. They are drawn, dragged, opened and edited like any card, but no write that
// touches one is sent, so nobody else sees them, nothing is saved, and Undo never records them. These are the pure
// parts: laying them back over a fresh read, splitting a write between them and the real cards, and taking them away.

import {
  applyItemWrite,
  itemIdsOfWrite,
  writeLimitedTo,
  type ItemPerson,
  type ItemStoreState,
  type ItemWrite,
} from '@liveplanner/items';

// A practice card's key: none of the plan's (a real card's key is 1 or more), so it never moves the store's
// `nextKey` and the next real card keeps the number the server will give it.
export const PRACTICE_KEY = 0;

// Whether a write touches a practice card, and whether it touches only practice cards.
export function practiceShare(
  write: ItemWrite,
  practice: ReadonlySet<string>,
): 'none' | 'all' | 'some' {
  if (practice.size === 0) return 'none';
  const ids = itemIdsOfWrite(write);
  const held = ids.filter((id) => practice.has(id)).length;
  if (held === 0) return 'none';
  return held === ids.length ? 'all' : 'some';
}

// A write split between the practice cards (applied here alone) and the real ones (sent as ever).
export function splitPracticeWrite(
  write: ItemWrite,
  practice: ReadonlySet<string>,
): { practice: ItemWrite | null; real: ItemWrite | null } {
  const share = practiceShare(write, practice);
  if (share === 'none') return { practice: null, real: write };
  if (share === 'all') return { practice: write, real: null };
  const realIds = new Set(itemIdsOfWrite(write).filter((id) => !practice.has(id)));
  return { practice: writeLimitedTo(write, practice), real: writeLimitedTo(write, realIds) };
}

// Practice cards made in `state`: a create applied here, each card given PRACTICE_KEY, the store's `nextKey` as it
// was. Null when the store refuses it (full, an id taken).
export function addPracticeItems(
  state: ItemStoreState,
  write: Extract<ItemWrite, { kind: 'create' }>,
  by: ItemPerson,
  now: number,
): ItemStoreState | null {
  const made = applyItemWrite(state, write, { now, by });
  if (!made.ok) return null;
  const ids = new Set(itemIdsOfWrite(write));
  return {
    ...made.state,
    items: made.state.items.map((i) => (ids.has(i.id) ? { ...i, key: PRACTICE_KEY } : i)),
    nextKey: state.nextKey,
  };
}

// A practice write applied here: the store moved on, or null when it is refused (a status its type leaves out).
export function applyPracticeWrite(
  state: ItemStoreState,
  write: ItemWrite,
  by: ItemPerson,
  now: number,
): ItemStoreState | null {
  const done = applyItemWrite(state, write, { now, by });
  return done.ok ? { ...done.state, nextKey: state.nextKey } : null;
}

// A fresh read (or a merge) with the practice cards laid back over it, as `prev` held them: a read never has them.
export function keepPracticeItems(
  next: ItemStoreState,
  prev: ItemStoreState,
  practice: ReadonlySet<string>,
): ItemStoreState {
  if (practice.size === 0) return next;
  const kept = prev.items.filter((i) => practice.has(i.id));
  if (kept.length === 0) return next;
  return { ...next, items: [...next.items.filter((i) => !practice.has(i.id)), ...kept] };
}

// The store with the practice cards taken away.
export function withoutPracticeItems(
  state: ItemStoreState,
  practice: ReadonlySet<string>,
): ItemStoreState {
  if (practice.size === 0) return state;
  return { ...state, items: state.items.filter((i) => !practice.has(i.id)) };
}
