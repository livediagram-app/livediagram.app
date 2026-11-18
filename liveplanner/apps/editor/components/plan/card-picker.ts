'use client';

// The card picker's rows and search, shared by every dialog that picks a card of this plan (Add Thread to Card,
// docs/specs/026-plan/items.md "Where it shows"; Link Existing, docs/specs/026-plan/item-types.md "Link Existing"):
// a card as a row (glyph, number, title, type), matched by number (`12`, `#12`, `WI-12`), title, type or prefix, newest change
// first, at most PICK_CARDS_SHOWN until a search narrows them. Pure parts are exported for the tests.

import { useMemo, useState } from 'react';
import {
  cardRefOrKey,
  cardRefKey,
  itemTitle,
  prefixOf,
  typeIn,
  type Item,
  type ItemTypeDef,
} from '@liveplanner/items';

// Cards a list draws until a search narrows it.
export const PICK_CARDS_SHOWN = 50;

export type PickCard = {
  itemId: string;
  key: number;
  // Its number as people see it, "WI-12" (docs/specs/026-plan/item-types.md "Card number prefixes").
  ref: string;
  // Its type's prefix, so a search for it finds the type's cards; empty when the type has none.
  prefix: string;
  title: string;
  typeLabel: string;
  glyph: string | undefined;
  color: string | undefined;
  updatedAt: number;
};

/** A card as the picker draws it. */
export function pickCardOf(item: Item, types: readonly ItemTypeDef[]): PickCard {
  const type = typeIn(types, item.type);
  return {
    itemId: item.id,
    key: item.key,
    ref: cardRefOrKey(item, types),
    prefix: prefixOf(types, item.type) ?? '',
    title: itemTitle(item) || 'Untitled',
    typeLabel: type.label,
    glyph: type.glyph,
    color: type.color,
    updatedAt: item.updatedAt,
  };
}

/** Newest change first, the picker's order. */
export function byNewestChange(a: PickCard, b: PickCard): number {
  return b.updatedAt - a.updatedAt;
}

/** Whether a card matches the search: its number (`12`, `#12`, `WI-12`), its title, its type or its prefix, case aside. */
export function matchesPick(card: PickCard, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  const key = cardRefKey(q);
  if (key !== null) return card.key === key || card.title.toLowerCase().includes(q);
  return (
    card.title.toLowerCase().includes(q) ||
    card.typeLabel.toLowerCase().includes(q) ||
    card.prefix.toLowerCase() === q
  );
}

/** The search over a picker's cards: everything matching, or the first PICK_CARDS_SHOWN with no search. */
export function useCardPickerSearch<C extends PickCard>(cards: readonly C[]) {
  const [query, setQuery] = useState('');
  const q = query.trim().toLowerCase();
  const shown = useMemo(() => {
    const matched = cards.filter((c) => matchesPick(c, q));
    return q ? matched : matched.slice(0, PICK_CARDS_SHOWN);
  }, [cards, q]);
  return { query, setQuery, shown };
}
