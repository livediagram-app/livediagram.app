// Automations: the plan as a rule reads it (docs/specs/026-plan/automations.md "Conditions", "Actions"; blueprint
// automations.md "Files"). The plan's card types, columns, people, saved filters and Form tabs, gathered once by the
// caller (the api's runner, the editor's builder), and the names a run's lines give each of them. Pure.

import type { ItemPerson } from '../item';
import type { CustomFieldDef, ItemTypeDef } from '../item-types';
import type { SavedBoardFilter } from '../saved-filters';
import { customFieldOf, isBuiltInFieldId } from '../type-catalogue';
import { typeFieldLabel } from '../built-in-field-labels';

// A board's saved filter: the tab the board is on, the filter, and the board's done statuses (Due Soon leaves them
// out, as the board's chip does).
export interface AutomationSavedFilter {
  tab: string;
  filter: SavedBoardFilter;
  finished: readonly string[];
}

export interface AutomationOutline {
  types: readonly ItemTypeDef[];
  // Every status a board names, with its column name.
  statuses: readonly { status: string; name: string }[];
  // Who a card can be assigned to (plan-people.ts planPeople).
  people: readonly ItemPerson[];
  savedFilters: readonly AutomationSavedFilter[];
  // The plan's Form tabs, by id.
  formTabs: readonly string[];
  // The plan's cards by id, where the caller read them: a Link Cards step's chosen card that is gone needs attention.
  // Absent, chosen cards are not checked.
  cards?: ReadonlySet<string>;
}

// Fields every card has, whatever its type lists.
const EVERY_CARD = new Set(['title', 'status', 'flagged', 'archived']);

export const statusName = (o: AutomationOutline, status: string): string =>
  o.statuses.find((s) => s.status === status)?.name ?? status;

export const typeName = (o: AutomationOutline, id: string): string =>
  o.types.find((t) => t.id === id)?.label ?? id;

export const personOf = (o: AutomationOutline, id: string): ItemPerson | undefined =>
  o.people.find((p) => p.id === id);

// A custom field of `type`, or of any of the plan's types (a rule names fields across types).
export function fieldDefOf(
  o: AutomationOutline,
  id: string,
  type?: ItemTypeDef,
): CustomFieldDef | undefined {
  if (type) {
    const own = customFieldOf(type, id);
    if (own) return own;
  }
  for (const t of o.types) {
    const def = customFieldOf(t, id);
    if (def) return def;
  }
  return undefined;
}

// What a run's lines call a field: the custom field's label, else the built-in's name on the card's type.
export function fieldName(o: AutomationOutline, id: string, type?: ItemTypeDef): string {
  const def = fieldDefOf(o, id, type);
  if (def) return def.label;
  return typeFieldLabel(type, id);
}

// Whether the plan knows a field: a built-in, or a custom field of one of its types.
export const planHasField = (o: AutomationOutline, id: string): boolean =>
  EVERY_CARD.has(id) || isBuiltInFieldId(id) || fieldDefOf(o, id) !== undefined;

// Whether a card of `type` has the field (a condition on a field its type lacks does not hold).
export const typeHasField = (type: ItemTypeDef, id: string): boolean =>
  EVERY_CARD.has(id) || type.fields.includes(id);

// The field of `type` a value names (`{{card.field.Severity}}`), by its label, case and spaces aside.
export function fieldOfName(type: ItemTypeDef, name: string): string | undefined {
  const key = name.trim().toLowerCase();
  const custom = type.custom?.find(
    (f) => f.label.toLowerCase() === key && type.fields.includes(f.id),
  );
  if (custom) return custom.id;
  return type.fields.find(
    (id) => !customFieldOf(type, id) && typeFieldLabel(type, id).toLowerCase() === key,
  );
}
