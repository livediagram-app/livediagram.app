// A card's values as text (docs/specs/026-plan/item-types.md "Card display", docs/specs/004-interface-design/date-fields.md
// "Showing a date"): the dates, custom field values and checklist progress a card face shows, shared by the editor's
// card face and every export, so a board reads the same on the canvas and in its picture.

import { linkText } from './card-links';
import { CURRENCY_DEFAULT, type CustomFieldDef } from './item-types';
import type { Item, ItemFieldValue } from './item';

const FORMATS = {
  // A board card, where room is tight: "30 Oct".
  short: { day: 'numeric', month: 'short' },
  // The card panel and its custom fields: "30 Oct 2026".
  medium: { day: 'numeric', month: 'short', year: 'numeric' },
  // A card's slide: "30 October 2026".
  long: { day: 'numeric', month: 'long', year: 'numeric' },
} as const satisfies Record<string, Intl.DateTimeFormatOptions>;

export type DayLabelStyle = keyof typeof FORMATS;

// One formatter per style, made on first use: a board labels every card's dates on each render, and
// `toLocaleDateString` builds a formatter per call (2000 labels: 65 ms against 12 ms cached).
const formatters = new Map<DayLabelStyle, Intl.DateTimeFormat>();

// A saved day in the viewer's locale; a value that is not a day reads as it is.
export function dayLabel(day: string, style: DayLabelStyle = 'short'): string {
  const d = new Date(`${day}T00:00:00`);
  if (Number.isNaN(d.getTime())) return day;
  let f = formatters.get(style);
  if (!f) {
    f = new Intl.DateTimeFormat(undefined, FORMATS[style]);
    formatters.set(style, f);
  }
  return f.format(d);
}

const NO_ITEMS: ReadonlyMap<string, Item> = new Map();

// A custom field's value as one line of text, null when there is nothing to show (no value, or a value of the
// wrong kind, say after a field's kind changed). `items` resolves a Card field's value (a card id) to that card's
// title, or "Missing card" (docs/specs/026-plan/item-types.md "Card fields").
export function customFieldText(
  field: CustomFieldDef,
  value: ItemFieldValue | undefined,
  items: ReadonlyMap<string, Item> = NO_ITEMS,
): string | null {
  if (value === undefined || value === null || value === '') return null;
  switch (field.kind) {
    case 'checkbox':
      return value === true ? 'Yes' : value === false ? 'No' : null;
    case 'number':
      // Grouped as the reader's locale groups digits ("82,000"), up to two decimals.
      return typeof value === 'number'
        ? value.toLocaleString(undefined, { maximumFractionDigits: 2 })
        : null;
    case 'date': {
      if (typeof value !== 'string') return null;
      return dayLabel(value, 'medium');
    }
    case 'link':
      return typeof value === 'string' ? linkHost(value) : null;
    case 'currency':
      return typeof value === 'number' ? currencyText(value, field.currency) : null;
    case 'email':
      return typeof value === 'string' ? value : null;
    case 'card':
      return linkText(items, value);
    default:
      return typeof value === 'string' ? value.split('\n')[0]! : null;
  }
}

// An amount in its currency as the reader's locale writes it ("£12,500", "$1,200.50"): whole amounts without
// pence, any other with two places.
export function currencyText(value: number, code: string = CURRENCY_DEFAULT): string {
  const whole = Number.isInteger(value);
  try {
    return value.toLocaleString(undefined, {
      style: 'currency',
      currency: code,
      minimumFractionDigits: whole ? 0 : 2,
      maximumFractionDigits: whole ? 0 : 2,
    });
  } catch {
    return `${code} ${value.toLocaleString()}`;
  }
}

// A link as a card has room for it: its site, less any www. ("sentry.io"); the address less its scheme when it is
// not one.
export function linkHost(url: string): string {
  try {
    return new URL(url).host.replace(/^www\./, '') || url;
  } catch {
    return url.replace(/^https?:\/\//, '');
  }
}

// A card's checklist as done of total, null without one.
export function checklistProgress(
  item: Pick<Item, 'fields'>,
): { done: number; total: number } | null {
  const rows = item.fields['checklist'];
  if (!Array.isArray(rows) || rows.length === 0) return null;
  const done = rows.filter(
    (r) => !!r && typeof r === 'object' && (r as { done?: unknown }).done === true,
  ).length;
  return { done, total: rows.length };
}
