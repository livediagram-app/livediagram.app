'use client';

// What Add Thread to Card offers (docs/specs/026-plan/items.md "Where it shows"): this plan's live cards only, never
// another plan's (owner, 2026-10-28). A search narrows them by a card's number, title or type (the shared card
// picker, ../card-picker.ts). `pickCardsOf` is exported for the tests.

import { useMemo } from 'react';
import { isArchived, isTrashed, type Item, type ItemTypeDef } from '@liveplanner/items';
import type { CardThread } from '@liveplanner/project';
import {
  byNewestChange,
  pickCardOf,
  useCardPickerSearch,
  type PickCard as PickerCard,
} from '../card-picker';

export { matchesPick, PICK_CARDS_SHOWN } from '../card-picker';

export type PickCard = PickerCard & {
  projectId: string;
  // The thread is on it already.
  onThread: boolean;
};

/** A plan's live cards (neither archived nor in the Trash) as the picker lists them, newest change first. */
export function pickCardsOf(
  items: Iterable<Item>,
  projectId: string,
  types: readonly ItemTypeDef[],
  thread: Pick<CardThread, 'cards'>,
): PickCard[] {
  const on = new Set(thread.cards.filter((c) => c.projectId === projectId).map((c) => c.itemId));
  const out: PickCard[] = [];
  for (const item of items) {
    if (isArchived(item) || isTrashed(item)) continue;
    out.push({ ...pickCardOf(item, types), projectId, onThread: on.has(item.id) });
  }
  return out.sort(byNewestChange);
}

export function useThreadCardPicker({
  thread,
  localItems,
  localTypes,
  projectId,
}: {
  thread: CardThread;
  localItems: ReadonlyMap<string, Item>;
  localTypes: readonly ItemTypeDef[];
  projectId: string;
}) {
  const local = useMemo(
    () => pickCardsOf(localItems.values(), projectId, localTypes, thread),
    [localItems, projectId, localTypes, thread],
  );
  return useCardPickerSearch(local);
}
