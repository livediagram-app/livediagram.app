// A board's lane fields and the rows (lane heads) one card sits in, and what a drop into a row sets
// (docs/specs/026-plan/plan-board.md "Swimlanes by a field"). board.ts re-exports the public ones.

import { builtInFieldLabel } from './built-in-field-labels';
import { itemColourOf } from './item-colour';
import type { Item, ItemFieldValue, ItemPerson, ItemMove } from './item';
import { itemLabels, itemTitle } from './item';
import {
  cardKey,
  fieldCardIds,
  fieldPeople,
  holdsSeveral,
  personKey,
  swappedValues,
} from './several-values';
import { customFieldOf, typeIn } from './type-catalogue';
import { calculatedResultOf, hasResult } from './calculated-result';
import { calculatedReaderOf, type IsDoneStatus } from './calculated-fields';
import type { FormulaResult } from './formula/limits';
import { percentText, percentValue } from './percent-fields';
import { isRisk, riskLabel } from './risk-fields';
import { type CustomFieldDef, linkTypesOf, type ItemTypeDef } from './item-types';
import {
  STAMP_FIELDS,
  STAMP_FIELD_LABELS,
  isStampField,
  itemStampPerson,
  itemStampTime,
  stampDay,
  type StampTimeField,
} from './card-stamps';
import { linkedCard } from './board-model';

export const NO_LANE = '';

export interface LaneHead {
  key: string;
  label: string;
  // What a drop into this lane sets (null clears the field). 'field': `fieldId`, a field lane's field.
  field: 'assignee' | 'type' | 'priority' | 'status' | 'field' | null;
  value: Item['fields'][string] | null;
  person?: ItemPerson;
  // A Project lane's own colour (docs/specs/026-plan/items.md "Colour"), a dot before its name.
  colour?: string;
  fieldId?: string;
  fieldKind?: LaneFieldKind;
  // A row of a field that holds several (item-types.md "Holds Several"): a drop swaps values rather than setting one.
  several?: boolean;
  // A row of a worked-out value (item-types.md "Rollup and Lookup fields", Filters): a drop into it sets nothing.
  readOnly?: true;
}

// How a field lane groups (docs/specs/026-plan/plan-board.md "Swimlanes by a field").
export type LaneFieldKind =
  | 'choice'
  | 'risk'
  | 'checkbox'
  | 'number'
  | 'percent'
  | 'date'
  | 'text'
  | 'labels'
  | 'card'
  | 'person';
export interface LaneField {
  id: string;
  label: string;
  kind: LaneFieldKind;
  // One of the item's stamps (card-stamps.ts), or a worked-out value: read, never set, so a drop into its row sets
  // nothing.
  readOnly?: true;
  // A Formula, Rollup or Lookup (docs/specs/026-plan/item-types.md "Rollup and Lookup fields", Filters): a row per
  // worked-out value, laned as its result's kind.
  calculated?: true;
  options?: readonly string[];
  // A Card field's target types: a row per linked card, of any of them (docs/specs/026-plan/item-types.md "Card
  // fields").
  linkTypes?: readonly string[];
  // A Person or Card field that holds several: a card sits in each of its values' rows (item-types.md "Holds
  // Several").
  several?: boolean;
  // A Multiple Choice field, offered to filters only (`laneGroups`' `everyValue`): a row per value.
  multi?: true;
}

const BUILT_IN_LANE_FIELDS: readonly LaneField[] = [
  { id: 'labels', label: 'Labels', kind: 'labels' },
  { id: 'estimate', label: 'Estimate', kind: 'number' },
  { id: 'start', label: 'Start Date', kind: 'date' },
  { id: 'due', label: 'Due Date', kind: 'date' },
];
const BUILT_IN_LANE_IDS: ReadonlySet<string> = new Set(BUILT_IN_LANE_FIELDS.map((f) => f.id));
// The four stamps every type offers (docs/specs/026-plan/items.md "Created and Last Edited").
const STAMP_LANE_FIELDS: readonly LaneField[] = STAMP_FIELDS.map((id) => ({
  id,
  label: STAMP_FIELD_LABELS[id],
  kind: id === 'createdBy' || id === 'updatedBy' ? 'person' : 'date',
  readOnly: true,
}));
const GROUPING_KINDS = new Set<string>([
  'choice',
  // A row per level, in order (docs/specs/026-plan/item-types.md "Risk").
  'risk',
  'checkbox',
  'number',
  // A share groups as a Number, a row per share (docs/specs/026-plan/item-types.md "Percent").
  'percent',
  'date',
  'text',
  'card',
  'person',
  'labels',
]);

// The lane kind of a Formula, Rollup or Lookup's result: Number, Percent, Date, Text and Checkbox lane as those kinds;
// a Currency, like a Currency field, lanes none.
const CALCULATED_LANE_KINDS: Partial<Record<FormulaResult, LaneFieldKind>> = {
  number: 'number',
  percent: 'percent',
  date: 'date',
  text: 'text',
  checkbox: 'checkbox',
};
const calculatedLaneKind = (c: CustomFieldDef): LaneFieldKind | undefined =>
  hasResult(c) ? CALCULATED_LANE_KINDS[calculatedResultOf(c)!] : undefined;

