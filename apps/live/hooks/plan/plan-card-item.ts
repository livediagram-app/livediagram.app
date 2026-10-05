// The item a palette card tile makes as its Plan card lands (docs/specs/025-plan/plan-mode.md "The
// palette"): of the tile's type, titled "New task", "New bug"..., with the id the card already names.
// A type the document's catalogue lacks makes a Task (the first type, when Task is gone too).
import { ITEM_TYPES, type ItemTypeDef, type ItemWrite } from '@livediagram/items';

export function newCardItemWrite(
  itemId: string,
  type: string | undefined,
  types: readonly ItemTypeDef[] = ITEM_TYPES,
): ItemWrite {
  const def =
    types.find((t) => t.id === type) ??
    types.find((t) => t.id === 'task') ??
    types[0] ??
    ITEM_TYPES[0];
  return {
    kind: 'create',
    creates: [{ id: itemId, type: def.id, fields: { title: def.newTitle } }],
  };
}
