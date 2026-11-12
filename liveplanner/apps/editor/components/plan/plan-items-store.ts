'use client';

// The plan's cards as a card reads them (docs/specs/026-plan/blueprints/plan-board.md "Card redraws"): each card face
// picks the little it shows of other cards (its linked cards, a Calculated field's value, its open blockers) through
// usePlanItemsSelect, and redraws only when that pick changes. Handing every card the whole items map redrew all
// 2,000 cards of a board on every drop and edit, each holding a Parent field that reads it (plan-board.md "A drag
// stays smooth").
import type { Item } from '@liveplanner/items';
import { createContext, use, useRef, useSyncExternalStore } from 'react';
import { usePlan } from './PlanContext';
import { noSubscribe, useValueStore, type ValueStore } from './value-store';

export type PlanItems = ReadonlyMap<string, Item>;

export type PlanItemsStore = ValueStore<PlanItems | undefined>;

export const PlanItemsStoreContext = createContext<PlanItemsStore | null>(null);

export const usePlanItemsStore = (items: PlanItems | undefined): PlanItemsStore =>
  useValueStore(items);

const NO_ITEMS: PlanItems = new Map();

// What `select` picks from the plan's cards, the same value while `equal` says it is unchanged. `deps` are what the
// pick reads besides the cards (the card itself, the types): a change to one picks again. Outside a PlanProvider (a test's
// stand-in plan) it picks from the plan's own map.
export function usePlanItemsSelect<T>(
  select: (items: PlanItems) => T,
  equal: (a: T, b: T) => boolean,
  deps: readonly unknown[],
): T {
  // Kept from the React Compiler: the last pick lives in a ref read while drawing, which it may not cache around.
  'use no memo';
  const store = use(PlanItemsStoreContext);
  const last = useRef<{ items: PlanItems; deps: readonly unknown[]; value: T } | null>(null);
  const pick = (items: PlanItems): T => {
    const had = last.current;
    const sameDeps = !!had && sameEntries(had.deps, deps);
    if (had && sameDeps && had.items === items) return had.value;
    const next = select(items);
    const value = had && sameDeps && equal(had.value, next) ? had.value : next;
    last.current = { items, deps, value };
    return value;
  };
  // oxlint-disable-next-line react-hooks/rules-of-hooks -- a caller passes a store always or never, so the call never changes between renders
  const own = store ? undefined : usePlan()?.items;
  const snapshot = () => pick((store ? store.get() : own) ?? NO_ITEMS);
  return useSyncExternalStore(store?.subscribe ?? noSubscribe, snapshot, snapshot);
}

// Two picks of the same length holding the same entries.
export function sameEntries<T>(a: readonly T[], b: readonly T[]): boolean {
  return a.length === b.length && a.every((x, i) => x === b[i]);
}
