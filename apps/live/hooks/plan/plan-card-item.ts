// The item a palette card tile makes as its Plan card lands (docs/specs/025-plan/plan-mode.md "The
// palette"): of the tile's type, titled "New task", "New bug"..., with the id the card already names.
import { itemTypeOf, type ItemWrite } from '@livediagram/items';

export function newCardItemWrite(itemId: string, type: string | undefined): ItemWrite {
  const def = itemTypeOf(type ?? 'task');
  const id = def.id === 'item' ? 'task' : def.id;
  return {
    kind: 'create',
    creates: [{ id: itemId, type: id, fields: { title: itemTypeOf(id).newTitle } }],
  };
}
