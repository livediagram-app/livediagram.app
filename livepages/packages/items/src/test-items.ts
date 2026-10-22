// Test helpers: a person and an item factory with sensible defaults.
import type { Item, ItemFields, ItemPerson } from './item';

export const SAM: ItemPerson = { id: 'p-sam', name: 'Sam Lee', color: '#2563eb' };
export const ALI: ItemPerson = { id: 'p-ali', name: 'Ali', color: '#dc2626' };

let n = 0;
export function item(fields: ItemFields, extra: Partial<Item> = {}): Item {
  n += 1;
  return {
    id: `item${String(n).padStart(4, '0')}`,
    type: 'task',
    key: n,
    rank: 'i',
    fields,
    rev: 1,
    createdAt: 0,
    updatedAt: 0,
    createdBy: SAM,
    updatedBy: SAM,
    ...extra,
  };
}
