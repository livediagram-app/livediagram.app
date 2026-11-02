// An item's own colour (docs/specs/026-plan/items.md "Colour"): any `#rrggbb` the colour picker gives
// (docs/specs/004-interface-design/colour-picker.md), shown beside the type colour, never instead of it.
import type { Item } from './item';
import type { ItemTypeDef } from './item-types';
import { HEX_COLOUR } from './validate';

const ITEM_COLOUR_FIELD = 'color';

// A value as a lower-case `#rrggbb`, or undefined when it is not one.
export function itemColourValue(v: unknown): string | undefined {
  if (typeof v !== 'string') return undefined;
  const lower = v.trim().toLowerCase();
  return HEX_COLOUR.test(lower) ? lower : undefined;
}

// The field a type's cards take their colour from (docs/specs/026-plan/item-types.md "Fields by role"): its Card
// Colour while the type still offers it, else the built-in Colour.
export function colourFieldOf(
  type: Pick<ItemTypeDef, 'colourField' | 'fields'> | undefined,
): string {
  const own = type?.colourField;
  return own && type.fields.includes(own) ? own : ITEM_COLOUR_FIELD;
}

// The colour an item draws with, or undefined (none, or a stored value that is not a colour): its type's Card Colour
// field when the type is given.
export function itemColourOf(
  item: Pick<Item, 'fields'>,
  type?: Pick<ItemTypeDef, 'colourField' | 'fields'>,
): string | undefined {
  return itemColourValue(item.fields[colourFieldOf(type)]);
}
