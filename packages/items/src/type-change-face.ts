// A card type's face and panel as an agent names them (docs/specs/026-plan/plan-agents.md "Changing card types"):
// `display` per card size in the slot names the type editor's Display tab shows, `tabs` as the Configuration tab's
// panel tabs, and `detailsLabel`. Every field is named as people say it ("Number", "Due Date", a custom field's
// name). Each reader answers the stored shape, or a refusal that names what the size or the type has.
import {
  CARD_SIZE_FIELDS,
  CARD_SIZES,
  isCustomCardField,
  type CardField,
  type CardSize,
} from './board';
import {
  CARD_FIELD_LABELS,
  CARD_SLOTS,
  cardSlotFits,
  readCardDisplay,
  typeOffersCardField,
  type CardDisplay,
  type CardLayout,
  type CardSlot,
} from './card-display';
import type { ItemTypeDef, ItemTypeTab } from './item-types';
import { fieldKeyOf } from './plan-names';
import { statusKey } from './status-names';
import {
  DETAILS_LABEL_DEFAULT,
  ITEM_TYPE_TAB_LABEL_MAX,
  ITEM_TYPE_TABS_MAX,
  newTabId,
} from './type-catalogue';

// Each size's slots by the names an agent gives them, in reading order.
export const DISPLAY_SLOT_NAMES: Readonly<Record<CardSize, Readonly<Record<string, CardSlot>>>> = {
  minimal: { beforeTitle: 'lead', afterTitle: 'trail' },
  compact: { besideTitle: 'lead', belowTitle: 'row', bottomRight: 'trail' },
  detailed: {
    header: 'head',
    headerEnd: 'headEnd',
    underTitle: 'body',
    footer: 'foot',
    bottomRight: 'footEnd',
  },
};

export type DisplayInput = Partial<Record<string, Readonly<Record<string, readonly string[]>>>>;
export interface TabInput {
  name: string;
  fields: readonly string[];
}

export type FaceRead<T> = { ok: true; value: T } | { ok: false; message: string };
const no = (message: string): { ok: false; message: string } => ({ ok: false, message });

// A card field's name as people say it.
function cardFieldName(f: CardField, type: Pick<ItemTypeDef, 'custom'>): string {
  if (isCustomCardField(f)) return type.custom?.find((c) => c.id === f)?.label ?? f;
  return CARD_FIELD_LABELS[f];
}

// What a size can draw, by name: its built-in fields, and any custom field the type has.
function sizeDraws(size: CardSize, type: ItemTypeDef): string {
  const built = CARD_SIZE_FIELDS[size].filter((f) => typeOffersCardField(type, f));
  const custom = (type.custom ?? []).map((c) => c.label);
  return [...built.map((f) => cardFieldName(f, type)), ...custom].join(', ');
}

// A card field by its name, its id, or a custom field's name.
function cardFieldOf(name: string, type: ItemTypeDef): CardField | null {
  const k = statusKey(name);
  for (const [id, label] of Object.entries(CARD_FIELD_LABELS))
    if (k === id || k === statusKey(label)) return id as CardField;
  if (k === 'number' || k === '#') return 'key';
  const named = fieldKeyOf(name, type);
  return named.ok ? (named.key as CardField) : null;
}

