// What a repeating card's copy is (docs/specs/026-plan/items.md "Repeating cards", blueprint item-store.md "Repeats"):
// a fresh card of the same type, with the source's content and none of its history, its dates moved on to its day.
import {
  ARCHIVED_FIELD,
  STATUS_SINCE_FIELD,
  type ItemFields,
  type ItemPerson,
  type Item,
} from './item';
import { EXAMPLE_FIELD, TRASHED_FROM_FIELD } from './board';
import { unlinkedFields } from './linked-cards';
import { isTimeSpent } from './duration-fields';
import { resolvedDefaultStatus } from './type-catalogue';
import type { ItemTypeDef } from './item-types';
import { REPEAT_FIELD, previousOccurrence, type RepeatRule } from './repeat';
import { addDays, dayNo, isDay } from './repeat-dates';
import { sha256Fallback } from './sha256';
import { isObj } from './validate';

// Who makes a copy: the rule, never the person who set it (they may have left the plan). Its history says so.
export const REPEAT_PERSON: ItemPerson = { id: 'repeat', name: 'Repeat', color: '#64748b' };

// What a copy never carries: the rule (only the source repeats), the source's place and state, its flags, and what
// people gave the source (votes, the old single thread).
const LEFT_BEHIND = [
  REPEAT_FIELD,
  'status',
  STATUS_SINCE_FIELD,
  TRASHED_FROM_FIELD,
  ARCHIVED_FIELD,
  'flagged',
  EXAMPLE_FIELD,
  'votes',
  'comments',
];

// The dates a copy moves on.
const MOVED_DATES = ['start', 'due'];

// A checklist's rows, every one unticked; anything else as it is.
function unticked(v: ItemFields[string]): ItemFields[string] {
  if (!Array.isArray(v)) return v;
  return v.map((row) => (isObj(row) && row['done'] === true ? { ...row, done: false } : row));
}

// The copy's fields for `day`: the source's, less what stays behind, its Votes and Time Spent fields (the copy's are
// its own), its checklists unticked, and its start and due moved by the days between the source's own day under the
// rule and `day`.
export function repeatCopyFields(
  source: Pick<Item, 'fields'>,
  rule: RepeatRule,
  day: string,
  type: Pick<ItemTypeDef, 'custom'> | undefined,
): ItemFields {
  const fields: ItemFields = { ...unlinkedFields(source.fields) };
  for (const key of LEFT_BEHIND) delete fields[key];
  for (const f of type?.custom ?? []) {
    if (f.kind === 'votes' || isTimeSpent(f)) delete fields[f.id];
    else if (f.kind === 'checklist' && fields[f.id] !== undefined)
      fields[f.id] = unticked(fields[f.id]!);
  }
  if (fields['checklist'] !== undefined) fields['checklist'] = unticked(fields['checklist']);
  const own = previousOccurrence(rule, rule.from) ?? rule.from;
  const shift = dayNo(day) - dayNo(own);
  for (const key of MOVED_DATES) {
    const v = fields[key];
    if (isDay(v)) fields[key] = addDays(v, shift);
  }
  return fields;
}

// The column a copy lands in: the rule's, else its type's starting state (its own Default State, else its built-in
// one by name), else the source's own.
export function repeatCopyStatus(
  rule: RepeatRule,
  type: ItemTypeDef | undefined,
  statusNames: Iterable<readonly [string, string]>,
  sourceStatus: string | undefined,
): string | undefined {
  return rule.status ?? (type && resolvedDefaultStatus(type, statusNames)) ?? sourceStatus;
}

const ID_DIGITS = 23;

// The copy's id, the same for the same source and day wherever it is worked out: a second attempt at a day's copy
// collides with the first rather than making another. `r` and 23 base-36 digits of the SHA-256 of the pair.
export function repeatCopyId(sourceId: string, day: string): string {
  const digest = sha256Fallback(new TextEncoder().encode(`${sourceId}/${day}`));
  let out = 'r';
  for (let i = 0; out.length <= ID_DIGITS; i += 1) out += (digest[i]! % 36).toString(36);
  return out;
}
