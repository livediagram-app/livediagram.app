// An item's own colour (docs/specs/026-plan/items.md "Colour"): any `#rrggbb` the colour picker gives
// (docs/specs/004-interface-design/colour-picker.md), shown beside the type colour, never instead of it.
import type { Item } from './item';
import { HEX_COLOUR } from './validate';

export const ITEM_COLOUR_FIELD = 'color';

// A value as a lower-case `#rrggbb`, or undefined when it is not one.
export function itemColourValue(v: unknown): string | undefined {
  if (typeof v !== 'string') return undefined;
  const lower = v.trim().toLowerCase();
  return HEX_COLOUR.test(lower) ? lower : undefined;
}

// The colour an item draws with, or undefined (none, or a stored value that is not a colour).
export function itemColourOf(item: Pick<Item, 'fields'>): string | undefined {
  return itemColourValue(item.fields[ITEM_COLOUR_FIELD]);
}
