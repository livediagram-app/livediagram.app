// Fields set automatically (docs/specs/030-forms/forms.md "Filled in automatically", blueprint §8a): the card fields a
// board destination may give every response's card without a question, the value each set one puts on the card, and
// the ones that no longer resolve. Pure: the api fills the card here (responseCard), the builder lists and checks.
import {
  ITEM_LABELS_MAX,
  ITEM_LABEL_MAX,
  isPriority,
  typeFieldLabel,
  type CustomFieldKind,
  type ItemFieldValue,
  type ItemTypeDef,
} from '@liveplanner/items';
import { FIXED_TEXT_MAX } from './limits';
import type { FixedValue, FormDefinition, SheetFixedColumn } from './model';

// What a set field takes: one option, some options, labels, text, a number, a priority, or the submitted day.
export type FixedKind =
  'choice' | 'multichoice' | 'labels' | 'text' | 'number' | 'priority' | 'date';

export type FixedField = {
  id: string;
  label: string;
  kind: FixedKind;
  options?: readonly string[];
};

// The built-in fields that may be set, by id.
const BUILT_IN_FIXED: Readonly<Record<string, FixedKind>> = {
  priority: 'priority',
  labels: 'labels',
  start: 'date',
  due: 'date',
};

// The custom kinds that may be set.
const CUSTOM_FIXED: Partial<Record<CustomFieldKind, FixedKind>> = {
  choice: 'choice',
  multichoice: 'multichoice',
  labels: 'labels',
  text: 'text',
  longtext: 'text',
  number: 'number',
  currency: 'number',
  date: 'date',
};

export const isBuiltInFixedId = (id: string): boolean =>
  Object.prototype.hasOwnProperty.call(BUILT_IN_FIXED, id);

// The fields of `type` a form may set, in the type's field order.
export function fixedFieldsOf(type: ItemTypeDef | undefined): FixedField[] {
  if (!type) return [];
  const out: FixedField[] = [];
  for (const id of type.fields) {
    if (isBuiltInFixedId(id)) {
      out.push({ id, label: typeFieldLabel(type, id), kind: BUILT_IN_FIXED[id]! });
      continue;
    }
    const f = type.custom?.find((c) => c.id === id);
    const kind = f ? CUSTOM_FIXED[f.kind] : undefined;
    if (!f || !kind) continue;
    out.push(
      kind === 'choice' || kind === 'multichoice'
        ? { id, label: f.label, kind, options: f.options ?? [] }
        : { id, label: f.label, kind },
    );
  }
  return out;
}

const pad = (n: number) => String(n).padStart(2, '0');

// The day `at` falls on in `tz` (UTC when absent or unknown), plus `days`: YYYY-MM-DD, as a card's date keeps it.
export function submittedDay(at: number, tz?: string, days = 0): string {
  let y: number;
  let m: number;
  let d: number;
  try {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: tz ?? 'UTC',
      year: 'numeric',
      month: 'numeric',
      day: 'numeric',
    }).formatToParts(new Date(at));
    const part = (t: string) => Number(parts.find((p) => p.type === t)?.value);
    [y, m, d] = [part('year'), part('month'), part('day')];
  } catch {
    // An unknown zone reads as UTC.
    const u = new Date(at);
    [y, m, d] = [u.getUTCFullYear(), u.getUTCMonth() + 1, u.getUTCDate()];
  }
  const day = new Date(Date.UTC(y, m - 1, d + days));
  return `${day.getUTCFullYear()}-${pad(day.getUTCMonth() + 1)}-${pad(day.getUTCDate())}`;
}

// A pick as the field spells it, case aside; undefined when the field has no such option.
const optionOf = (pick: unknown, options: readonly string[]): string | undefined =>
  typeof pick === 'string'
    ? options.find((o) => o.toLowerCase() === pick.toLowerCase())
    : undefined;