// The fields a board can lane by, of the types it shows: the built-ins those types offer, then every grouping
// custom field in catalogue order, each once (named as the first type that offers it names it).
export function laneFieldsOf(types: readonly ItemTypeDef[], withMulti = false): LaneField[] {
  // A built-in lane field only when one of the types offers it (docs/specs/026-plan/plan-board.md "Swimlanes by a
  // field"): a board or chart lanes by what its own cards can hold.
  // The stamps with any type at all: every type offers them.
  return everyLaneField(types, withMulti).filter((f) =>
    f.readOnly
      ? types.length > 0
      : !BUILT_IN_LANE_IDS.has(f.id) || types.some((t) => t.fields.includes(f.id)),
  );
}

// Every field a board could lane by, offered or not: what a board already laned by a field looks it up in. The
// stamps come after the built-ins, before the custom fields.
function everyLaneField(types: readonly ItemTypeDef[], withMulti = false): LaneField[] {
  const out: LaneField[] = [
    ...BUILT_IN_LANE_FIELDS.map((f) => ({ ...f, label: builtInFieldLabel(f.id, types, f.label) })),
    ...STAMP_LANE_FIELDS,
  ];
  for (const t of types)
    for (const c of t.custom ?? []) {
      if (withMulti && c.kind === 'multichoice' && t.fields.includes(c.id)) {
        if (!out.some((f) => f.id === c.id))
          out.push({
            id: c.id,
            label: c.label,
            kind: 'choice',
            multi: true,
            ...(c.options ? { options: c.options } : {}),
          });
        continue;
      }
      const worked = calculatedLaneKind(c);
      if (worked && t.fields.includes(c.id) && !out.some((f) => f.id === c.id)) {
        out.push({ id: c.id, label: c.label, kind: worked, readOnly: true, calculated: true });
        continue;
      }
      if (!GROUPING_KINDS.has(c.kind) || !t.fields.includes(c.id)) continue;
      if (out.some((f) => f.id === c.id)) continue;
      out.push({
        id: c.id,
        label: c.label,
        kind: c.kind as LaneFieldKind,
        ...(c.options ? { options: c.options } : {}),
        ...(c.kind === 'card' ? { linkTypes: linkTypesOf(c) } : {}),
        ...(holdsSeveral(c) ? { several: true } : {}),
      });
    }
  return out;
}

export function laneFieldOf(
  id: string | undefined,
  types: readonly ItemTypeDef[],
  withMulti = false,
): LaneField | undefined {
  return id ? everyLaneField(types, withMulti).find((f) => f.id === id) : undefined;
}

// An item's value for a field lane, or undefined for the No row (a checkbox is never undefined); a worked-out field's
// from `calculated`.
export function laneValue(
  field: LaneField,
  item: Item,
  calc?: LaneCalc,
): string | number | boolean | undefined {
  if (field.kind === 'labels') return labelsIn(field.id, item)[0];
  const v = field.calculated ? calc?.(field.id, item) : item.fields[field.id];
  if (field.kind === 'checkbox') return v === true;
  if (field.kind === 'number') return typeof v === 'number' && Number.isFinite(v) ? v : undefined;
  if (field.kind === 'percent') return typeof v === 'number' ? percentValue(v) : undefined;
  // A stored level; anything else reads as no level.
  if (field.kind === 'risk') return isRisk(v) ? v : undefined;
  if (typeof v !== 'string') return undefined;
  const s = field.kind === 'text' ? v.trim() : v;
  return s ? s : undefined;
}

// A worked-out field's value on a card (a Formula, Rollup or Lookup laned by its result), by field id: one reader per
// grouping, so the child index is made once (calculated-fields.ts).
export type LaneCalc = (fieldId: string, item: Item) => ItemFieldValue | undefined;
export function laneCalcOf(
  items: ReadonlyMap<string, Item>,
  types: readonly ItemTypeDef[],
  isDone: IsDoneStatus | undefined,
): LaneCalc {
  const read = calculatedReaderOf(items, types, isDone);
  return (id, item) => {
    const def = customFieldOf(typeIn(types, item.type), id);
    return def ? (read(def, item) ?? undefined) : undefined;
  };
}

// A Labels field's labels: the built-in's, or a custom Labels field's (docs/specs/026-plan/item-types.md "Custom field
// kinds").
export function labelsIn(fieldId: string, item: Pick<Item, 'fields'>): string[] {
  if (fieldId === 'labels') return itemLabels(item);
  const v = item.fields[fieldId];
  return Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string' && x !== '') : [];
}

// A field lane's field as several-values.ts reads it.
const severalOf = (field: LaneField) => ({
  kind: field.kind as 'person' | 'card',
  multiple: field.several === true,
});

// What every row of a field lane carries.
const laneBase = (field: LaneField) => ({
  field: 'field' as const,
  fieldId: field.id,
  fieldKind: field.kind,
  ...(field.several ? { several: true } : {}),
  ...(field.calculated ? { readOnly: true as const } : {}),
});

