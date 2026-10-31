// Calculated fields (docs/specs/026-plan/item-types.md "Calculated fields"): a custom field whose value is worked out
// from the plan, never typed or stored. Its `calculation`, from a fixed menu, says what it counts: a card's children
// (the cards whose Card field links to it) or how many of them are done (in a done column, done-columns.ts), one of
// the children's fields aggregated (a Rollup) or a linked card's field (a Lookup; rollup-fields.ts), or a formula over
// the card's own fields (formula-fields.ts). The editor, the api and the agents each work it out as they read, with
// these same functions: one walk per value reads other cards' values through itself, so a Formula may read a Rollup
// and a Rollup a Formula, each (card, field) worked out once per walk, a cycle or too much work an error. Pure.
import { isTrashed } from './board';
import { itemStatus, type Item } from './item';
import {
  CALCULATIONS,
  linkTypesOf,
  type Calculation,
  type CustomFieldDef,
  type ItemTypeDef,
} from './item-types';
import type { PlanBoardOutline } from './plan-outline';
import {
  fieldValueOn,
  formulaOutcome,
  formulaResultOf,
  formulaText,
  scalarAs,
  type FormulaContext,
  type FormulaOutcome,
  type FormulaScalar,
} from './formula-fields';
import { calculatedResultOf, hasResult } from './calculated-result';
import { formulaScopeOf } from './formula/references';
import { dateOf, dayText, isDate, isList, type FormulaValue } from './formula/values';
import { aggregateOf, aggregateReads, rollupProblem } from './rollup-fields';
import { fieldCardIds, linkedCardIds } from './several-values';

export const CALCULATION_LABELS: Readonly<Record<Calculation, string>> = {
  childCount: 'Child Count',
  childrenDone: 'Children Done (%)',
  rollup: 'Rollup',
  lookup: 'Lookup',
  formula: 'Formula',
};

// A Calculated field's value: a count or whole percentage, a Formula's, Rollup's or Lookup's number, text, true or
// false or day, or none.
export type CalculatedValue = FormulaScalar;

// One value's working-out (docs/specs/026-plan/item-types.md "Rollup and Lookup fields", With Formulas): at most this
// many steps (each card read, each formula step), reading through at most this many values across cards.
export const CALCULATED_STEPS_MAX = 100_000;
export const CALCULATED_DEPTH_MAX = 8;

export const isCalculation = (v: unknown): v is Calculation =>
  (CALCULATIONS as readonly unknown[]).includes(v);

type CalculatedDef = Pick<
  CustomFieldDef,
  'kind' | 'calculation' | 'formula' | 'result' | 'currency'
> &
  Partial<Pick<CustomFieldDef, 'id' | 'label' | 'through' | 'aggregate' | 'source'>>;

// What a value needs beyond the child index: the card's type, the cards (a Card field's "#12 Title", a Lookup's
// linked card) and the catalogue (the types of the cards a Rollup or Lookup reads; without it they read none).
export type FormulaReading = Pick<FormulaContext, 'items' | 'today'> & {
  type: ItemTypeDef;
  types?: readonly ItemTypeDef[] | undefined;
};

// A field's calculation; undefined for a field that is no Calculated field, or one whose calculation is unknown.
export function calculationOf(
  field: Pick<CustomFieldDef, 'kind' | 'calculation'>,
): Calculation | undefined {
  return field.kind === 'calculated' && isCalculation(field.calculation)
    ? field.calculation
    : undefined;
}

// One card linking to another: the card, the Card field it links through, and the card types that field names.
interface ChildLink {
  item: Item;
  field: string;
  linkTypes: readonly string[];
}

// Every live card's links, by the card linked to: one pass over the cards, made once per read of the plan, so a
// board works out each card's values from it without scanning the cards again. A trashed card is no child; an
// archived one still is (as the panel's Linked as sections list it).
export type ChildIndex = ReadonlyMap<string, readonly ChildLink[]>;

export function childIndexOf(items: Iterable<Item>, types: readonly ItemTypeDef[]): ChildIndex {
  const cardFields = new Map<string, { def: CustomFieldDef; linkTypes: readonly string[] }[]>();
  for (const t of types) {
    const fields = (t.custom ?? [])
      .filter((c) => c.kind === 'card' && t.fields.includes(c.id))
      .map((def) => ({ def, linkTypes: linkTypesOf(def) }));
    if (fields.length) cardFields.set(t.id, fields);
  }
  const out = new Map<string, ChildLink[]>();
  for (const it of items) {
    const fields = cardFields.get(it.type);
    if (!fields || isTrashed(it)) continue;
    // Every card a field links to, each of a list's for a field that holds several (item-types.md "Holds Several").
    for (const f of fields)
      for (const to of linkedCardIds(it, f.def)) {
        if (to === it.id) continue;
        let list = out.get(to);
        if (!list) out.set(to, (list = []));
        list.push({ item: it, field: f.def.id, linkTypes: f.linkTypes });
      }
  }
  return out;
}

