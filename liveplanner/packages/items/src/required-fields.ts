// Required custom fields (docs/specs/026-plan/item-types.md "Required fields"): which fields a type requires, and
// whether a card's fields leave one empty. One check for every door: the api, the offline store, the editor's New
// {Type} dialog, Import CSV, forms' publish check and the agent verbs.
import type { ItemFields, ItemFieldValue } from './item';
import type { CustomFieldDef, CustomFieldKind, ItemTypeDef } from './item-types';

// Every kind but a Checkbox, which reads unticked as empty, so a required one could never be left unticked, a
// Calculated field, which nobody fills in (item-types.md "Calculated fields"), and an Image, which is added once the
// card exists (item-types.md "Image fields").
export const canBeRequired = (kind: CustomFieldKind): boolean =>
  kind !== 'checkbox' && kind !== 'calculated' && kind !== 'image';

// The required custom fields `type` still offers, in its order: one taken off the type is not enforced.
export function requiredCustomFieldsOf(
  type: Pick<ItemTypeDef, 'fields' | 'custom'>,
): CustomFieldDef[] {
  return (type.custom ?? []).filter(
    (f) => f.required === true && canBeRequired(f.kind) && type.fields.includes(f.id),
  );
}

// No value: absent, null, a text that trims empty, or an empty list (a Multiple Choice with nothing picked).
export function isEmptyFieldValue(v: ItemFieldValue | undefined): boolean {
  if (v === undefined || v === null) return true;
  if (typeof v === 'string') return v.trim() === '';
  return Array.isArray(v) && v.length === 0;
}

// The required fields `fields` leaves empty, in the type's order.
export function missingRequiredFields(
  type: Pick<ItemTypeDef, 'fields' | 'custom'>,
  fields: Readonly<ItemFields>,
): CustomFieldDef[] {
  return requiredCustomFieldsOf(type).filter((f) => isEmptyFieldValue(fields[f.id]));
}

// The first required field `before` has a value for and `after` leaves empty: emptying a value is refused, while a
// card that was already empty (made before the field was required) is left alone.
export function requiredCleared(
  type: Pick<ItemTypeDef, 'fields' | 'custom'>,
  before: Readonly<ItemFields>,
  after: Readonly<ItemFields>,
): CustomFieldDef | undefined {
  return requiredCustomFieldsOf(type).find(
    (f) => !isEmptyFieldValue(before[f.id]) && isEmptyFieldValue(after[f.id]),
  );
}

// The required field that setting `key` to `value` would empty, when the card has a value there now: the card panel
// asks before it saves, so it can name the field.
export function requiredFieldEmptied(
  type: Pick<ItemTypeDef, 'fields' | 'custom'>,
  fields: Readonly<ItemFields>,
  key: string,
  value: ItemFieldValue | undefined,
): CustomFieldDef | undefined {
  if (!isEmptyFieldValue(value) || isEmptyFieldValue(fields[key])) return undefined;
  return requiredCustomFieldsOf(type).find((f) => f.id === key);
}

// "Bug cards need Severity", "... Severity and Area", "... Severity, Area and Owner".
export function requiredFieldsMessage(
  type: Pick<ItemTypeDef, 'label'>,
  missing: readonly Pick<CustomFieldDef, 'label'>[],
): string {
  const names = missing.map((f) => f.label);
  const list =
    names.length <= 1 ? (names[0] ?? '') : `${names.slice(0, -1).join(', ')} and ${names.at(-1)}`;
  return `${type.label} cards need ${list}`;
}
