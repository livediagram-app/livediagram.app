// A card type's quiet second line where types are listed (the Add a Card menu, the Card Types panel): how many fields
// it holds, and how many of them are its own ("4 fields, 1 custom").
import type { ItemTypeDef } from '@liveplanner/items';

export function typeSummary(t: Pick<ItemTypeDef, 'fields' | 'custom'>): string {
  const n = t.fields.length;
  const custom = t.custom?.length ?? 0;
  return `${n} ${n === 1 ? 'field' : 'fields'}${custom ? `, ${custom} custom` : ''}`;
}
