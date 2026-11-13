// Automations: the value a Set Field writes, as the field takes it (docs/specs/026-plan/automations.md "Actions").
// A value from another field of the card, a day (Today ± days), a number, a list, or text with values filled in and
// read as the field's kind reads it (a day, a number, a priority, a person by name or id, a Checkbox's Yes or No).
// One the field can't hold is refused with why. Pure; plan-actions.ts calls it.

import type { Item, ItemFieldValue } from '../item';
import type { CustomFieldDef } from '../item-types';
import { ITEM_TITLE_MAX } from '../limits';
import { isPriority, knownFieldKind } from '../fields';
import { isDay } from '../repeat-dates';
import type { AutomationGone, AutomationSetValue } from './types';
import type { AutomationOutline } from './outline';
import { dayFrom, fillValues, type ValueContext } from './values';

const DATE_FIELDS = new Set(['start', 'due']);
const NUMBER_KINDS = new Set(['number', 'currency', 'percent', 'duration', 'rating']);
const LIST_KINDS = new Set(['labels', 'multichoice']);

// The words a Checkbox field's Set Field takes: Yes or No as the card shows it, true or false as the builder keeps
// it, On or Off, any case.
const CHECKBOX_WORDS: ReadonlyMap<string, boolean> = new Map([
  ['true', true],
  ['yes', true],
  ['on', true],
  ['false', false],
  ['no', false],
  ['off', false],
]);

/** A Checkbox's value from Set Field's text, or undefined for text it can't read as one. */
export const checkboxOf = (text: string): boolean | undefined =>
  CHECKBOX_WORDS.get(text.trim().toLowerCase());

// A step the card refuses: the run fails there, with why (and, for something the plan lost, what: AutomationGone).
export class Failed extends Error {
  readonly gone: AutomationGone | undefined;
  constructor(reason: string, gone?: AutomationGone) {
    super(reason);
    this.gone = gone;
  }
}
export const fail = (reason: string, gone?: AutomationGone): never => {
  throw new Failed(reason, gone);
};

/** "Field estimate_x is gone": something a step names that the plan lacks, failed with its id kept for agents. */
export const failGone = (gone: AutomationGone): never => fail(goneLine(gone), gone);

const GONE_WORDS: Readonly<Record<AutomationGone['kind'], string>> = {
  column: 'Column',
  type: 'Card type',
  field: 'Field',
  person: 'Person',
  filter: 'Saved filter',
};

/** A gone thing as agents read it, by its stored id: "Column done is gone". */
export const goneLine = (gone: AutomationGone): string =>
  `${GONE_WORDS[gone.kind]} ${gone.id} is gone`;

/** The person Set Field's text names: by id (the builder's pick) or by name, any case (an agent's). */
export const personNamed = <P extends { id: string; name: string }>(
  people: readonly P[],
  text: string,
): P | undefined =>
  people.find((x) => x.id === text || x.name.toLowerCase() === text.toLowerCase());

// How a field reads a value: its built-in kind, else its custom field's.
export function fieldKind(field: string, def: CustomFieldDef | undefined): string {
  if (DATE_FIELDS.has(field)) return 'date';
  if (field === 'estimate') return 'number';
  if (field === 'labels') return 'labels';
  if (field === 'priority') return 'priority';
  if (field === 'assignee') return 'person';
  // Flagged and Archived hold true or false, as a Checkbox does.
  if (knownFieldKind(field) === 'flag') return 'checkbox';
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
  if (kind === 'checkbox') {
    const on = checkboxOf(text);
    return on ?? fail(`${name} is Yes or No, not "${text}"`);
  }
  if (kind === 'priority') {
    const p = text.toLowerCase();
    return isPriority(p) ? p : fail(`${name} has no "${text}"`);
  }
  if (kind === 'person') {
    const p = personNamed(input.outline.people, text);
    if (p) return p;
    // A person picked (by id) who has left the plan is gone, as Assign's is; a value filled in names nobody.
    return fail(
      `Nobody called "${text}" can be set`,
      value.text.includes('{{') ? undefined : { kind: 'person', id: text },
    );
  }
  return field === 'title' ? text.slice(0, ITEM_TITLE_MAX) : text;
}
