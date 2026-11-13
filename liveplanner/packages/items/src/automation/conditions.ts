// Automations: one condition against the card (docs/specs/026-plan/automations.md "Conditions"; blueprint
// automations.md "Files"). `holds` answers whether it holds and the line the Audit Trail shows for it, with what it found.
// A condition on a field the card's type lacks, or naming a type, column, field, person or saved filter that is gone,
// does not hold; it never throws. Pure.

import { itemStatus, type Item, type ItemFieldValue, type ItemPerson } from '../item';
import { quickFilterMatches } from '../board';
import { cardsMatchingFilters } from '../board-lanes';
import { resolveSavedFilter } from '../saved-filters';
import { dayNumber } from '../plan-view-dates';
import { zonedDay } from '../date-time-fields';
import { isEmptyFieldValue } from '../required-fields';
import { typeIn } from '../type-catalogue';
import type {
  AutomationCondition,
  AutomationDay,
  AutomationFieldOp,
  AutomationGone,
  AutomationWho,
} from './types';
import {
  fieldName,
  personOf,
  planHasField,
  statusName,
  typeHasField,
  typeName,
  type AutomationOutline,
} from './outline';
import { dayFrom, dayText, fieldText } from './values';

// Who made the change a rule answers: a person through an Editor's or a Participant's access, an agent (an API
// token), a rule, or the plan itself (a form response, a Repeat).
export type AutomationRole = 'editor' | 'participant' | 'agent' | 'automation' | 'system';

export interface ConditionContext {
  card: Item;
  outline: AutomationOutline;
  by: ItemPerson;
  role: AutomationRole;
  now: number;
  timeZone: string;
}

// `gone`: what a condition names that the plan lacks (its text keeps the id for agents).
export type ConditionLine = { ok: boolean; text: string; gone?: AutomationGone };

// The days a saved filter's Due Soon window spans, as the board's chip counts them (the editor's DUE_SOON_DAYS).
export const AUTOMATION_DUE_SOON_DAYS = 2;

export const FIELD_OP_WORDS: Readonly<Record<AutomationFieldOp, string>> = {
  is: 'is',
  is_not: 'is not',
  empty: 'is empty',
  not_empty: 'is not empty',
  contains: 'contains',
  not_contains: 'does not contain',
  before: 'is before',
  after: 'is after',
  on_or_before: 'is on or before',
  on_or_after: 'is on or after',
  less_than: 'is less than',
  more_than: 'is more than',
};

type FieldValue = Extract<AutomationCondition, { kind: 'field' }>['value'];

const ROLE_WORDS = {
  editor: 'an Editor',
  participant: 'a Participant',
  agent: 'an agent',
} as const;

const is = (not: true | undefined) => (not ? 'is not' : 'is');
const listed = (names: string[]) => names.join(' or ');

// "Today", "Today + 3 days", "Today - 1 day", or the day.
export function automationDayWords(day: AutomationDay): string {
  if ('day' in day) return dayText(day.day);
  if (day.today === 0) return 'Today';
  const n = Math.abs(day.today);
  return `Today ${day.today > 0 ? '+' : '-'} ${n} day${n === 1 ? '' : 's'}`;
}

// A condition's value as words.
function valueWords(value: FieldValue): string {
  if (value === undefined) return '';
  if (typeof value === 'object' && !Array.isArray(value)) return automationDayWords(value);
  return Array.isArray(value) ? value.join(', ') : String(value);
}

// The strings a value matches against, lowercased: a person by id and name, a list by each entry.
function tokens(value: ItemFieldValue | undefined): string[] {
  if (value === undefined || value === null) return [];
  if (Array.isArray(value)) return value.flatMap(tokens);
  if (typeof value === 'object') {
    const p = value as Partial<ItemPerson>;
    return [p.id, p.name]
      .filter((s): s is string => typeof s === 'string')
      .map((s) => s.toLowerCase());
  }
  return [String(value).toLowerCase()];
}

const entries = (value: ItemFieldValue | undefined): ItemFieldValue[] =>
  Array.isArray(value) ? value : value === undefined || value === null ? [] : [value];

function fieldIs(raw: ItemFieldValue | undefined, value: string | number | string[]): boolean {
  if (typeof value === 'number') return typeof raw === 'number' && raw === value;
  const wanted = (Array.isArray(value) ? value : [value]).map((v) => v.toLowerCase());
  const got = entries(raw);
  if (got.length !== wanted.length) return false;
  return (
    got.every((e) => wanted.some((w) => tokens(e).includes(w))) &&
    wanted.every((w) => got.some((e) => tokens(e).includes(w)))
  );
}

function fieldContains(
  raw: ItemFieldValue | undefined,
  value: string | number | string[],
): boolean {
  const wanted = (Array.isArray(value) ? value : [String(value)]).map((v) => v.toLowerCase());
  if (typeof raw === 'string') return wanted.every((w) => raw.toLowerCase().includes(w));
  const got = entries(raw);
  return wanted.every((w) => got.some((e) => tokens(e).includes(w)));
}