// The index for a store held as a map, made once per map (a write makes a new map) and types: a board of n cards
// drawn from one map costs one pass, not n.
const indexes = new WeakMap<
  ReadonlyMap<string, Item>,
  { types: readonly ItemTypeDef[]; index: ChildIndex }
>();
export function childIndexFor(
  items: ReadonlyMap<string, Item>,
  types: readonly ItemTypeDef[],
): ChildIndex {
  const hit = indexes.get(items);
  if (hit && hit.types === types) return hit.index;
  const index = childIndexOf(items.values(), types);
  indexes.set(items, { types, index });
  return index;
}

// A card's children: the cards linking to it through a Card field that names its type (only `through`, when given),
// each once.
export function childrenOf(
  item: Pick<Item, 'id' | 'type'>,
  index: ChildIndex,
  through?: string,
): Item[] {
  const seen = new Set<string>();
  const out: Item[] = [];
  for (const l of index.get(item.id) ?? [])
    if (
      l.linkTypes.includes(item.type) &&
      (through === undefined || l.field === through) &&
      !seen.has(l.item.id)
    ) {
      seen.add(l.item.id);
      out.push(l.item);
    }
  return out;
}

// Whether a card's status is done (a done column's).
export type IsDoneStatus = (status: string | undefined) => boolean;

// The statuses a plan's boards count as done, from their outline (the api and the agents): the first board to name
// a status decides, as statusPhasesOf decides a status's phase; All Cards and Archive boards name none.
export function doneStatusesOf(
  boards: readonly Pick<PlanBoardOutline, 'kind' | 'columns'>[],
): IsDoneStatus {
  const done = new Map<string, boolean>();
  for (const b of boards) {
    if (b.kind !== 'board') continue;
    for (const c of b.columns) if (!done.has(c.status)) done.set(c.status, c.done === true);
  }
  return (status) => status !== undefined && done.get(status) === true;
}

// The same from the phases statusPhasesOf gives (the editor's).
export function donePhase(phases: ReadonlyMap<string, string>): IsDoneStatus {
  return (status) => status !== undefined && phases.get(status) === 'done';
}

// --- The walk ----------------------------------------------------------------------------------------------------

// One value's working-out: what it reads with, the steps left, the values being worked out (a cycle check), those
// done, and the problem that stopped it (a cycle, too much work), which makes the whole value an error.
interface Walk {
  index: ChildIndex;
  isDone: IsDoneStatus | undefined;
  items: ReadonlyMap<string, Item> | undefined;
  types: readonly ItemTypeDef[] | undefined;
  today: string | undefined;
  steps: { left: number };
  visiting: Set<string>;
  done: Map<string, CalculatedValue>;
  stopped: string | null;
}

const TOO_MUCH = 'Too much to work out';

function walkOf(
  index: ChildIndex,
  isDone: IsDoneStatus | undefined,
  r: Partial<FormulaReading> | undefined,
): Walk {
  return {
    index,
    isDone,
    items: r?.items,
    types: r?.types,
    today: r?.today,
    steps: { left: CALCULATED_STEPS_MAX },
    visiting: new Set(),
    done: new Map(),
    stopped: null,
  };
}

// Counts `n` steps off; false (and the walk stopped) once they run out.
function step(w: Walk, n: number): boolean {
  w.steps.left -= n;
  if (w.steps.left >= 0) return true;
  w.stopped ??= TOO_MUCH;
  return false;
}

// A Rollup's or Lookup's problem whatever the card, worked out once per field, type and catalogue.
const problems = new WeakMap<
  object,
  { type: ItemTypeDef; types: readonly ItemTypeDef[]; problem: string | null }
>();
function settingsProblem(
  field: CalculatedDef,
  type: ItemTypeDef,
  types: readonly ItemTypeDef[],
): string | null {
  const hit = problems.get(field);
  if (hit && hit.type === type && hit.types === types) return hit.problem;
  const problem = rollupProblem(field, type, types);
  problems.set(field, { type, types, problem });
  return problem;
}

const NONE: FormulaOutcome = { ok: true, value: null };

// A Calculated field's value on a card within the walk: a nested value's problem reads as no value.
function valueIn(w: Walk, field: CalculatedDef, item: Item, type: ItemTypeDef): CalculatedValue {
  const out = outcomeIn(w, field, item, type);
  return out.ok ? out.value : null;
}

