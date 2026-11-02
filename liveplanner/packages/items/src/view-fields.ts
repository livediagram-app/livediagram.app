// Fields by role in the plan views (docs/specs/026-plan/item-types.md "Fields by role", plan-views.md "Dates" and
// "Cards by Field"): the date fields a Gantt chart and the calendars read, and the number Cards by Field adds up.
// Each reads the built-in field until the view picks another of its kind; a picked field no type offers any more
// reads as the built-in again. Pure.
import type { Item } from './item';
import type { CustomFieldDef, ItemTypeDef } from './item-types';

// What a date field holds (docs/specs/026-plan/plan-views.md "Times and ranges"): a day, a moment, or a range of days
// or of moments. The built-ins are days.
export type DateShape = 'date' | 'datetime' | 'daterange' | 'daterange-time';

// The fields a view reads its dates from: a Gantt chart both, a Due Calendar `due`, a Start Calendar `start`; and
// what each holds, when it is not a day.
export interface ViewDates {
  start: string;
  due: string;
  shapes?: Partial<Record<'start' | 'due', DateShape>>;
}

export const BUILT_IN_DATES: ViewDates = { start: 'start', due: 'due' };

// The custom field kinds a view reads as dates.
const DATE_KINDS: readonly string[] = ['date', 'datetime', 'daterange'];

const shapeOf = (f: CustomFieldDef): DateShape =>
  f.kind === 'daterange'
    ? f.withTime === true
      ? 'daterange-time'
      : 'daterange'
    : (f.kind as DateShape);

// The settings a view keeps for its fields by role.
export interface ViewFieldSettings {
  startField?: string;
  dueField?: string;
  measure?: string;
}

export interface ViewFieldOption {
  id: string;
  label: string;
}

const BUILT_IN_DATE_OPTIONS: Readonly<Record<'start' | 'due', ViewFieldOption>> = {
  start: { id: 'start', label: 'Start Date' },
  due: { id: 'due', label: 'Due Date' },
};

// The most characters a picked field's id holds: a custom field id's (CUSTOM_FIELD_ID_PATTERN) with room to spare.
export const VIEW_FIELD_ID_MAX = 64;

export const isViewFieldId = (v: unknown): v is string =>
  typeof v === 'string' && v.length > 0 && v.length <= VIEW_FIELD_ID_MAX;

// The custom fields of some kinds the types offer, each once, named as the first type offering it names it.
function customDefsOf(types: readonly ItemTypeDef[], kinds: readonly string[]): CustomFieldDef[] {
  const out: CustomFieldDef[] = [];
  for (const t of types)
    for (const c of t.custom ?? [])
      if (kinds.includes(c.kind) && t.fields.includes(c.id) && !out.some((o) => o.id === c.id))
        out.push(c);
  return out;
}

function customOfKind(types: readonly ItemTypeDef[], kind: string): ViewFieldOption[] {
  return customDefsOf(types, [kind]).map((c) => ({ id: c.id, label: c.label }));
}

const offers = (types: readonly ItemTypeDef[], id: string) =>
  types.some((t) => t.fields.includes(id));

// The Date fields a view of `types` can read for one role: the role's built-in first (when a type offers it), then
// every custom Date field.
export function viewDateOptions(
  types: readonly ItemTypeDef[],
  role: 'start' | 'due',
): ViewFieldOption[] {
  const builtIn = BUILT_IN_DATE_OPTIONS[role];
  const custom = customDefsOf(types, DATE_KINDS).map((c) => ({ id: c.id, label: c.label }));
  return [...(offers(types, builtIn.id) ? [builtIn] : []), ...custom];
}

// The date fields a view reads: its picks that a type still offers as a Date field, else the built-ins.
export function viewDatesOf(
  settings: ViewFieldSettings | undefined,
  types: readonly ItemTypeDef[],
): ViewDates {
  const dates = new Map(customDefsOf(types, DATE_KINDS).map((c) => [c.id, c]));
  const pick = (id: string | undefined, fallback: string) => (id && dates.has(id) ? id : fallback);
  const start = pick(settings?.startField, BUILT_IN_DATES.start);
  const due = pick(settings?.dueField, BUILT_IN_DATES.due);
  const shapes: Partial<Record<'start' | 'due', DateShape>> = {};
  const startDef = dates.get(start);
  const dueDef = dates.get(due);
  if (startDef && startDef.kind !== 'date') shapes.start = shapeOf(startDef);
  if (dueDef && dueDef.kind !== 'date') shapes.due = shapeOf(dueDef);
  return Object.keys(shapes).length ? { start, due, shapes } : { start, due };
}

// What Cards by Field can add up: Estimate (when a type offers it), then every custom Number field.
export function viewMeasureOptions(types: readonly ItemTypeDef[]): ViewFieldOption[] {
  return [
    ...(offers(types, 'estimate') ? [{ id: 'estimate', label: 'Estimate' }] : []),
    ...customOfKind(types, 'number'),
  ];
}

// The field Cards by Field adds up, or undefined to count cards: its pick while a type still offers it.
export function viewMeasureOf(
  settings: ViewFieldSettings | undefined,
  types: readonly ItemTypeDef[],
): ViewFieldOption | undefined {
  const id = settings?.measure;
  return id ? viewMeasureOptions(types).find((o) => o.id === id) : undefined;
}

// A card's value for a measure: its number, or 0 without one (or below nothing: a bar never runs backwards).
export function measureValue(item: Pick<Item, 'fields'>, field: string): number {
  const v = item.fields[field];
  return typeof v === 'number' && Number.isFinite(v) && v > 0 ? v : 0;
}

// A measured total as a bar's end says it: whole, or to one place (0.1 + 0.2 reads 0.3).
export const measureNumber = (total: number): string =>
  Number.isInteger(total) ? String(total) : String(Math.round(total * 10) / 10);

// What a measured total reads as: "34 points" for Estimate, "34 Story Points" for a field of the type's own.
export function measureCountLabel(total: number, measure: ViewFieldOption): string {
  const n = measureNumber(total);
  return measure.id === 'estimate'
    ? `${n} ${total === 1 ? 'point' : 'points'}`
    : `${n} ${measure.label}`;
}

// A date field's short name, as an announcement says it ("its Start too", "its Kickoff too").
export function viewDateName(types: readonly ItemTypeDef[], id: string): string {
  if (id === BUILT_IN_DATES.start) return 'Start';
  if (id === BUILT_IN_DATES.due) return 'Due';
  return customDefsOf(types, DATE_KINDS).find((o) => o.id === id)?.label ?? 'date';
}
