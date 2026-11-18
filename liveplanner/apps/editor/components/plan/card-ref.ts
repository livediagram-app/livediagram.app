'use client';

// A card's number as people see it (docs/specs/026-plan/item-types.md "Card number prefixes"): "WI-12", its type's
// prefix and its number, read from the plan's catalogue; "#12" outside a plan or for a type the catalogue lacks.
import { useCallback } from 'react';
import { cardRefOrKey, type ItemTypeDef } from '@liveplanner/items';
import { usePlan } from './PlanContext';

export type CardRefOf = (card: { key: number; type: string }) => string;

// The namer for `types`: the same function for the same catalogue, so a memoised row keeps its props.
const namers = new WeakMap<readonly ItemTypeDef[], CardRefOf>();
const bare: CardRefOf = (card) => `#${card.key}`;
export function cardRefIn(types: readonly ItemTypeDef[] | undefined): CardRefOf {
  if (!types) return bare;
  let namer = namers.get(types);
  if (!namer) {
    namer = (card) => cardRefOrKey(card, types);
    namers.set(types, namer);
  }
  return namer;
}

// A card known by its id and number alone (an automation run's, a thread's): its live card's ref when the plan has
// it, "#12" otherwise (a card since deleted, or in another plan).
export function useCardRefById(): (card: { id: string; key: number }) => string {
  const plan = usePlan();
  const items = plan?.items;
  const types = plan?.types;
  return useCallback(
    (card) => {
      const live = items?.get(card.id);
      return live ? cardRefIn(types)(live) : `#${card.key}`;
    },
    [items, types],
  );
}
