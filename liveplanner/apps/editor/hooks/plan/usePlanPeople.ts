'use client';

import { useMemo, useState } from 'react';
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
  const fresh = useMemo(
    () => planPeople(self, teamPeople, assignedPeople([...items.values()])),
    [self, teamPeople, items],
  );
  const key = peopleKey(fresh);
  // The list last handed on, kept until the people change (React's "storing information from previous renders").
  const [kept, setKept] = useState({ key, people: fresh });
  if (kept.key !== key) {
    setKept({ key, people: fresh });
    return fresh;
  }
  return kept.people;
}
