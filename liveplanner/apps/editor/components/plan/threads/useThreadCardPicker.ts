'use client';

// What Add Thread to Card offers (docs/specs/026-plan/items.md "Where it shows"): this plan's live cards only, never
// another plan's (owner, 2026-10-28). A search narrows them by a card's number, title or type. Pure parts
// (`pickCardsOf`, `matchesPick`) are exported for the tests.

import { useMemo, useState } from 'react';
import {
  isArchived,
  isTrashed,
  itemTitle,
  typeIn,
  type Item,
  type ItemTypeDef,
} from '@liveplanner/items';
import type { CardThread } from '@liveplanner/project';

// Cards a list draws until a search narrows it.
export const PICK_CARDS_SHOWN = 50;

export type PickCard = {
  projectId: string;
  itemId: string;
  key: number;
  title: string;
  typeLabel: string;
  glyph: string | undefined;
  color: string | undefined;
  updatedAt: number;
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
    const type = typeIn(types, item.type);
    out.push({
      projectId,
      itemId: item.id,
      key: item.key,
      title: itemTitle(item) || 'Untitled',
      typeLabel: type.label,
      glyph: type.glyph,
      color: type.color,
      updatedAt: item.updatedAt,
      onThread: on.has(item.id),
    });
  }
  return out.sort((a, b) => b.updatedAt - a.updatedAt);
}

/** Whether a card matches the search: its number (`12`, `#12`), its title or its type, case aside. */
export function matchesPick(card: PickCard, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  const num = q.startsWith('#') ? q.slice(1) : q;
  if (/^\d+$/.test(num)) return String(card.key) === num || card.title.toLowerCase().includes(q);
  return card.title.toLowerCase().includes(q) || card.typeLabel.toLowerCase().includes(q);
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
  const [query, setQuery] = useState('');
  const local = useMemo(
    () => pickCardsOf(localItems.values(), projectId, localTypes, thread),
    [localItems, projectId, localTypes, thread],
  );
  const q = query.trim().toLowerCase();
  const shown = useMemo(() => {
    const matched = local.filter((c) => matchesPick(c, q));
    return q ? matched : matched.slice(0, PICK_CARDS_SHOWN);
  }, [local, q]);
  return { query, setQuery, shown };
}
