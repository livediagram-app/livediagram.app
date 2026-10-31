// Fields by role in the plan views (docs/specs/026-plan/item-types.md "Fields by role", plan-views.md "Dates" and
// "Cards by Field"): the date fields a Gantt chart and the calendars read, and the number Cards by Field adds up.
// Each reads the built-in field until the view picks another of its kind; a picked field no type offers any more
// reads as the built-in again. Pure.
import type { Item } from './item';
import type { ItemTypeDef } from './item-types';

// The fields a view reads its dates from: a Gantt chart both, a Due Calendar `due`, a Start Calendar `start`.
export interface ViewDates {
  start: string;
  due: string;
}

export const BUILT_IN_DATES: ViewDates = { start: 'start', due: 'due' };

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

const BUILT_IN_DATE_OPTIONS: Readonly<Record<keyof ViewDates, ViewFieldOption>> = {
  start: { id: 'start', label: 'Start Date' },
  due: { id: 'due', label: 'Due Date' },
};

// The most characters a picked field's id holds: a custom field id's (CUSTOM_FIELD_ID_PATTERN) with room to spare.
export const VIEW_FIELD_ID_MAX = 64;

export const isViewFieldId = (v: unknown): v is string =>
  typeof v === 'string' && v.length > 0 && v.length <= VIEW_FIELD_ID_MAX;

// The custom fields of a kind the types offer, each once, named as the first type offering it names it.
function customOfKind(types: readonly ItemTypeDef[], kind: string): ViewFieldOption[] {
  const out: ViewFieldOption[] = [];
  for (const t of types)
    for (const c of t.custom ?? [])
      if (c.kind === kind && t.fields.includes(c.id) && !out.some((o) => o.id === c.id))
        out.push({ id: c.id, label: c.label });
  return out;
}

const offers = (types: readonly ItemTypeDef[], id: string) =>
  types.some((t) => t.fields.includes(id));

// The Date fields a view of `types` can read for one role: the role's built-in first (when a type offers it), then
// every custom Date field.
export function viewDateOptions(
  types: readonly ItemTypeDef[],
  role: keyof ViewDates,
): ViewFieldOption[] {
  const builtIn = BUILT_IN_DATE_OPTIONS[role];
  return [...(offers(types, builtIn.id) ? [builtIn] : []), ...customOfKind(types, 'date')];
}

// The date fields a view reads: its picks that a type still offers as a Date field, else the built-ins.
export function viewDatesOf(
  settings: ViewFieldSettings | undefined,
  types: readonly ItemTypeDef[],
): ViewDates {
  const dates = new Set(customOfKind(types, 'date').map((o) => o.id));
  const pick = (id: string | undefined, fallback: string) => (id && dates.has(id) ? id : fallback);
  return {
    start: pick(settings?.startField, BUILT_IN_DATES.start),
    due: pick(settings?.dueField, BUILT_IN_DATES.due),
  };
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
  return customOfKind(types, 'date').find((o) => o.id === id)?.label ?? 'date';
}
