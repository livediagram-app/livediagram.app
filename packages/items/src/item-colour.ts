// An item's own colour (docs/specs/026-plan/items.md "Colour"): one of the twelve swatches a card type is given
// from, shown beside the type colour, never instead of it.
import type { Item } from './item';
import { PLAN_TYPE_COLOURS } from './type-catalogue';

export const ITEM_COLOUR_FIELD = 'color';

// A value as the palette spells it, or undefined when it is not one of the swatches.
export function itemColourValue(v: unknown): string | undefined {
  if (typeof v !== 'string') return undefined;
  const lower = v.trim().toLowerCase();
  return PLAN_TYPE_COLOURS.find((c) => c === lower);
}

// The colour an item draws with, or undefined (none, or a stored value that is not a swatch).
export function itemColourOf(item: Pick<Item, 'fields'>): string | undefined {
  return itemColourValue(item.fields[ITEM_COLOUR_FIELD]);
}
