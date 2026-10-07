// The Display tab's edits to a card layout (docs/specs/026-plan/item-types.md "Editing a type": Display): add a field
// to its default slot, take one off, and move one to a slot at a place. Pure; each returns a new layout, or the same
// one when the edit does nothing (a field that does not fit, one already placed).
import {
  CARD_SLOTS,
  cardLayoutFields,
  cardSlotFits,
  defaultCardSlot,
  type CardField,
  type CardLayout,
  type CardSize,
  type CardSlot,
} from '@livediagram/items';

const without = (layout: CardLayout, field: CardField): CardLayout => {
  const out: CardLayout = {};
  for (const [slot, fields] of Object.entries(layout) as [CardSlot, readonly CardField[]][]) {
    const kept = fields.filter((f) => f !== field);
    if (kept.length) out[slot] = kept;
  }
  return out;
};

export function addCardField(size: CardSize, layout: CardLayout, field: CardField): CardLayout {
  if (cardLayoutFields(size, layout).includes(field)) return layout;
  const slot = defaultCardSlot(size, field);
  if (!cardSlotFits(size, slot, field)) return layout;
  return { ...layout, [slot]: [...(layout[slot] ?? []), field] };
}

export function removeCardField(layout: CardLayout, field: CardField): CardLayout {
  return without(layout, field);
}

// A field moved to `slot` at `index` (counted among that slot's other fields); refused where it does not fit.
export function moveCardField(
  size: CardSize,
  layout: CardLayout,
  field: CardField,
  slot: CardSlot,
  index: number,
): CardLayout {
  if (!cardSlotFits(size, slot, field)) return layout;
  const rest = without(layout, field);
  const list = [...(rest[slot] ?? [])];
  list.splice(Math.max(0, Math.min(list.length, index)), 0, field);
  return { ...rest, [slot]: list };
}

// The slot before or after `from` in reading order that takes `field` (the keyboard's Up and Down), or null.
export function neighbourSlot(
  size: CardSize,
  from: CardSlot,
  field: CardField,
  by: -1 | 1,
): CardSlot | null {
  const slots = CARD_SLOTS[size];
  for (let i = slots.indexOf(from) + by; i >= 0 && i < slots.length; i += by)
    if (cardSlotFits(size, slots[i]!, field)) return slots[i]!;
  return null;
}
