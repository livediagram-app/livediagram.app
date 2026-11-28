// Bug Triage's duplicate link (docs/specs/026-plan/session-tabs.md "Bug Triage", "The duplicate link"): the write
// Close makes when the card's type has a Card field named like a duplicate that links to the duplicate's type, and
// the write Undo makes to take it back. With no such field Close links nothing on the card; the outcome and the
// card's history keep the duplicate. Pure.
import {
  duplicateFieldOf,
  fieldCardIds,
  holdsSeveral,
  typeIn,
  type Item,
  type ItemPatch,
  type ItemTypeDef,
} from '@liveplanner/items';

// The patch that links `dup` from `item`, and the field it goes through; null when the type has no such field, the
// field already holds it, or it holds one other card already (a Close never overwrites a link someone made).
export function duplicateLink(
  item: Item,
  dup: Item,
  types: readonly ItemTypeDef[],
): { field: string; patch: ItemPatch } | null {
  const field = duplicateFieldOf(typeIn(types, item.type), dup.type);
  if (!field) return null;
  const ids = fieldCardIds(field, item.fields[field.id]);
  if (ids.includes(dup.id)) return null;
  if (holdsSeveral(field))
    return { field: field.id, patch: { set: { [field.id]: [...ids, dup.id] } } };
  return ids.length ? null : { field: field.id, patch: { set: { [field.id]: dup.id } } };
}

// The patch that takes `dupId` out of `item`'s field `fieldId` again, or null when it no longer holds it.
export function duplicateUnlink(
  item: Item,
  fieldId: string,
  dupId: string,
  types: readonly ItemTypeDef[],
): ItemPatch | null {
  const field = typeIn(types, item.type).custom?.find((c) => c.id === fieldId);
  if (!field) return null;
  const ids = fieldCardIds(field, item.fields[fieldId]);
  if (!ids.includes(dupId)) return null;
  const rest = ids.filter((id) => id !== dupId);
  return rest.length ? { set: { [fieldId]: rest } } : { clear: [fieldId] };
}
