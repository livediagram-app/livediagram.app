// What a card type's cards show at each card size, and where (docs/specs/026-plan/item-types.md "Card display"):
// each size draws its fields in slots (Minimal before and after its title; Compact beside and below it; Detailed a
// header, a header end, under the title and a footer), each slot an ordered list of fields. A type's own layout for a
// size, else its default: a built-in type's own field set, by id, or the generic one, each placed where a board drew
// it before layouts existed. A card face shows a field only when its type's layout and its board's Show on Cards both
// allow it.
//
// board.ts reads the type catalogue, which reads this, so nothing here touches board.ts's values while the modules
// load: they are read inside functions.
import { CARD_FIELDS, CARD_SIZE_FIELDS, type CardField, type CardSize } from './board';
import type { ItemTypeDef } from './item-types';

export type CardSlot = 'lead' | 'trail' | 'row' | 'head' | 'headEnd' | 'body' | 'foot';
export type CardLayout = Partial<Record<CardSlot, readonly CardField[]>>;
export type CardDisplay = Partial<Record<CardSize, CardLayout>>;

// Each size's slots, in reading order.
export const CARD_SLOTS: Readonly<Record<CardSize, readonly CardSlot[]>> = {
  minimal: ['lead', 'trail'],
  compact: ['lead', 'row'],
  detailed: ['head', 'headEnd', 'body', 'foot'],
};

export const CARD_SLOT_LABELS: Readonly<Record<CardSize, Partial<Record<CardSlot, string>>>> = {
  minimal: { lead: 'Before the Title', trail: 'After the Title' },
  compact: { lead: 'Beside the Title', row: 'Below the Title' },
  detailed: { head: 'Header', headEnd: 'Header End', body: 'Under the Title', foot: 'Footer' },
};

// Where a board drew each field before layouts existed, in its order: a field's default slot and place.
const DRAWN: Readonly<Record<CardSize, Partial<Record<CardSlot, readonly CardField[]>>>> = {
  minimal: { lead: ['key'], trail: ['priority', 'due', 'assignee'] },
  compact: {
    lead: ['type', 'key'],
    row: ['priority', 'start', 'due', 'votes', 'comments', 'assignee'],
  },
  detailed: {
    head: ['type', 'key'],
    headEnd: ['priority'],
    body: ['parent', 'description', 'labels'],
    foot: ['start', 'due', 'estimate', 'checklist', 'comments', 'votes', 'assignee'],
  },
};

// What each size can draw, in drawing order.
export function cardDisplayFields(size: CardSize): readonly CardField[] {
  return CARD_SIZE_FIELDS[size];
}

// The slot a field goes to when added.
export function defaultCardSlot(size: CardSize, field: CardField): CardSlot {
  for (const slot of CARD_SLOTS[size]) if (DRAWN[size][slot]?.includes(field)) return slot;
  return CARD_SLOTS[size].at(-1)!;
}

// Whether a field may sit in a slot: one its size draws, and Description only Under the Title.
export function cardSlotFits(size: CardSize, slot: CardSlot, field: CardField): boolean {
  if (!CARD_SLOTS[size].includes(slot) || !CARD_SIZE_FIELDS[size].includes(field)) return false;
  return field !== 'description' || slot === 'body';
}

// A set of fields placed where a board drew them, in its order.
export function cardLayoutFrom(size: CardSize, fields: readonly CardField[]): CardLayout {
  const out: Partial<Record<CardSlot, CardField[]>> = {};
  for (const slot of CARD_SLOTS[size]) {
    const placed = (DRAWN[size][slot] ?? []).filter((f) => fields.includes(f));
    if (placed.length) out[slot] = placed;
  }
  return out;
}

// The fields a layout shows, slot by slot.
export function cardLayoutFields(size: CardSize, layout: CardLayout): CardField[] {
  return CARD_SLOTS[size].flatMap((slot) => [...(layout[slot] ?? [])]);
}