// What `fixed` puts in `field` on a response filed at `at`; undefined when it no longer fits (its option gone, or
// a value of a kind the field does not take).
export function fixedValueOf(
  fixed: FixedValue,
  field: FixedField,
  at: number,
): ItemFieldValue | undefined {
  if ('submitted' in fixed)
    return field.kind === 'date'
      ? submittedDay(at, fixed.submitted.tz, fixed.submitted.days)
      : undefined;
  const v = fixed.value;
  switch (field.kind) {
    case 'priority':
      return isPriority(v) ? v : undefined;
    case 'choice':
      return optionOf(v, field.options ?? []);
    case 'multichoice': {
      if (!Array.isArray(v) || v.length === 0) return undefined;
      const picks = v.map((p) => optionOf(p, field.options ?? []));
      return picks.every((p) => p !== undefined) ? picks : undefined;
    }
    case 'labels': {
      if (!Array.isArray(v) || v.length === 0 || v.length > ITEM_LABELS_MAX) return undefined;
      const ok = v.every((l) => typeof l === 'string' && l.trim() && l.length <= ITEM_LABEL_MAX);
      return ok ? [...(v as readonly string[])] : undefined;
    }
    case 'text':
      return typeof v === 'string' && v.trim() && v.length <= FIXED_TEXT_MAX ? v : undefined;
    case 'number':
      return typeof v === 'number' && Number.isFinite(v) ? v : undefined;
    case 'date':
      return undefined;
  }
}

// The card fields every set value that still resolves puts on a response's card.
export function fixedCardFields(
  fixed: Readonly<Record<string, FixedValue>> | undefined,
  type: ItemTypeDef,
  at: number,
): Record<string, ItemFieldValue> {
  const out: Record<string, ItemFieldValue> = {};
  if (!fixed) return out;
  const fields = new Map(fixedFieldsOf(type).map((f) => [f.id, f]));
  for (const [id, value] of Object.entries(fixed)) {
    const field = fields.get(id);
    const v = field ? fixedValueOf(value, field, at) : undefined;
    if (v !== undefined) out[id] = v;
  }
  return out;
}

// The set fields that no longer resolve on `type`: the field gone from it, its kind changed, or its option removed.
export function brokenFixed(
  fixed: Readonly<Record<string, FixedValue>> | undefined,
  type: ItemTypeDef,
): string[] {
  if (!fixed) return [];
  const ok = fixedCardFields(fixed, type, 0);
  return Object.keys(fixed).filter((id) => !(id in ok));
}

// The set values that still resolve on `type` (a card type changed: the others named fields it lacks); undefined
// when none is left.
export function fixedKeptFor(
  fixed: Readonly<Record<string, FixedValue>> | undefined,
  type: ItemTypeDef,
): Record<string, FixedValue> | undefined {
  if (!fixed) return undefined;
  const ok = fixedCardFields(fixed, type, 0);
  const kept = Object.fromEntries(Object.entries(fixed).filter(([id]) => id in ok));
  return Object.keys(kept).length ? kept : undefined;
}

// `form` with `fieldId` set to `value` on its board destination (null: no longer set). The same form without one.
export function withFixed(
  form: FormDefinition,
  fieldId: string,
  value: FixedValue | null,
): FormDefinition {
  const dest = form.destination;
  if (!dest) return form;
  const { [fieldId]: _was, ...rest } = dest.fixed ?? {};
  const fixed = value ? { ...rest, [fieldId]: value } : rest;
  const { fixed: _old, ...plain } = dest;
  return {
    ...form,
    destination: Object.keys(fixed).length ? { ...plain, fixed } : plain,
  };
}

// `form` with its sheet's extra columns `columns` (none: the key goes). The same form without a sheet.
export function withSheetFixed(
  form: FormDefinition,
  columns: readonly SheetFixedColumn[],
): FormDefinition {
  const sheet = form.sheet;
  if (!sheet) return form;
  const { fixed: _old, ...plain } = sheet;
  return { ...form, sheet: columns.length ? { ...plain, fixed: [...columns] } : plain };
}
