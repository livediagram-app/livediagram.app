// Rollup and Lookup fields' settings (docs/specs/026-plan/item-types.md "Rollup and Lookup fields"): which Card fields
// a field may read through, which fields it may read, what each reads as, and the result it takes from them. The
// values themselves are worked out by calculated-fields.ts, which every surface reads through. Pure.
import { calculatedResultOf, isLookupField, isRollupField } from './calculated-result';
import {
  AGGREGATES,
  linkTypesOf,
  type Aggregate,
  type CustomFieldDef,
  type ItemTypeDef,
} from './item-types';
import { formulaScopeOf, type FormulaField } from './formula/references';
import type { FormulaResult } from './formula/limits';

export const AGGREGATE_LABELS: Readonly<Record<Aggregate, string>> = {
  sum: 'Sum',
  average: 'Average',
  min: 'Min',
  max: 'Max',
  count: 'Count',
  countDone: 'Count Done',
  earliest: 'Earliest',
  latest: 'Latest',
};

export const isAggregate = (v: unknown): v is Aggregate =>
  (AGGREGATES as readonly unknown[]).includes(v);

// A Rollup's calculation; Sum when absent or unknown, so a field being made reads as one.
export const aggregateOf = (f: Pick<CustomFieldDef, 'aggregate'>): Aggregate =>
  isAggregate(f.aggregate) ? f.aggregate : 'sum';

// What an aggregate reads: a number, a date, or nothing (Count and Count Done).
export type AggregateReads = 'number' | 'date' | 'none';
export function aggregateReads(a: Aggregate): AggregateReads {
  if (a === 'count' || a === 'countDone') return 'none';
  return a === 'earliest' || a === 'latest' ? 'date' : 'number';
}

// A field a Rollup or a Lookup may read: the formula scope's (every readable field, built-in or custom, by the name
// the panel gives it), with the kind its value reads as.
export interface ReadableField {
  id: string;
  name: string;
  reads: FormulaResult;
  custom?: CustomFieldDef;
}

// The kind a field's value reads as (a Lookup's result): numbers, money, shares, days, ticks, else text.
function readsOf(f: FormulaField): FormulaResult {
  const c = f.custom;
  if (!c) {
    if (f.id === 'estimate' || f.id === '#key') return 'number';
    return f.id === 'start' || f.id === 'due' ? 'date' : 'text';
  }
  switch (c.kind) {
    case 'number':
    case 'rating':
      return 'number';
    case 'currency':
    case 'percent':
    case 'date':
    case 'checkbox':
      return c.kind;
    case 'calculated':
      return calculatedResultOf(c) ?? 'number';
    default:
      return 'text';
  }
}

// The fields a type offers a Rollup or Lookup to read, in its order (Number and Type last).
export function readableFieldsOf(type: Pick<ItemTypeDef, 'fields' | 'custom'>): ReadableField[] {
  return formulaScopeOf(type).fields.map((f) => ({
    id: f.id,
    name: f.name,
    reads: readsOf(f),
    ...(f.custom ? { custom: f.custom } : {}),
  }));
}

// Whether a Rollup's calculation can read a field: a number (money and shares too, never a Sum of shares) for Sum,
// Average, Min and Max; a day for Earliest and Latest.
export function aggregateFits(a: Aggregate, field: Pick<ReadableField, 'reads'>): boolean {
  const reads = aggregateReads(a);
  if (reads === 'date') return field.reads === 'date';
  if (reads === 'none') return false;
  if (field.reads === 'percent') return a !== 'sum';
  return field.reads === 'number' || field.reads === 'currency';
}

// What an aggregate needs, for a refusal and the editor's empty menu.
export function aggregateNeeds(a: Aggregate): string {
  if (aggregateReads(a) === 'date') return 'a Date, Start Date or Due Date field';
  return a === 'sum'
    ? 'a Number, Currency, Rating or Estimate field'
    : 'a Number, Currency, Rating, Estimate or Percent field';
}

// A Card field others may read through, named as the first type holding it names it.
export interface ThroughOption {
  id: string;
  label: string;
}

// The Card fields of `holder` (a type, offered on it) that link to `typeId`.
const cardFieldsTo = (holder: ItemTypeDef, typeId: string): CustomFieldDef[] =>
  (holder.custom ?? []).filter(
    (c) => c.kind === 'card' && holder.fields.includes(c.id) && linkTypesOf(c).includes(typeId),
  );

// A Rollup's Through menu on a type: every Card field of any type that links to it, each id once.
export function rollupThroughOptions(
  typeId: string,
  types: readonly ItemTypeDef[],
): ThroughOption[] {
  const out: ThroughOption[] = [];
  for (const t of types)
    for (const c of cardFieldsTo(t, typeId))
      if (!out.some((o) => o.id === c.id)) out.push({ id: c.id, label: c.label });
  return out;
}