// Each (card, field) worked out once per walk; reading itself again stops the walk, as does reading too deep.
function outcomeIn(w: Walk, field: CalculatedDef, item: Item, type: ItemTypeDef): FormulaOutcome {
  const calc = calculationOf(field);
  if (!calc || w.stopped) return NONE;
  const key = field.id === undefined ? undefined : `${item.id}\u0000${field.id}`;
  if (key !== undefined) {
    const hit = w.done.get(key);
    if (hit !== undefined) return { ok: true, value: hit };
    if (w.visiting.has(key)) {
      w.stopped ??= `Circular: ${field.label ?? 'this field'} reads itself`;
      return NONE;
    }
    if (w.visiting.size >= CALCULATED_DEPTH_MAX) {
      w.stopped ??= TOO_MUCH;
      return NONE;
    }
    w.visiting.add(key);
  }
  const out = worked(w, calc, field, item, type);
  if (key !== undefined) {
    w.visiting.delete(key);
    if (out.ok && !w.stopped) w.done.set(key, out.value);
  }
  return out;
}

function worked(
  w: Walk,
  calc: Calculation,
  field: CalculatedDef,
  item: Item,
  type: ItemTypeDef,
): FormulaOutcome {
  if (calc === 'childCount' || calc === 'childrenDone')
    return { ok: true, value: childValue(calc, item, w) };
  if (calc === 'formula')
    return formulaOutcome(field, item, type, {
      items: w.items,
      today: w.today,
      steps: w.steps,
      calculated: (f) => valueIn(w, f, item, type),
    });
  // A Rollup or Lookup reads other cards' types: none without the catalogue.
  if (!w.types) return NONE;
  const problem = settingsProblem(field, type, w.types);
  if (problem) return { ok: false, error: problem };
  return {
    ok: true,
    value: calc === 'rollup' ? rollupValue(w, field, item) : lookupValue(w, field, item, type),
  };
}

// Child Count or Children Done on a card.
function childValue(calc: 'childCount' | 'childrenDone', item: Item, w: Walk): number | null {
  const kids = childrenOf(item, w.index);
  if (calc === 'childCount') return kids.length;
  const isDone = w.isDone;
  if (kids.length === 0 || !isDone) return null;
  const done = kids.filter((k) => isDone(itemStatus(k))).length;
  return Math.round((done / kids.length) * 100);
}

const typeIn = (types: readonly ItemTypeDef[] | undefined, id: string) =>
  types?.find((t) => t.id === id);

// A field's value on another card as a Rollup or Lookup reads it: a Calculated field's through the walk (a Date result
// as a date), any other as a formula reads it; none when its type does not offer the field.
function readOn(w: Walk, card: Item, id: string): FormulaValue {
  const type = typeIn(w.types, card.type);
  if (!type) return null;
  const f = formulaScopeOf(type).byId.get(id);
  if (!f) return null;
  if (f.custom?.kind === 'calculated') {
    const v = valueIn(w, f.custom, card, type);
    return typeof v === 'string' && calculatedResultOf(f.custom) === 'date' ? dateOf(v) : v;
  }
  return fieldValueOn(card, type, id, w.items ? { items: w.items } : {});
}

// A Rollup on a card: its children's values aggregated, rounded as its result reads.
function rollupValue(w: Walk, field: CalculatedDef, item: Item): CalculatedValue {
  const kids = childrenOf(item, w.index, field.through);
  if (!step(w, kids.length)) return null;
  const aggregate = aggregateOf(field);
  if (aggregate === 'count') return kids.length;
  const isDone = w.isDone;
  if (aggregate === 'countDone')
    return isDone ? kids.filter((k) => isDone(itemStatus(k))).length : null;
  const dates = aggregateReads(aggregate) === 'date';
  const values: number[] = [];
  for (const k of kids) {
    const v = readOn(w, k, field.source ?? '');
    if (w.stopped) return null;
    if (dates) {
      if (v !== null && isDate(v)) values.push(v.day);
    } else if (typeof v === 'number' && Number.isFinite(v)) values.push(v);
  }
  if (values.length === 0) return null;
  let n = values[0]!;
  if (aggregate === 'sum' || aggregate === 'average') {
    n = values.reduce((a, b) => a + b, 0);
    if (aggregate === 'average') n /= values.length;
  } else
    for (const v of values)
      n = aggregate === 'min' || aggregate === 'earliest' ? Math.min(n, v) : Math.max(n, v);
  return dates ? dayText({ day: n }) : scalarAs(formulaResultOf(field), n);
}

