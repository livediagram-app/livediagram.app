// What a field compares and holds, for the condition and Set Field panels (docs/specs/026-plan/automations.md
// "Conditions"): text compares is, contains and empty; a number is, less than and more than; a date before and
// after a day; a list (labels, several values) contains; a choice (priority, an option, a person) is. Pure.

import type { AutomationFieldOp } from '@liveplanner/items';

export type FieldClass = 'text' | 'number' | 'date' | 'list' | 'choice' | 'flag';

const CLASSES: Readonly<Record<string, FieldClass>> = {
  text: 'text',
  'long-text': 'text',
  longtext: 'text',
  email: 'text',
  link: 'text',
  phone: 'text',
  number: 'number',
  currency: 'number',
  percent: 'number',
  duration: 'number',
  rating: 'number',
  date: 'date',
  datetime: 'date',
  daterange: 'date',
  labels: 'list',
  multichoice: 'list',
  priority: 'choice',
  choice: 'choice',
  person: 'choice',
  card: 'choice',
  checklist: 'flag',
  flag: 'flag',
  checkbox: 'flag',
};

export const fieldClass = (kind: string): FieldClass => CLASSES[kind] ?? 'text';

const OPS: Readonly<Record<FieldClass, readonly AutomationFieldOp[]>> = {
  text: ['is', 'is_not', 'contains', 'not_contains', 'empty', 'not_empty'],
  number: ['is', 'less_than', 'more_than', 'empty', 'not_empty'],
  date: ['before', 'after', 'on_or_before', 'on_or_after', 'empty', 'not_empty'],
  list: ['contains', 'not_contains', 'empty', 'not_empty'],
  choice: ['is', 'is_not', 'empty', 'not_empty'],
  flag: ['not_empty', 'empty'],
};

export const opsFor = (cls: FieldClass): readonly AutomationFieldOp[] => OPS[cls];

/** Whether an op compares with a value (empty and not empty take none). */
export const opTakesValue = (op: AutomationFieldOp) => op !== 'empty' && op !== 'not_empty';

/** Whether an op compares days. */
export const isDateOp = (op: AutomationFieldOp) =>
  op === 'before' || op === 'after' || op === 'on_or_before' || op === 'on_or_after';

// A flag reads better as "is set" than "is not empty".
export const FLAG_OP_WORDS: Readonly<Partial<Record<AutomationFieldOp, string>>> = {
  not_empty: 'is on',
  empty: 'is off',
};
