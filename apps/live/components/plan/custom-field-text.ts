// A custom field's value as one line of text (docs/specs/026-plan/item-types.md "An item type"): for
// a card face, and anything else that shows a value without its editor. Null when there is nothing
// to show (no value, or a value of the wrong kind, say after a field's kind changed).
import { linkText, type CustomFieldDef, type Item, type ItemFieldValue } from '@livediagram/items';
import { dayLabel } from './day-label';

const NO_ITEMS: ReadonlyMap<string, Item> = new Map();

// `items` resolves a Card field's value (a card id) to that card's title, or "Missing card"
// (docs/specs/026-plan/item-types.md "Card fields").
export function customFieldText(
  field: CustomFieldDef,
  value: ItemFieldValue | undefined,
  items: ReadonlyMap<string, Item> = NO_ITEMS,
): string | null {
  if (value === undefined || value === null || value === '') return null;
  switch (field.kind) {
    case 'checkbox':
      return value === true ? 'Yes' : value === false ? 'No' : null;
    case 'number':
      return typeof value === 'number' ? String(value) : null;
    case 'date': {
      if (typeof value !== 'string') return null;
      return dayLabel(value, 'medium');
    }
    case 'link':
      return typeof value === 'string' ? value.replace(/^https?:\/\//, '') : null;
    case 'card':
      return linkText(items, value);
    default:
      return typeof value === 'string' ? value.split('\n')[0]! : null;
  }
}