// The built-in types' default field sets, by id.
const BUILT_IN_FIELDS: Readonly<Record<string, Partial<Record<CardSize, readonly CardField[]>>>> = {
  project: {
    compact: ['key', 'type', 'assignee', 'priority', 'start', 'due', 'comments'],
    detailed: [
      'key',
      'type',
      'assignee',
      'priority',
      'labels',
      'start',
      'due',
      'checklist',
      'comments',
      'description',
    ],
  },
  task: {
    compact: ['key', 'type', 'assignee', 'priority', 'due', 'comments'],
    detailed: [
      'key',
      'type',
      'assignee',
      'priority',
      'labels',
      'estimate',
      'due',
      'checklist',
      'comments',
      'description',
      'parent',
    ],
  },
  note: {
    compact: ['type', 'votes', 'comments'],
    detailed: ['type', 'votes', 'comments', 'description'],
  },
  idea: {
    compact: ['type', 'votes', 'comments'],
    detailed: ['type', 'labels', 'votes', 'comments', 'description'],
  },
  action: {
    compact: ['key', 'type', 'assignee', 'due', 'comments'],
    detailed: ['key', 'type', 'assignee', 'due', 'checklist', 'comments', 'description'],
  },
};

function genericFields(size: CardSize): readonly CardField[] {
  return size === 'minimal' ? [] : size === 'compact' ? CARD_SIZE_FIELDS.compact : CARD_FIELDS;
}

// A size's default layout for a type.
export function defaultCardLayout(typeId: string, size: CardSize): CardLayout {
  return cardLayoutFrom(size, BUILT_IN_FIELDS[typeId]?.[size] ?? genericFields(size));
}

// A type's layout at a size: its own, else its default.
export function typeCardLayout(
  type: Pick<ItemTypeDef, 'id' | 'display'>,
  size: CardSize,
): CardLayout {
  return type.display?.[size] ?? defaultCardLayout(type.id, size);
}

// The fields a type's cards show at a size.
export function typeCardDisplay(
  type: Pick<ItemTypeDef, 'id' | 'display'>,
  size: CardSize,
): readonly CardField[] {
  return cardLayoutFields(size, typeCardLayout(type, size));
}

// A field the type can show: one it offers (Number and Type always; the rest when in its fields).
export function typeOffersCardField(type: Pick<ItemTypeDef, 'fields'>, field: CardField): boolean {
  return field === 'key' || field === 'type' || type.fields.includes(field);
}

export function sameCardLayout(size: CardSize, a: CardLayout, b: CardLayout): boolean {
  return CARD_SLOTS[size].every((slot) => {
    const x = a[slot] ?? [];
    const y = b[slot] ?? [];
    return x.length === y.length && x.every((f, i) => f === y[i]);
  });
}

// A stored Display as it is kept: each size's slots holding fields that fit there, each field once; a size equal to
// its default is dropped, and so is an empty Display. Null for anything malformed.
export function readCardDisplay(input: unknown, typeId: string): CardDisplay | null | undefined {
  if (input === undefined) return undefined;
  if (typeof input !== 'object' || input === null || Array.isArray(input)) return null;
  const out: Partial<Record<CardSize, CardLayout>> = {};
  for (const [sizeKey, raw] of Object.entries(input)) {
    if (sizeKey !== 'minimal' && sizeKey !== 'compact' && sizeKey !== 'detailed') return null;
    const size: CardSize = sizeKey;
    if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return null;
    const layout: Partial<Record<CardSlot, CardField[]>> = {};
    const seen = new Set<string>();
    for (const [slotKey, list] of Object.entries(raw as Record<string, unknown>)) {
      const slot = slotKey as CardSlot;
      if (!CARD_SLOTS[size].includes(slot) || !Array.isArray(list)) return null;
      const fields: CardField[] = [];
      for (const f of list) {
        if (typeof f !== 'string' || seen.has(f) || !cardSlotFits(size, slot, f as CardField))
          return null;
        seen.add(f);
        fields.push(f as CardField);
      }
      if (fields.length) layout[slot] = fields;
    }
    if (!sameCardLayout(size, layout, defaultCardLayout(typeId, size))) out[size] = layout;
  }
  return Object.keys(out).length ? out : undefined;
}
