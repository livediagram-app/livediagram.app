// Automations: the value a Set Field writes, as the field takes it (docs/specs/026-plan/automations.md "Actions").
// A value from another field of the card, a day (Today ± days), a number, a list, or text with values filled in and
// read as the field's kind reads it (a day, a number, a priority, a person by name or id). One the field can't hold
// is refused with why. Pure; plan-actions.ts calls it.

import type { Item, ItemFieldValue } from '../item';
import type { CustomFieldDef } from '../item-types';
import { ITEM_TITLE_MAX } from '../limits';
import { isPriority } from '../fields';
import { isDay } from '../repeat-dates';
import type { AutomationSetValue } from './types';
import type { AutomationOutline } from './outline';
import { dayFrom, fillValues, type ValueContext } from './values';

const DATE_FIELDS = new Set(['start', 'due']);
const NUMBER_KINDS = new Set(['number', 'currency', 'percent', 'duration', 'rating']);
const LIST_KINDS = new Set(['labels', 'multichoice']);

// A step the card refuses: the run fails there, with why.
export class Failed extends Error {}
export const fail = (reason: string): never => {
  throw new Failed(reason);
};

// How a field reads a value: its built-in kind, else its custom field's.
export function fieldKind(field: string, def: CustomFieldDef | undefined): string {
  if (DATE_FIELDS.has(field)) return 'date';
  if (field === 'estimate') return 'number';
  if (field === 'labels') return 'labels';
  if (field === 'priority') return 'priority';
  if (field === 'assignee') return 'person';
  return def?.kind ?? 'text';
}

export interface SetValueInput {
  value: AutomationSetValue;
  field: string;
  // The field's name and kind, for the refusal and the reading.
  name: string;
  kind: string;
  // The card as the steps so far left it.
  card: Item;
  outline: AutomationOutline;
  now: number;
  timeZone: string;
  values: ValueContext;
}

// A Set Field's value, as the field takes it (undefined clears it); a refusal names why.
export function setValueOf(input: SetValueInput): ItemFieldValue | undefined {
  const { value, field, name, kind } = input;
  if ('from' in value) return input.card.fields[value.from];
  if ('date' in value) return dayFrom(value.date, input.now, input.timeZone);
  if ('number' in value) return value.number;
  if ('list' in value) return value.list;
  const text = fillValues(
    value.text,
    { ...input.values, card: input.card },
    { iso: kind === 'date' },
  ).trim();
  if (text === '') return undefined;
  if (kind === 'date') return isDay(text) ? text : fail(`${name} needs a day, not "${value.text}"`);
  if (NUMBER_KINDS.has(kind)) {
    const n = Number(text);
    return Number.isFinite(n) ? n : fail(`${name} needs a number, not "${text}"`);
  }
  if (LIST_KINDS.has(kind)) return [text];
  if (kind === 'priority') {
    const p = text.toLowerCase();
    return isPriority(p) ? p : fail(`${name} has no "${text}"`);
  }
  if (kind === 'person') {
    const p = input.outline.people.find(
      (x) => x.id === text || x.name.toLowerCase() === text.toLowerCase(),
    );
    return p ?? fail(`Nobody called "${text}" can be set`);
  }
  return field === 'title' ? text.slice(0, ITEM_TITLE_MAX) : text;
}
