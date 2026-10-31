// Created At, Created By, Last Edited At and Last Edited By (docs/specs/026-plan/items.md "Created and Last Edited"):
// four read-only card fields that read an item's own stamps (which writes stamp them: item-edit.ts). Pure, so the card
// face, the panel, sorts, lanes, filters and exports all read a card's stamps alike. Type-only imports: board-sort and
// board read this while the item modules load.
import type { Item, ItemPerson } from './item';

// The four stamps, by the item property each reads.
export const STAMP_FIELDS = ['createdAt', 'createdBy', 'updatedAt', 'updatedBy'] as const;
export type StampField = (typeof STAMP_FIELDS)[number];
export type StampTimeField = 'createdAt' | 'updatedAt';
export type StampPersonField = 'createdBy' | 'updatedBy';

export const STAMP_FIELD_LABELS: Readonly<Record<StampField, string>> = {
  createdAt: 'Created At',
  createdBy: 'Created By',
  updatedAt: 'Last Edited At',
  updatedBy: 'Last Edited By',
};

export function isStampField(field: unknown): field is StampField {
  return typeof field === 'string' && (STAMP_FIELDS as readonly string[]).includes(field);
}

// When the card was made or last edited, or undefined for a card stored without one (never a guess).
export function itemStampTime(
  item: Partial<Pick<Item, StampTimeField>>,
  field: StampTimeField,
): number | undefined {
  const v = item[field];
  return typeof v === 'number' && Number.isFinite(v) && v > 0 ? v : undefined;
}

// Who made the card or last edited it, or undefined for a card that lost its person (the api reads one it cannot
// parse as an empty id) or never had one.
export function itemStampPerson(
  item: Partial<Pick<Item, StampPersonField>>,
  field: StampPersonField,
): ItemPerson | undefined {
  const p = item[field];
  return p && typeof p.id === 'string' && p.id !== '' && typeof p.name === 'string' && p.name
    ? p
    : undefined;
}

// Whether the card holds this stamp, so a face draws it (or leaves its row out).
export function itemHasStamp(item: Partial<Pick<Item, StampField>>, field: StampField): boolean {
  return field === 'createdAt' || field === 'updatedAt'
    ? itemStampTime(item, field) !== undefined
    : itemStampPerson(item, field) !== undefined;
}

// A moment's local calendar day, `YYYY-MM-DD`: what a stamp's lane and filter group by.
export function stampDay(ms: number): string {
  const d = new Date(ms);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

// A moment as a stamp's tooltip and spoken label give it, in the viewer's locale: "3 Oct 2026, 14:02". One formatter,
// made on first use (a board labels every card it draws).
let momentFormat: Intl.DateTimeFormat | undefined;
export function stampMomentLabel(ms: number): string {
  momentFormat ??= new Intl.DateTimeFormat(undefined, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
  return momentFormat.format(new Date(ms));
}
