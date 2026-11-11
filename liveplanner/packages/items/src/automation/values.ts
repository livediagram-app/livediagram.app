// Automations: the values a rule's text holds (docs/specs/026-plan/automations.md "Values"; blueprint automations.md
// "Files"). `{{card.title}}` and the rest, found, checked against the names Insert a Value offers, and filled in when a
// rule runs, in the rule's time zone. Filling is one pass: what a card holds is never read as a value again. Pure.

import { itemAssignee, itemStatus, itemTitle, type Item, type ItemFieldValue } from '../item';
import type { ItemTypeDef } from '../item-types';
import { PRIORITY_LABELS, isPriority } from '../fields';
import { addDays, isDay, localDay } from '../repeat-dates';
import { dayNumber, dayParts, MONTH_SHORT } from '../plan-view-dates';
import { zonedParts } from '../date-time-fields';
import { AUTOMATION_VALUE_NAMES, type AutomationDay } from './types';
import { fieldOfName, statusName, type AutomationOutline } from './outline';

export const VALUE_NAMES = AUTOMATION_VALUE_NAMES;
const FIXED: ReadonlySet<string> = new Set(AUTOMATION_VALUE_NAMES);

const VALUE = /\{\{([^{}]*)\}\}/g;
const SHIFT = /^now\s*([+-])\s*(\d{1,4})\s*d$/;
const FIELD = /^card\.field\.(.*\S.*)$/;

// The names a text's values give, in order, as written between the braces (trimmed).
export function valuesIn(text: string): string[] {
  return [...text.matchAll(VALUE)].map((m) => m[1]!.trim());
}

// Whether the builder knows a value's name: a fixed name, a field by name, or a day from today.
export const isKnownValue = (name: string): boolean =>
  FIXED.has(name) || SHIFT.test(name) || FIELD.test(name);

// The first value a text holds that the builder does not know, or null.
export const unknownValueIn = (text: string): string | null =>
  valuesIn(text).find((name) => !isKnownValue(name)) ?? null;

// ---- Days ----------------------------------------------------------------------------------------------------------

export const todayIn = (now: number, timeZone: string): string => localDay(now, timeZone);

// A condition's or a Set Field's day: a fixed day, or today shifted by whole days.
export const dayFrom = (day: AutomationDay, now: number, timeZone: string): string =>
  'day' in day ? day.day : addDays(todayIn(now, timeZone), day.today);

// "11 Nov 2026" for `2026-11-11`; anything else as it is.
export function dayText(day: string): string {
  const n = dayNumber(day);
  if (n === undefined) return day;
  const p = dayParts(n);
  return `${p.date} ${MONTH_SHORT[p.month]} ${p.year}`;
}

// A field's value as a line of text: a day as a day, a person by name, a list joined, Yes or No.
export function fieldText(value: ItemFieldValue | undefined, field?: string): string {
  if (value === undefined || value === null) return '';
  if (typeof value === 'string') {
    if (field === 'priority' && isPriority(value)) return PRIORITY_LABELS[value];
    return isDay(value) ? dayText(value) : value;
  }
  if (typeof value === 'number') return String(value);
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  if (Array.isArray(value))
    return value
      .map((v) => fieldText(v))
      .filter(Boolean)
      .join(', ');
  const name = value['name'];
  return typeof name === 'string' ? name : '';
}

// ---- Filling -------------------------------------------------------------------------------------------------------

export interface ValueContext {
  card: Item;
  type: ItemTypeDef;
  outline: AutomationOutline;
  // The link that opens the card.
  url: string;
  // Who triggered the rule, by name.
  person: string;
  rule: string;
  now: number;
  timeZone: string;
}

const pad = (n: number) => String(n).padStart(2, '0');

// One value's text. `iso`: a day reads `YYYY-MM-DD`, for a date field.
function valueOf(name: string, ctx: ValueContext, iso: boolean): string {
  const day = (d: string) => (iso ? d : dayText(d));
  const shift = SHIFT.exec(name);
  if (shift) {
    const n = Number(shift[2]) * (shift[1] === '-' ? -1 : 1);
    return day(addDays(todayIn(ctx.now, ctx.timeZone), n));
  }
  const field = FIELD.exec(name);
  if (field) {
    const id = fieldOfName(ctx.type, field[1]!);
    return id ? fieldText(ctx.card.fields[id], id) : '';
  }
  switch (name) {
    case 'card.title':
      return itemTitle(ctx.card);
    case 'card.key':
      return `#${ctx.card.key}`;
    case 'card.url':
      return ctx.url;
    case 'card.assignee':
      return itemAssignee(ctx.card)?.name ?? '';
    case 'card.column': {
      const status = itemStatus(ctx.card);
      return status ? statusName(ctx.outline, status) : '';
    }
    case 'card.due': {
      const due = ctx.card.fields['due'];
      return typeof due === 'string' ? day(due) : '';
    }
    case 'person':
      return ctx.person;
    case 'rule':
      return ctx.rule;
    case 'now.date':
      return day(todayIn(ctx.now, ctx.timeZone));
    case 'now': {
      const p = zonedParts(ctx.now, ctx.timeZone);
      return `${dayText(todayIn(ctx.now, ctx.timeZone))}, ${pad(p.hour)}:${pad(p.minute)}`;
    }
    default:
      // A value the builder does not know (refused on save) reads as nothing.
      return '';
  }
}

// The text with every value filled in, in one pass.
export function fillValues(text: string, ctx: ValueContext, opts: { iso?: boolean } = {}): string {
  return text.replace(VALUE, (_all, name: string) => valueOf(name.trim(), ctx, opts.iso === true));
}