function compareField(
  op: AutomationFieldOp,
  raw: ItemFieldValue | undefined,
  value: FieldValue,
  ctx: ConditionContext,
): boolean {
  switch (op) {
    case 'empty':
      return isEmptyFieldValue(raw) || raw === false;
    case 'not_empty':
      return !(isEmptyFieldValue(raw) || raw === false);
    case 'before':
    case 'after':
    case 'on_or_before':
    case 'on_or_after': {
      if (typeof value !== 'object' || Array.isArray(value)) return false;
      const got = dayNumber(raw, ctx.timeZone);
      const at = dayNumber(dayFrom(value, ctx.now, ctx.timeZone));
      if (got === undefined || at === undefined) return false;
      if (op === 'before') return got < at;
      if (op === 'after') return got > at;
      return op === 'on_or_before' ? got <= at : got >= at;
    }
    case 'less_than':
    case 'more_than':
      if (typeof value !== 'number' || typeof raw !== 'number') return false;
      return op === 'less_than' ? raw < value : raw > value;
  }
  if (value === undefined || (typeof value === 'object' && !Array.isArray(value))) return false;
  if (op === 'is') return fieldIs(raw, value);
  if (op === 'is_not') return !fieldIs(raw, value);
  return op === 'contains' ? fieldContains(raw, value) : !fieldContains(raw, value);
}

function whoMatches(w: AutomationWho, ctx: ConditionContext): boolean {
  return 'person' in w ? ctx.by.id === w.person : ctx.role === w.role;
}

function whoWords(w: AutomationWho, o: AutomationOutline): string {
  return 'person' in w ? (personOf(o, w.person)?.name ?? w.person) : ROLE_WORDS[w.role];
}

// A condition naming something the plan lacks: it does not hold, its line says what is gone (each one it names).
const goneLine = (words: string, gone: AutomationGone): ConditionLine => ({
  ok: false,
  text: `${words} (${goneIdsWords(gone)})`,
  gone,
});

/** "done is gone", "done, later are gone": the ids a gone line names, as its text ends. */
export const goneIdsWords = (gone: AutomationGone): string =>
  gone.more?.length ? `${[gone.id, ...gone.more].join(', ')} are gone` : `${gone.id} is gone`;

// Each id of a kind the plan lacks, as one gone (`more` only when there are several); null when none is gone.
function goneOf(kind: AutomationGone['kind'], ids: readonly string[]): AutomationGone | null {
  const [id, ...more] = [...new Set(ids)];
  if (id === undefined) return null;
  return more.length ? { kind, id, more } : { kind, id };
}

// One condition against the card: whether it holds, and its line.
export function holds(c: AutomationCondition, ctx: ConditionContext): ConditionLine {
  const o = ctx.outline;
  const card = ctx.card;
  switch (c.kind) {
    case 'type': {
      const words = `Card Type ${is(c.not)} ${listed(c.types.map((t) => typeName(o, t)))}`;
      const gone = goneOf(
        'type',
        c.types.filter((t) => !o.types.some((x) => x.id === t)),
      );
      if (gone) return goneLine(words, gone);
      const ok = c.types.includes(card.type) !== (c.not === true);
      return { ok, text: `${words} (${typeName(o, card.type)})` };
    }
    case 'column': {
      const words = `Column ${is(c.not)} ${listed(c.statuses.map((s) => statusName(o, s)))}`;
      const gone = goneOf(
        'column',
        c.statuses.filter((s) => !o.statuses.some((x) => x.status === s)),
      );
      if (gone) return goneLine(words, gone);
      const status = itemStatus(card);
      const ok = (status !== undefined && c.statuses.includes(status)) !== (c.not === true);
      return { ok, text: `${words} (${status ? statusName(o, status) : 'none'})` };
    }
    case 'field': {
      const type = typeIn(o.types, card.type);
      const name = fieldName(o, c.field, type);
      const value = valueWords(c.value);
      const words = `${name} ${FIELD_OP_WORDS[c.op]}${value ? ` ${value}` : ''}`;
      if (!planHasField(o, c.field)) return goneLine(words, { kind: 'field', id: c.field });
      if (!typeHasField(type, c.field))
        return { ok: false, text: `${words} (a ${type.label} card has no ${name})` };
      const raw = card.fields[c.field];
      const found = fieldText(raw, c.field) || 'empty';
      return { ok: compareField(c.op, raw, c.value, ctx), text: `${words} (${found})` };
    }
    case 'who': {
      const words = `Who Did It ${is(c.not)} ${listed(c.who.map((w) => whoWords(w, o)))}`;
      const gone = goneOf(
        'person',
        c.who.flatMap((w) => ('person' in w && !personOf(o, w.person) ? [w.person] : [])),
      );
      if (gone) return goneLine(words, gone);
      const ok = c.who.some((w) => whoMatches(w, ctx)) !== (c.not === true);
      return { ok, text: `${words} (${ctx.by.name})` };
    }
    case 'saved_filter': {
      const saved = o.savedFilters.find((s) => s.tab === c.tab && s.filter.id === c.filter);
      if (!saved) return goneLine('Matches a Saved Filter', { kind: 'filter', id: c.filter });
      const words = `Matches Saved Filter ${saved.filter.name}`;
      const quick = resolveSavedFilter(saved.filter, {
        mine: ctx.by.id,
        today: zonedDay(ctx.now, ctx.timeZone),
        soonDays: AUTOMATION_DUE_SOON_DAYS,
        finished: saved.finished,
      });
      const ok =
        quickFilterMatches(quick, card, o.types) &&
        (!quick.filters?.length ||
          cardsMatchingFilters([card], quick.filters, new Map([[card.id, card]]), o.types).length >
            0);
      return { ok, text: `${words} (${ok ? 'it does' : 'it does not'})` };
    }
  }
}

// Every condition, in order: all hold, and their lines.
export function allHold(
  conditions: readonly AutomationCondition[],
  ctx: ConditionContext,
): { ok: boolean; lines: ConditionLine[] } {
  const lines = conditions.map((c) => holds(c, ctx));
  return { ok: lines.every((l) => l.ok), lines };
}
