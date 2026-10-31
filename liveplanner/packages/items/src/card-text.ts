// A card's values as text (docs/specs/026-plan/item-types.md "Card display", docs/specs/004-interface-design/date-fields.md
// "Showing a date"): the dates, custom field values and checklist progress a card face shows, shared by the editor's
// card face and every export, so a board reads the same on the canvas and in its picture.

import { linkText } from './card-links';
import { percentText, percentValue } from './percent-fields';
import { CURRENCY_DEFAULT, ratingScaleOf, type CustomFieldDef } from './item-types';
import type { Item, ItemFieldValue } from './item';
import { itemColourValue } from './item-colour';
import { fieldCardIds, fieldPeople } from './several-values';

const FORMATS = {
  // A board card, where room is tight: "30 Oct".
  short: { day: 'numeric', month: 'short' },
  // The card panel and its custom fields: "30 Oct 2026".
  medium: { day: 'numeric', month: 'short', year: 'numeric' },
  // A card's slide: "30 October 2026".
  long: { day: 'numeric', month: 'long', year: 'numeric' },
} as const satisfies Record<string, Intl.DateTimeFormatOptions>;

type DayLabelStyle = keyof typeof FORMATS;

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
    // "40%", held to 0..100 (docs/specs/026-plan/item-types.md "Percent").
    case 'percent': {
      const n = percentValue(value);
      return n === undefined ? null : percentText(n);
    }
    case 'email':
      return typeof value === 'string' ? value : null;
    // Every linked card or person of a field that holds several, joined (item-types.md "Holds Several").
    case 'card': {
      const ids = fieldCardIds(field, value);
      return ids.length ? ids.map((id) => linkText(items, id)).join(', ') : null;
    }
    case 'multichoice':
      return multiChoiceText(value);
    case 'rating':
      return ratingText(value, ratingScaleOf(field));
    // The built-in fields' kinds read as those fields do (docs/specs/026-plan/item-types.md "Custom field kinds").
    case 'person': {
      const names = fieldPeople(field, value)
        .map((p) => personName(p))
        .filter(Boolean);
      return names.length ? names.join(', ') : null;
    }
    case 'labels':
      return multiChoiceText(value);
    case 'colour':
      return itemColourValue(value) ?? null;
    case 'checklist': {
      const p = checklistRowsProgress(value);
      return p ? `${p.done}/${p.total}` : null;
    }
    // A picture is drawn, never written: the card face shows its thumbnail (docs/specs/026-plan/item-types.md
    // "Image fields").
    case 'image':
      return null;
    // A Comments field's threads are not a value; a Votes field reads as its total (docs/specs/026-plan/item-types.md
    // "Comments and Votes fields").
    case 'comments':
      return null;
    case 'votes': {
      const total = voteTotalOf(value);
      return total > 0 ? String(total) : null;
    }
    default:
      return typeof value === 'string' ? value.split('\n')[0]! : null;
  }
}

// A person value's name (the Assignee's `{ id, name, color }`), null for anything else or a blank name.
export function personName(value: ItemFieldValue | undefined): string | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const name = (value as { name?: unknown }).name;
  return typeof name === 'string' && name.trim() ? name.trim() : null;
}

// A Multiple Choice's picks as one line ("Vegan, Gluten free"); null with none.
export function multiChoiceText(value: ItemFieldValue | undefined): string | null {
  if (!Array.isArray(value)) return typeof value === 'string' && value ? value : null;
  const picks = value.filter((v): v is string => typeof v === 'string' && v !== '');
  return picks.length ? picks.join(', ') : null;
}

// A Rating as a card shows it (docs/specs/030-forms/forms.md "New card field kinds"): stars filled to the value up to
// a scale of RATING_STARS_ON_CARD, else "7 / 10"; null for no rating.
export const RATING_STARS_ON_CARD = 5;
export function ratingText(value: ItemFieldValue | undefined, scale: number): string | null {
  if (typeof value !== 'number' || !Number.isInteger(value) || value < 1) return null;
  const n = Math.min(value, scale);
  if (scale > RATING_STARS_ON_CARD) return `${n} / ${scale}`;
  return '★'.repeat(n) + '☆'.repeat(scale - n);
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

// A link as a card has room for it: its site, less any www., and its last path step when it has one, so links to one
// site are told apart ("sentry.io/…/4521"); the address less its scheme when it is not one.
export function linkHost(url: string): string {
  try {
    const u = new URL(url);
    const site = u.host.replace(/^www\./, '');
    const steps = u.pathname.split('/').filter(Boolean);
    const last = steps[steps.length - 1];
    if (!site) return url;
    if (!last) return site;
    return `${site}/${steps.length > 1 ? '…/' : ''}${decodeURIComponent(last)}`;
  } catch {
    return url.replace(/^https?:\/\//, '');
  }
}

// A card's checklist as done of total, null without one: the built-in Checklist, or the Checklist field `field`.
export function checklistProgress(
  item: Pick<Item, 'fields'>,
  field = 'checklist',
): { done: number; total: number } | null {
  return checklistRowsProgress(item.fields[field]);
}

// Checklist rows as done of total, null for none (or a value that is not a list).
export function checklistRowsProgress(
  rows: ItemFieldValue | undefined,
): { done: number; total: number } | null {
  if (!Array.isArray(rows) || rows.length === 0) return null;
  const done = rows.filter(
    (r) => !!r && typeof r === 'object' && (r as { done?: unknown }).done === true,
  ).length;
  return { done, total: rows.length };
}

// A Votes value's total dots (`{ voter: dots }`, as the built-in Votes holds them); 0 for anything else.
export function voteTotalOf(value: ItemFieldValue | undefined): number {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return 0;
  let total = 0;
  for (const n of Object.values(value)) if (typeof n === 'number' && n > 0) total += n;
  return total;
}
