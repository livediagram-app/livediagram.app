// The fields a type can never lose (docs/specs/026-plan/item-types.md "An item type"), on their own so the catalogue
// and inheritance (type-inheritance.ts) both read them.
import type { ItemFieldId } from './item-types';

// Every type offers these, first, and they cannot be removed.
export const REQUIRED_TYPE_FIELDS: readonly ItemFieldId[] = ['title', 'status'];

// What a particular type always offers besides (docs/specs/026-plan/item-types.md "An item type"): a Project
// is drawn on the Gantt chart from its Start and Due, so it always has both. They can move, never come off.
export const TYPE_REQUIRED_FIELDS: Readonly<Record<string, readonly ItemFieldId[]>> = {
  project: ['start', 'due'],
};

// Every field a type can never lose: Title and Status, then the type's own.
export function requiredFieldsOf(typeId: string | undefined): readonly string[] {
  const own = typeId ? TYPE_REQUIRED_FIELDS[typeId] : undefined;
  return own ? [...REQUIRED_TYPE_FIELDS, ...own] : REQUIRED_TYPE_FIELDS;
}
