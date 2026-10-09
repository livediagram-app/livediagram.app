// What importing a tab's JSON export adds to a document's items (docs/specs/026-plan/items.md "Copies and
// exports"): the file's types the document lacks, and a create for each item the document does not already hold,
// in status and rank order and numbered afresh. Pure.

import type { Item, ItemCreate } from './item';
import type { ItemTypeDef } from './item-types';
import { storeAsCreates } from './store';
import { typesOf, type ItemTypeCatalogue } from './type-catalogue';

export interface TabItemsImport {
  types: ItemTypeDef[];
  creates: ItemCreate[];
  // Items the document already holds, left as they are.
  skipped: number;
}

export function planTabItemsImport(
  incoming: readonly Item[],
  incomingCatalogue: ItemTypeCatalogue | null,
  existing: ReadonlyMap<string, Item>,
  currentTypes: readonly ItemTypeDef[],
): TabItemsImport {
  const fresh = incoming.filter((it) => !existing.has(it.id));
  // Only the types a fresh item uses: a file's whole catalogue never floods the document's.
  const used = new Set(fresh.map((it) => it.type));
  const known = new Set(currentTypes.map((t) => t.id));
  const types = incomingCatalogue
    ? typesOf(incomingCatalogue).filter((t) => used.has(t.id) && !known.has(t.id))
    : [];
  // The document numbers them: a key from another document would collide.
  const creates = storeAsCreates(fresh).map(({ key: _key, ...create }) => create);
  return { types, creates, skipped: incoming.length - fresh.length };
}
