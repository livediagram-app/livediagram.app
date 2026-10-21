// Duplicating a card type (docs/specs/026-plan/item-types.md "The Card Types panel"): a new type filled from
// another, named "<Name> copy" ("copy 2", "copy 3"... while taken, shortened to fit), with the same colour, glyph,
// fields, custom fields, tabs and Details name, and a fresh id. The type editor opens on it; nothing is stored
// until it is saved.
import type { ItemTypeDef } from './item-types';
import { ITEM_TYPE_LABEL_MAX, defaultNewTitle, newItemTypeId } from './type-catalogue';

// The first free "<label> copy", "<label> copy 2"... ignoring case, cut so the whole fits the label limit.
export function duplicateLabel(
  label: string,
  types: readonly Pick<ItemTypeDef, 'label'>[],
): string {
  const taken = new Set(types.map((t) => t.label.trim().toLowerCase()));
  for (let n = 1; ; n += 1) {
    const suffix = n === 1 ? ' copy' : ` copy ${n}`;
    const name = `${label
      .trim()
      .slice(0, ITEM_TYPE_LABEL_MAX - suffix.length)
      .trimEnd()}${suffix}`;
    if (!taken.has(name.toLowerCase())) return name;
  }
}

export function duplicateItemType(type: ItemTypeDef, types: readonly ItemTypeDef[]): ItemTypeDef {
  const label = duplicateLabel(type.label, types);
  return {
    ...type,
    id: newItemTypeId(label, types),
    label,
    newTitle: defaultNewTitle(label),
    fields: [...type.fields],
    ...(type.custom ? { custom: type.custom.map((f) => ({ ...f })) } : {}),
    ...(type.tabs ? { tabs: type.tabs.map((t) => ({ ...t, fields: [...t.fields] })) } : {}),
  };
}
