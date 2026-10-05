// A custom field's value as one line of text (docs/specs/026-plan/item-types.md "An item type"): for
// a card face, and anything else that shows a value without its editor. Null when there is nothing
// to show (no value, or a value of the wrong kind, say after a field's kind changed).
import type { CustomFieldDef, ItemFieldValue } from '@livediagram/items';

export function customFieldText(
  field: CustomFieldDef,
  value: ItemFieldValue | undefined,
): string | null {
  if (value === undefined || value === null || value === '') return null;
  switch (field.kind) {
    case 'checkbox':
      return value === true ? 'Yes' : value === false ? 'No' : null;
    case 'number':
      return typeof value === 'number' ? String(value) : null;
    case 'date': {
      if (typeof value !== 'string') return null;
      const d = new Date(`${value}T00:00:00`);
      return Number.isNaN(d.getTime())
        ? value
        : d.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
    }
    case 'link':
      return typeof value === 'string' ? value.replace(/^https?:\/\//, '') : null;
    default:
      return typeof value === 'string' ? value.split('\n')[0]! : null;
  }
}
