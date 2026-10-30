// The statuses a card type uses (docs/specs/026-plan/item-types.md "The statuses a type uses"): one ordered list per
// type, the order of every status menu for its cards. A status joins a type's list when it first appears on a board
// that takes the type, and only then, so a new board's statuses never reach the types it does not take. A type
// stored before the list (legacy: none, or the statuses it left out) reads as every status the boards name less its
// exclusions, and is written in the new shape once (withTypeStatuses with `planStatuses`).
import { boardAddTypes, normaliseBoardSetup } from './board';
import type { ItemTypeDef } from './item-types';
import {
  typesOf,
  validateItemTypeCatalogue,
  ITEM_TYPE_STATUSES_MAX,
  type ItemTypeCatalogue,
  type TypeStatusesPart,
} from './type-catalogue';

// The statuses `type` uses, in its order: its list, or for a legacy type `planStatuses` (every status the boards
// name, in order) less the ones it leaves out.
export function typeStatusesOf(
  type: TypeStatusesPart,
  planStatuses: Iterable<string>,
): readonly string[] {
  if (type.statuses) return type.statuses;
  const off = new Set(type.excludedStatuses ?? []);
  return [...planStatuses].filter((s) => !off.has(s));
}

// Every status the board set-ups name as a column, once, in the order given (All Cards and Archive boards name
// none).
export function planStatusOrder(setups: readonly unknown[]): string[] {
  const out = new Set<string>();
  for (const raw of setups) {
    const setup = normaliseBoardSetup(raw);
    if (!setup || setup.allCards || setup.archive) continue;
    for (const c of setup.columns) out.add(c.status);
  }
  return [...out];
}

// Per type id, the statuses of the boards that take the type, in board and column order, each once: a board that
// names no types (or only deleted ones) takes every type, one that names none takes none (boardAddTypes). All
// Cards and Archive boards give none.
export function boardTypeStatuses(
  setups: readonly unknown[],
  typeIds: readonly string[],
): Map<string, string[]> {
  const out = new Map<string, Set<string>>(typeIds.map((id) => [id, new Set()]));
  const types = typeIds.map((id) => ({ id }));
  for (const raw of setups) {
    const setup = normaliseBoardSetup(raw);
    if (!setup || setup.allCards || setup.archive || setup.columns.length === 0) continue;
    for (const t of boardAddTypes(setup, types))
      for (const c of setup.columns) out.get(t.id)!.add(c.status);
  }
  return new Map([...out].map(([id, s]) => [id, [...s]]));
}

// Per type id, the statuses the boards `after` give it that the boards `before` did not: a column added, a new
// board, or a type a board starts taking. Types given nothing new are left out.
export function boardStatusJoins(
  before: readonly unknown[],
  after: readonly unknown[],
  typeIds: readonly string[],
): Map<string, string[]> {
  const was = boardTypeStatuses(before, typeIds);
  const joins = new Map<string, string[]>();
  for (const [id, now] of boardTypeStatuses(after, typeIds)) {
    const had = new Set(was.get(id));
    const fresh = now.filter((s) => !had.has(s));
    if (fresh.length) joins.set(id, fresh);
  }
  return joins;
}

// The catalogue with each legacy type written in the new shape (when `planStatuses` is given: every status the
// boards name, in order) and then each type's `joins` appended where its list lacks them, up to
// ITEM_TYPE_STATUSES_MAX. A legacy type with no `planStatuses` is left as it is (it already takes a new status).
// Null when nothing changes, or when the result would not be a valid catalogue (too large to store), so a join never
// makes the card types unsaveable.
export function withTypeStatuses(
  catalogue: ItemTypeCatalogue | null,
  opts: { joins?: ReadonlyMap<string, readonly string[]>; planStatuses?: readonly string[] },
): ItemTypeCatalogue | null {
  if (!catalogue) return null;
  let changed = false;
  const types = typesOf(catalogue).map((t): ItemTypeDef => {
    let next = t;
    if (!next.statuses && opts.planStatuses) {
      const derived = typeStatusesOf(next, opts.planStatuses);
      // Never cut a legacy type's statuses short: one with more than the list holds stays legacy.
      if (derived.length <= ITEM_TYPE_STATUSES_MAX) {
        next = { ...next, statuses: derived };
        delete next.excludedStatuses;
      }
    }
    const join = opts.joins?.get(t.id);
    if (next.statuses && join?.length) {
      const list = [...next.statuses];
      for (const s of join)
        if (!list.includes(s) && list.length < ITEM_TYPE_STATUSES_MAX) list.push(s);
      if (list.length !== next.statuses.length) next = { ...next, statuses: list };
    }
    if (next !== t) changed = true;
    return next;
  });
  if (!changed) return null;
  const checked = validateItemTypeCatalogue({ ...catalogue, types });
  return checked.ok ? checked.catalogue : null;
}
