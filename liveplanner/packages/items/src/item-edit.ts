// Which writes are an edit (docs/specs/026-plan/items.md "Created and Last Edited"): only an edit stamps a card's Last
// Edited At and Last Edited By (apply.ts).
import { STATUS_SINCE_FIELD, type Item, type ItemFields } from './item';
import { LINKED_FIELDS } from './linked-fields';

// Scalars by identity (a long description never serialised); only lists and objects (a person, a checklist, rich
// text) by their JSON.
const sameValue = (a: unknown, b: unknown) =>
  a === b ||
  (typeof a === 'object' &&
    typeof b === 'object' &&
    a !== null &&
    b !== null &&
    JSON.stringify(a) === JSON.stringify(b));

// Whether a write is an edit, so stamps Last Edited: one that changes the card's fields or type. A write touching a
// link field is the linked board's upkeep, and one that changes nothing (a move within its column, a value set to
// what it was) is no edit; the status stamp alone is not a change (the move it marks is).
export function isItemEdit(
  before: Item,
  fields: ItemFields,
  type: string,
  touched: Iterable<string>,
): boolean {
  const keys = new Set(touched);
  for (const k of keys) if (LINKED_FIELDS.includes(k)) return false;
  if (type !== before.type) return true;
  keys.add('status');
  for (const k of keys) {
    if (k === STATUS_SINCE_FIELD) continue;
    if (!sameValue(before.fields[k], fields[k])) return true;
  }
  return false;
}