// A Lookup on a card: the field of the first linked card still there (not missing, not in the Trash), read as its
// result; a list reads as text.
function lookupValue(
  w: Walk,
  field: CalculatedDef,
  item: Item,
  type: ItemTypeDef,
): CalculatedValue {
  const through = type.custom?.find((c) => c.id === field.through);
  if (!through || !w.items) return null;
  for (const id of fieldCardIds(through, item.fields[through.id])) {
    if (!step(w, 1)) return null;
    const linked = w.items.get(id);
    if (!linked || isTrashed(linked)) continue;
    const v = readOn(w, linked, field.source ?? '');
    if (w.stopped) return null;
    const result = formulaResultOf(field);
    return scalarAs(result, isList(v) && result !== 'text' ? null : v);
  }
  return null;
}

// A Calculated field's value on a card: a count, a whole percentage, a Formula's, Rollup's or Lookup's value, or null
// when there is nothing to work out (Children Done on a card without children, a Formula without `formula` to read
// with, a Rollup or Lookup without the catalogue, a value that can't be worked out, or a field that is no Calculated
// field).
export function calculatedValue(
  field: CalculatedDef,
  item: Item,
  index: ChildIndex,
  isDone: IsDoneStatus | undefined,
  formula?: FormulaReading,
): CalculatedValue {
  if (calculationOf(field) === 'formula' && !formula) return null;
  const out = calculatedOutcome(field, item, index, isDone, formula);
  return out.ok ? out.value : null;
}

// The same with the problem kept (the card face and the panel show it); a cycle or too much work anywhere in the
// value's working-out is its problem.
export function calculatedOutcome(
  field: CalculatedDef,
  item: Item,
  index: ChildIndex,
  isDone: IsDoneStatus | undefined,
  formula?: FormulaReading,
): FormulaOutcome {
  const w = walkOf(index, isDone, formula);
  const type = formula?.type ?? typeIn(w.types, item.type);
  if (!type) {
    const calc = calculationOf(field);
    return calc === 'childCount' || calc === 'childrenDone'
      ? { ok: true, value: childValue(calc, item, w) }
      : NONE;
  }
  const out = outcomeIn(w, field, item, type);
  return w.stopped ? { ok: false, error: w.stopped } : out;
}

// The Calculated fields a type offers, in its custom field order.
export function calculatedFieldsOf(type: Pick<ItemTypeDef, 'fields' | 'custom'>): CustomFieldDef[] {
  return (type.custom ?? []).filter((f) => !!calculationOf(f) && type.fields.includes(f.id));
}

// Every Calculated field's value on a card, by field id; undefined when its type has none. `items` names a Card
// field's cards in a Formula and a Lookup's linked card; `types` lets a Rollup and a Lookup read other cards.
export function calculatedValuesOf(
  item: Item,
  type: ItemTypeDef,
  index: ChildIndex,
  isDone: IsDoneStatus | undefined,
  items?: ReadonlyMap<string, Item>,
  types?: readonly ItemTypeDef[],
): Record<string, CalculatedValue> | undefined {
  const fields = calculatedFieldsOf(type);
  if (fields.length === 0) return undefined;
  const out: Record<string, CalculatedValue> = {};
  for (const f of fields)
    out[f.id] = calculatedValue(f, item, index, isDone, { type, items, types });
  return out;
}

// Whether any type has a Calculated field, so a reader builds the child index only when one does.
export const hasCalculatedFields = (types: readonly ItemTypeDef[]): boolean =>
  types.some((t) => calculatedFieldsOf(t).length > 0);

// A value as a card and the panel show it: "3", "40%", a Formula's, Rollup's or Lookup's by its result ("£2,500");
// null when there is nothing to show.
export function calculatedText(
  field: Pick<CustomFieldDef, 'kind' | 'calculation' | 'result' | 'currency'>,
  value: CalculatedValue | undefined,
): string | null {
  if (value === null || value === undefined) return null;
  if (hasResult(field)) return formulaText(field, value);
  return calculationOf(field) === 'childrenDone' ? `${value}%` : String(value);
}

// A plan's worked-out values as sort, CSV, swimlanes and sheets read them: the child index made on first need, once
// per items map and catalogue (childIndexFor), each value through the same walk. Without `isDone` Count Done and
// Children Done read none.
export type CalculatedRead = (field: CustomFieldDef, item: Item) => CalculatedValue;

export function calculatedReaderOf(
  items: ReadonlyMap<string, Item>,
  types: readonly ItemTypeDef[],
  isDone?: IsDoneStatus,
): CalculatedRead {
  let index: ChildIndex | undefined;
  return (field, item) => {
    const type = typeIn(types, item.type);
    if (!type) return null;
    index ??= childIndexFor(items, types);
    return calculatedValue(field, item, index, isDone, { type, items, types });
  };
}
