'use client';

import { useMemo, useRef } from 'react';
import {
  assignedPeople,
  peopleKey,
  planPeople,
  type Item,
  type ItemPerson,
} from '@liveplanner/items';

// Who a card can be assigned to (docs/specs/026-plan/items.md "Who may do what"): you, your teams' members and
// the custom assignees the plan's cards hold. Worked out again when the cards change, but handed on as the same
// array until the people themselves do, so a title typed on a card does not re-render every picker.
export function usePlanPeople(
  self: ItemPerson | null | undefined,
  teamPeople: readonly ItemPerson[],
  items: ReadonlyMap<string, Item>,
): readonly ItemPerson[] {
  const kept = useRef<{ key: string; people: readonly ItemPerson[] } | null>(null);
  return useMemo(() => {
    const people = planPeople(self, teamPeople, assignedPeople([...items.values()]));
    const key = peopleKey(people);
    if (kept.current?.key !== key) kept.current = { key, people };
    return kept.current.people;
  }, [self, teamPeople, items]);
}
