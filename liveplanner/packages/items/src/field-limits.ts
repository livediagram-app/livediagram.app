// The limit a refused field value broke (docs/specs/026-plan/items.md "Limits", "A refused value says which field and
// why"): validateFields answers it beside the field's id, the api sends both in its refusal, and the agents and the
// editor word it with the field's name. Worked out only once a value is refused, so a valid write pays nothing.
import type { CustomFieldKind } from './item-types';
import {
  FIELD_VALUES_MAX,
  ITEM_CHECKLIST_MAX,
  ITEM_CHECKLIST_TEXT_MAX,
  ITEM_DESCRIPTION_MAX,
  ITEM_LABELS_MAX,
  ITEM_LABEL_MAX,
  ITEM_LONG_TEXT_MAX,
  ITEM_STATUS_MAX,
  ITEM_TITLE_MAX,
  ITEM_UNKNOWN_ARRAY_MAX,
  ITEM_UNKNOWN_STRING_MAX,
} from './limits';

// `characters` a text's length (one `entry` of a list's when `row` is set, counted from 1); `rows`, `labels` and
// `values` how many a list holds.
export type FieldLimit = {
  unit: 'characters' | 'rows' | 'labels' | 'values';
  max: number;
  given: number;
  row?: number;
  entry?: 'row' | 'label' | 'value';
};

// What a field's value is read as when its limit is looked for: a built-in field's kind, `rich` for a formatting
// key's runs, or undefined for a custom field's value (as validateFields' normaliseUnknown reads it).
export type LimitShape = 'title' | 'long-text' | 'status' | 'labels' | 'checklist' | 'rich';

const isObj = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);

const over = (given: number, max: number): FieldLimit | undefined =>
  given > max ? { unit: 'characters', max, given } : undefined;

// The first entry of a list past `max` characters, or the list itself past `count` entries.
function listLimit(
  v: readonly unknown[],
  count: number,
  unit: 'rows' | 'labels' | 'values',
  textOf: (x: unknown) => string | undefined,
  max: number,
  entry: 'row' | 'label' | 'value',
): FieldLimit | undefined {
  if (v.length > count) return { unit, max: count, given: v.length };
  for (let i = 0; i < v.length; i += 1) {
    const text = textOf(v[i]);
    if (text !== undefined && text.length > max)
      return { unit: 'characters', max, given: text.length, row: i + 1, entry };
  }
  return undefined;
}

const rowText = (r: unknown) => (isObj(r) && typeof r['text'] === 'string' ? r['text'] : undefined);
const labelText = (l: unknown) => (typeof l === 'string' ? l.trim() : undefined);
const scalarText = (s: unknown) => (typeof s === 'string' ? s : undefined);

function checklistLimit(v: readonly unknown[]): FieldLimit | undefined {
  return listLimit(v, ITEM_CHECKLIST_MAX, 'rows', rowText, ITEM_CHECKLIST_TEXT_MAX, 'row');
}

// A custom field's value: its own text, a checklist's rows, a list of people, or a list of scalars.
function customLimit(v: unknown): FieldLimit | undefined {
  if (typeof v === 'string') return over(v.length, ITEM_LONG_TEXT_MAX);
  if (!Array.isArray(v) || v.length === 0) return undefined;
  if (v.every((p) => isObj(p) && 'id' in p))
    return v.length > FIELD_VALUES_MAX
      ? { unit: 'values', max: FIELD_VALUES_MAX, given: v.length }
      : undefined;
  if (v.every(isObj)) return checklistLimit(v);
  return listLimit(
    v,
    ITEM_UNKNOWN_ARRAY_MAX,
    'values',
    scalarText,
    ITEM_UNKNOWN_STRING_MAX,
    'value',
  );
}

// The limit `v` broke, read as `shape` (`max` a formatting key's text limit), or undefined when it broke none (it was
// the wrong shape, not too long or too many).
export function brokenLimitOf(
  shape: LimitShape | undefined,
  v: unknown,
  max = ITEM_DESCRIPTION_MAX,
): FieldLimit | undefined {
  switch (shape) {
    case 'title':
      return typeof v === 'string' ? over(v.trim().length, ITEM_TITLE_MAX) : undefined;
    case 'long-text':
      return typeof v === 'string' ? over(v.length, ITEM_DESCRIPTION_MAX) : undefined;
    case 'status':
      return typeof v === 'string' ? over(v.trim().length, ITEM_STATUS_MAX) : undefined;
    case 'labels':
      return Array.isArray(v)
        ? listLimit(v, ITEM_LABELS_MAX, 'labels', labelText, ITEM_LABEL_MAX, 'label')
        : undefined;
    case 'checklist':
      return Array.isArray(v) ? checklistLimit(v) : undefined;
    case 'rich': {
      if (!Array.isArray(v)) return undefined;
      const length = v.reduce<number>((n, r) => n + (rowText(r)?.length ?? 0), 0);
      return over(length, max);
    }
    case undefined:
      return customLimit(v);
  }
}

// The most text a custom field of `kind` holds: a Long Text the Description's, any other the store's short string.
export function textMaxOfKind(kind: CustomFieldKind): number {
  return kind === 'longtext' ? ITEM_LONG_TEXT_MAX : ITEM_UNKNOWN_STRING_MAX;
}

const n = (x: number) => x.toLocaleString('en-GB');

// The limit in words, for the field as the card shows it: "Solution is 12,412 characters; the most is 10,000",
// "Acceptance Criteria row 3 is 230 characters; the most is 200 a row", "Acceptance Criteria has 51 rows; the most is
// 50".
export function fieldLimitWords(name: string, limit: FieldLimit): string {
  const { unit, max, given, row, entry } = limit;
  if (unit !== 'characters') return `${name} has ${n(given)} ${unit}; the most is ${n(max)}.`;
  if (row === undefined) return `${name} is ${n(given)} characters; the most is ${n(max)}.`;
  const each = entry ?? 'row';
  return `${name} ${each} ${row} is ${n(given)} characters; the most is ${n(max)} a ${each}.`;
}

// A limit as an api refusal's body carries it, or undefined for anything else (an older api's, or none).
export function readFieldLimit(raw: unknown): FieldLimit | undefined {
  if (!isObj(raw)) return undefined;
  const { unit, max, given, row, entry } = raw;
  if (unit !== 'characters' && unit !== 'rows' && unit !== 'labels' && unit !== 'values')
    return undefined;
  if (typeof max !== 'number' || typeof given !== 'number') return undefined;
  return {
    unit,
    max,
    given,
    ...(typeof row === 'number' ? { row } : {}),
    ...(entry === 'row' || entry === 'label' || entry === 'value' ? { entry } : {}),
  };
}