// The type's Display after `input`: each size given replaces that size's layout, a size left out keeps its own.
export function displayFrom(
  input: DisplayInput,
  type: ItemTypeDef,
): FaceRead<CardDisplay | undefined> {
  const next: Partial<Record<CardSize, CardLayout>> = { ...(type.display ?? {}) };
  for (const [sizeName, slots] of Object.entries(input)) {
    const size = CARD_SIZES.find((s) => s === statusKey(sizeName));
    if (!size) return no(`"${sizeName}" is not a card size. Sizes: ${CARD_SIZES.join(', ')}.`);
    const names = DISPLAY_SLOT_NAMES[size];
    const layout: Partial<Record<CardSlot, CardField[]>> = {};
    const seen = new Set<string>();
    for (const [slotName, fields] of Object.entries(slots ?? {})) {
      const slot =
        Object.entries(names).find(([n]) => statusKey(n) === statusKey(slotName))?.[1] ??
        CARD_SLOTS[size].find((s) => s === slotName);
      if (!slot)
        return no(
          `A ${size} card has no "${slotName}". Its places: ${Object.keys(names).join(', ')}.`,
        );
      for (const name of fields) {
        const f = cardFieldOf(name, type);
        if (!f || !typeOffersCardField(type, f) || !cardSlotFits(size, slot, f))
          return no(
            `A ${size} ${type.label} card cannot show "${name}". It can show: ${sizeDraws(size, type)}.`,
          );
        if (seen.has(f)) return no(`"${name}" is placed twice on the ${size} card.`);
        seen.add(f);
        (layout[slot] ??= []).push(f);
      }
    }
    next[size] = layout;
  }
  // As stored: a size equal to the type's default is dropped (readCardDisplay).
  const read = readCardDisplay(next, type.id);
  return read === null
    ? no('The card display is not one the editor can draw.')
    : { ok: true, value: read };
}

// The type's panel tabs from `input`, whole, keeping a same-named tab's id.
export function tabsFrom(input: readonly TabInput[], type: ItemTypeDef): FaceRead<ItemTypeTab[]> {
  if (input.length > ITEM_TYPE_TABS_MAX)
    return no(`A card type has up to ${ITEM_TYPE_TABS_MAX} tabs; ${input.length} were given.`);
  const tabs: ItemTypeTab[] = [];
  const placed = new Map<string, string>();
  for (const t of input) {
    const label = t.name.trim();
    if (!label || label.length > ITEM_TYPE_TAB_LABEL_MAX)
      return no(`A tab's name is 1 to ${ITEM_TYPE_TAB_LABEL_MAX} characters ("${t.name}").`);
    if (tabs.some((x) => statusKey(x.label) === statusKey(label)))
      return no(`Two tabs are called "${label}".`);
    const fields: string[] = [];
    for (const name of t.fields) {
      const named = fieldKeyOf(name, type);
      if (!named.ok) return no(named.message);
      const key = named.key;
      if (key === 'title') return no('Title heads the panel: it is never in a tab.');
      if (key === 'votes') return no('Votes live on the card: they are never in a tab.');
      if (!type.fields.includes(key))
        return no(`${type.label} cards have no "${name}": add it to the type first.`);
      const earlier = placed.get(key);
      if (earlier) return no(`"${name}" is in two tabs ("${earlier}" and "${label}").`);
      placed.set(key, label);
      fields.push(key);
    }
    const same = type.tabs?.find((x) => statusKey(x.label) === statusKey(label));
    const id =
      same?.id ??
      newTabId(label, [...tabs.map((x) => x.id), ...(type.tabs ?? []).map((x) => x.id)]);
    tabs.push({ id, label, fields });
  }
  return { ok: true, value: tabs };
}

// What the panel calls Details: "Details" is the default, so it stores nothing.
export function detailsLabelFrom(input: string): FaceRead<string | undefined> {
  const label = input.trim();
  if (!label || label.length > ITEM_TYPE_TAB_LABEL_MAX)
    return no(`Details' name is 1 to ${ITEM_TYPE_TAB_LABEL_MAX} characters ("${input}").`);
  return { ok: true, value: label === DETAILS_LABEL_DEFAULT ? undefined : label };
}

// A type's Display as an agent reads it back: per size, each slot by name, each field by name.
export function namedDisplay(
  type: ItemTypeDef,
  layoutAt: (size: CardSize) => CardLayout,
): Record<CardSize, Record<string, string[]>> {
  const out = {} as Record<CardSize, Record<string, string[]>>;
  for (const size of CARD_SIZES) {
    const layout = layoutAt(size);
    const slots: Record<string, string[]> = {};
    for (const [name, slot] of Object.entries(DISPLAY_SLOT_NAMES[size])) {
      const fields = layout[slot] ?? [];
      if (fields.length) slots[name] = fields.map((f) => cardFieldName(f, type));
    }
    out[size] = slots;
  }
  return out;
}