// The types whose cards are a Rollup's children: those holding the Through field (any Card field for every child)
// linking to `typeId`.
export function rollupChildTypes(
  typeId: string,
  through: string | undefined,
  types: readonly ItemTypeDef[],
): ItemTypeDef[] {
  return types.filter((t) => cardFieldsTo(t, typeId).some((c) => !through || c.id === through));
}

// A Lookup's Through menu: the type's own Card fields.
export function lookupThroughOptions(
  type: Pick<ItemTypeDef, 'fields' | 'custom'>,
): ThroughOption[] {
  return (type.custom ?? [])
    .filter((c) => c.kind === 'card' && type.fields.includes(c.id))
    .map((c) => ({ id: c.id, label: c.label }));
}

// The fields the given types offer to read, each id once (named as the first type naming it), in type order.
function readableAcross(types: readonly ItemTypeDef[]): ReadableField[] {
  const out: ReadableField[] = [];
  for (const t of types)
    for (const f of readableFieldsOf(t)) if (!out.some((o) => o.id === f.id)) out.push(f);
  return out;
}

// A Rollup's Field menu: the children's types' fields its calculation can read.
export function rollupSourceOptions(
  field: Pick<CustomFieldDef, 'through' | 'aggregate'>,
  typeId: string,
  types: readonly ItemTypeDef[],
): ReadableField[] {
  const a = aggregateOf(field);
  return readableAcross(rollupChildTypes(typeId, field.through, types)).filter((f) =>
    aggregateFits(a, f),
  );
}

// A Lookup's Field menu: the fields of the card types its Through field links to.
export function lookupSourceOptions(
  through: string | undefined,
  type: Pick<ItemTypeDef, 'fields' | 'custom'>,
  types: readonly ItemTypeDef[],
): ReadableField[] {
  const def = (type.custom ?? []).find((c) => c.id === through && c.kind === 'card');
  if (!def) return [];
  const linked = linkTypesOf(def)
    .map((id) => types.find((t) => t.id === id))
    .filter((t): t is ItemTypeDef => !!t);
  return readableAcross(linked);
}

// The result a Rollup or Lookup takes from what it reads (`result` stored as absent for a Number), with a Currency
// one's currency; Number for anything not yet set.
export interface InferredResult {
  result?: FormulaResult;
  currency?: string;
}

export function inferredResult(
  field: Pick<CustomFieldDef, 'kind' | 'calculation' | 'through' | 'aggregate' | 'source'>,
  type: Pick<ItemTypeDef, 'id' | 'fields' | 'custom'>,
  types: readonly ItemTypeDef[],
): InferredResult {
  let read: ReadableField | undefined;
  if (isRollupField(field)) {
    const reads = aggregateReads(aggregateOf(field));
    if (reads === 'none') return {};
    if (reads === 'date') return { result: 'date' };
    read = rollupSourceOptions(field, type.id, types).find((f) => f.id === field.source);
  } else if (isLookupField(field)) {
    read = lookupSourceOptions(field.through, type, types).find((f) => f.id === field.source);
  }
  if (!read || read.reads === 'number') return {};
  const currency = read.reads === 'currency' ? read.custom?.currency : undefined;
  return { result: read.reads, ...(currency ? { currency } : {}) };
}

// The settings a Rollup or Lookup keeps, and the result they give (an `undefined` clears a key): what the editor
// patches in and the agents write.
export function rollupSettings(
  field: Pick<CustomFieldDef, 'kind' | 'calculation' | 'through' | 'aggregate' | 'source'>,
  type: Pick<ItemTypeDef, 'id' | 'fields' | 'custom'>,
  types: readonly ItemTypeDef[],
): Pick<CustomFieldDef, 'through' | 'aggregate' | 'source' | 'result' | 'currency'> {
  const inferred = inferredResult(field, type, types);
  const rollup = isRollupField(field);
  const reads = rollup ? aggregateReads(aggregateOf(field)) : 'number';
  return {
    through: field.through,
    aggregate: rollup ? aggregateOf(field) : undefined,
    source: reads === 'none' ? undefined : field.source,
    result: inferred.result,
    currency: inferred.currency,
  };
}

// What is wrong with a Rollup or Lookup's settings on a type, whatever the card: a Card field or field it reads that
// no type has any more. Null when it reads.
export const GONE_PROBLEM = 'The field it reads is gone';
export function rollupProblem(
  field: Pick<CustomFieldDef, 'kind' | 'calculation' | 'through' | 'aggregate' | 'source'>,
  type: Pick<ItemTypeDef, 'id' | 'fields' | 'custom'>,
  types: readonly ItemTypeDef[],
): string | null {
  if (isRollupField(field)) {
    if (field.through && !rollupThroughOptions(type.id, types).some((o) => o.id === field.through))
      return GONE_PROBLEM;
    if (aggregateReads(aggregateOf(field)) === 'none') return null;
    return rollupSourceOptions(field, type.id, types).some((f) => f.id === field.source)
      ? null
      : GONE_PROBLEM;
  }
  if (isLookupField(field))
    return lookupSourceOptions(field.through, type, types).some((f) => f.id === field.source)
      ? null
      : GONE_PROBLEM;
  return null;
}
