// Calculated fields (docs/specs/026-plan/item-types.md "Calculated fields"): a custom field whose value is worked out
// from the plan, never typed or stored. Its `calculation`, from a fixed menu, says what it counts: a card's children
// (the cards whose Card field links to it) or how many of them are done (in a done column, done-columns.ts), or a
// formula over the card's own fields (formula-fields.ts). The editor, the api and the agents each work it out as they
// read, with these same functions. Pure.
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
  formulaOutcome,
  formulaText,
  formulaValue,
  isFormulaField,
  type FormulaContext,
  type FormulaOutcome,
  type FormulaScalar,
} from './formula-fields';
import { linkedCardIds } from './several-values';

export const CALCULATION_LABELS: Readonly<Record<Calculation, string>> = {
  childCount: 'Child Count',
  childrenDone: 'Children Done (%)',
  formula: 'Formula',
};

// A Calculated field's value: a count or whole percentage, a Formula's number, text, true or false or day, or none.
export type CalculatedValue = FormulaScalar;

export const isCalculation = (v: unknown): v is Calculation =>
  (CALCULATIONS as readonly unknown[]).includes(v);

type CalculatedDef = Pick<
  CustomFieldDef,
  'kind' | 'calculation' | 'formula' | 'result' | 'currency'
> &
  Partial<Pick<CustomFieldDef, 'id'>>;

// What a Formula needs beyond the child index: the card's type, and the cards (a Card field's "#12 Title").
export type FormulaReading = Pick<FormulaContext, 'items' | 'today'> & { type: ItemTypeDef };

// A field's calculation; undefined for a field that is no Calculated field, or one whose calculation is unknown.
export function calculationOf(field: CalculatedDef): Calculation | undefined {
  return field.kind === 'calculated' && isCalculation(field.calculation)
    ? field.calculation
    : undefined;
}

// One card linking to another: the card, and the card types the field it links through names.
interface ChildLink {
  item: Item;
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
        list.push({ item: it, linkTypes: f.linkTypes });
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

// A card's children: the cards linking to it through a Card field that names its type, each once.
export function childrenOf(item: Pick<Item, 'id' | 'type'>, index: ChildIndex): Item[] {
  const seen = new Set<string>();
  const out: Item[] = [];
  for (const l of index.get(item.id) ?? [])
    if (l.linkTypes.includes(item.type) && !seen.has(l.item.id)) {
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

// A Calculated field's value on a card: a count, a whole percentage, a Formula's value, or null when there is nothing
// to work out (Children Done on a card without children, a Formula without `formula` to read with or that can't be
// worked out, or a field that is no Calculated field).
export function calculatedValue(
  field: CalculatedDef,
  item: Item,
  index: ChildIndex,
  isDone: IsDoneStatus,
  formula?: FormulaReading,
): CalculatedValue {
  const calc = calculationOf(field);
  if (!calc) return null;
  if (calc === 'formula') {
    if (!formula) return null;
    return formulaValue(field, item, formula.type, {
      ...formula,
      calculated: (f) => childValue(f, item, index, isDone),
    });
  }
  return childValue(field, item, index, isDone);
}

// The same with a Formula's problem kept (the card face and the panel show it): any other calculation works out.
export function calculatedOutcome(
  field: CalculatedDef,
  item: Item,
  index: ChildIndex,
  isDone: IsDoneStatus,
  formula: FormulaReading,
): FormulaOutcome {
  if (calculationOf(field) !== 'formula')
    return { ok: true, value: childValue(field, item, index, isDone) };
  return formulaOutcome(field, item, formula.type, {
    ...formula,
    calculated: (f) => childValue(f, item, index, isDone),
  });
}

// Child Count or Children Done on a card.
function childValue(
  field: CalculatedDef,
  item: Pick<Item, 'id' | 'type'>,
  index: ChildIndex,
  isDone: IsDoneStatus,
): number | null {
  const calc = calculationOf(field);
  if (calc !== 'childCount' && calc !== 'childrenDone') return null;
  const kids = childrenOf(item, index);
  if (calc === 'childCount') return kids.length;
  if (kids.length === 0) return null;
  const done = kids.filter((k) => isDone(itemStatus(k))).length;
  return Math.round((done / kids.length) * 100);
}

// The Calculated fields a type offers, in its custom field order.
export function calculatedFieldsOf(type: Pick<ItemTypeDef, 'fields' | 'custom'>): CustomFieldDef[] {
  return (type.custom ?? []).filter((f) => !!calculationOf(f) && type.fields.includes(f.id));
}

// Every Calculated field's value on a card, by field id; undefined when its type has none. `items` names a Card
// field's cards in a Formula.
export function calculatedValuesOf(
  item: Item,
  type: ItemTypeDef,
  index: ChildIndex,
  isDone: IsDoneStatus,
  items?: ReadonlyMap<string, Item>,
): Record<string, CalculatedValue> | undefined {
  const fields = calculatedFieldsOf(type);
  if (fields.length === 0) return undefined;
  const out: Record<string, CalculatedValue> = {};
  for (const f of fields) out[f.id] = calculatedValue(f, item, index, isDone, { type, items });
  return out;
}

// Whether any type has a Calculated field, so a reader builds the child index only when one does.
export const hasCalculatedFields = (types: readonly ItemTypeDef[]): boolean =>
  types.some((t) => calculatedFieldsOf(t).length > 0);

// A value as a card and the panel show it: "3", "40%", a Formula's by its result ("£2,500"); null when there is
// nothing to show.
export function calculatedText(
  field: Pick<CustomFieldDef, 'kind' | 'calculation' | 'result' | 'currency'>,
  value: CalculatedValue | undefined,
): string | null {
  if (value === null || value === undefined) return null;
  if (isFormulaField(field)) return formulaText(field, value);
  return calculationOf(field) === 'childrenDone' ? `${value}%` : String(value);
}