// A Person field's rows: its person's, or each of its people's when it holds several, named and drawn as an Assignee
// row (plan-board.md "Swimlanes by a field"); No {Field} when it holds none.
export function personLanes(field: LaneField, item: Pick<Item, 'fields'>): LaneHead[] {
  const base = laneBase(field);
  const people = fieldPeople(severalOf(field), item.fields[field.id]);
  if (people.length === 0)
    return [{ key: NO_LANE, label: `No ${field.label}`, value: null, ...base }];
  return people.map((p) => ({
    key: `f:p:${p.id}`,
    label: p.name,
    value: { ...p },
    person: p,
    ...base,
  }));
}

// A Card field's rows: its linked card's, or each linked card's when it holds several, named by the linked card with
// its colour dot when it has a Colour (docs/specs/026-plan/item-types.md "Card fields"); No {Field} when it links none.
export function cardLanes(
  field: LaneField,
  item: Pick<Item, 'fields'>,
  items: ReadonlyMap<string, Item>,
  types: readonly ItemTypeDef[],
): LaneHead[] {
  const ids = fieldCardIds(severalOf(field), item.fields[field.id]);
  if (ids.length === 0) return [fieldLane(field, undefined)];
  return ids.map((id) => {
    const linked = linkedCard(items, id);
    const colour = linked ? itemColourOf(linked, typeIn(types, linked.type)) : undefined;
    return {
      ...fieldLane(field, id),
      label: linked ? itemTitle(linked) : 'Missing card',
      ...(colour ? { colour } : {}),
    };
  });
}

// A stamp's row: the person, or the local day of the moment (docs/specs/026-plan/items.md "Created and Last Edited").
// A card stored without one sits in the No row.
export function stampLane(field: LaneField, item: Partial<Item>): LaneHead {
  if (field.id === 'createdBy' || field.id === 'updatedBy') {
    const p = itemStampPerson(item, field.id);
    return personLanes(field, { fields: p ? { [field.id]: { ...p } } : {} })[0]!;
  }
  const at = itemStampTime(item, field.id as StampTimeField);
  return fieldLane(field, at === undefined ? undefined : stampDay(at));
}

export function fieldLane(
  field: LaneField,
  value: string | number | boolean | undefined,
): LaneHead {
  const base = laneBase(field);
  if (value === undefined)
    return { key: NO_LANE, label: `No ${field.label}`, value: null, ...base };
  const label =
    typeof value === 'boolean'
      ? value
        ? 'Yes'
        : 'No'
      : field.kind === 'percent' && typeof value === 'number'
        ? percentText(value)
        : field.kind === 'risk'
          ? (riskLabel(value) ?? String(value))
          : String(value);
  return { key: `f:${JSON.stringify(value)}`, label, value, ...base };
}

// What a drop into a lane sets on an item (docs/specs/026-plan/plan-board.md "Moving cards"): the lane's
// field, a type, or nothing for a status row (the move carries the status). A Labels row puts its label
// first, keeping the card's others; a Checkbox No row and any No row clear the field. A row of a field that holds
// several swaps the value of the row the card came `from` for its own, keeping the card's others (item-types.md
// "Holds Several").
export function laneDropPatch(
  lane: LaneHead | undefined,
  item?: Pick<Item, 'fields'>,
  from?: LaneHead,
): Pick<ItemMove, 'set' | 'clear' | 'type'> {
  if (!lane || !lane.field || lane.field === 'status') return {};
  if (lane.field === 'type') return typeof lane.value === 'string' ? { type: lane.value } : {};
  if (lane.field === 'field') {
    const id = lane.fieldId;
    // Nobody changes who made a card or when: a stamp's row sets nothing.
    if (!id || isStampField(id) || lane.readOnly) return {};
    if (lane.value === null || lane.value === false) return { clear: [id] };
    if (lane.fieldKind === 'labels' && typeof lane.value === 'string') {
      const rest = item ? labelsIn(id, item).filter((l) => l !== lane.value) : [];
      return { set: { [id]: [lane.value, ...rest] } };
    }
    if (lane.several) return { set: { [id]: severalDrop(lane, item, from) } };
    return { set: { [id]: lane.value } };
  }
  return lane.value === null ? { clear: [lane.field] } : { set: { [lane.field]: lane.value } };
}

// The list a drop into a row of a field holding several leaves: the row the card came from swapped for this one.
function severalDrop(
  lane: LaneHead,
  item: Pick<Item, 'fields'> | undefined,
  from: LaneHead | undefined,
): ItemFieldValue {
  const several = { kind: lane.fieldKind as 'person' | 'card', multiple: true };
  const stored = item?.fields[lane.fieldId!];
  const left =
    from && from.fieldId === lane.fieldId && from.value !== null ? from.value : undefined;
  if (lane.fieldKind === 'person')
    return swappedValues(
      fieldPeople(several, stored),
      left as ItemPerson | undefined,
      lane.value as ItemPerson,
      personKey,
    ).map((p) => ({ ...p }));
  return swappedValues(
    fieldCardIds(several, stored),
    left as string | undefined,
    lane.value as string,
    cardKey,
  );
}
