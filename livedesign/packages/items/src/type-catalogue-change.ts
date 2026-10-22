// A change to a document's type catalogue (docs/specs/026-plan/item-types.md "Storage and sync") kept as the
// catalogue before and after it, so it can be made again to whatever catalogue is current: when another editor's
// change landed first (the api's `item_types_stale`), when an earlier change of one's own is still on its way, and
// when it is undone after later changes. Only the types it added, changed or deleted move; every other type stays
// as the current catalogue has it.

import {
  ITEM_TYPES_MAX,
  ITEM_TYPE_CATALOGUE_VERSION,
  typesOf,
  type ItemTypeCatalogue,
} from './type-catalogue';
import type { ItemTypeDef } from './item-types';

export type CatalogueChange = {
  before: ItemTypeCatalogue | null;
  after: ItemTypeCatalogue | null;
};

const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

// The change that puts `change` back.
export function inverseCatalogueChange(change: CatalogueChange): CatalogueChange {
  return { before: change.after, after: change.before };
}

// `change` made to `current`: exactly its `after` when `current` is what it was made to; otherwise its deleted types
// removed, its changed types replaced, and its added types placed after the type they follow in `after` (first when
// they lead it, last when that type is gone). A type the change and `current` both changed takes the change's.
export function rebaseCatalogueChange(
  current: ItemTypeCatalogue | null,
  change: CatalogueChange,
): ItemTypeCatalogue | null {
  if (same(current, change.before)) return change.after;
  const before = new Map(typesOf(change.before).map((t) => [t.id, t]));
  const afterTypes = typesOf(change.after);
  const after = new Map(afterTypes.map((t) => [t.id, t]));
  const base = typesOf(current);
  const types: ItemTypeDef[] = [];
  for (const t of base) {
    const was = before.get(t.id);
    const now = after.get(t.id);
    if (was && !now) continue;
    types.push(was && now && !same(was, now) ? now : t);
  }
  afterTypes.forEach((t, i) => {
    if (before.has(t.id) || types.some((x) => x.id === t.id)) return;
    const prev = i === 0 ? null : afterTypes[i - 1]!.id;
    const at = prev === null ? 0 : types.findIndex((x) => x.id === prev) + 1;
    types.splice(prev !== null && at === 0 ? types.length : at, 0, t);
  });
  // A catalogue keeps at least one type: a change that would leave none leaves the current one as it is.
  if (types.length === 0) return current;
  return {
    version: ITEM_TYPE_CATALOGUE_VERSION,
    types: types.slice(0, Math.max(base.length, ITEM_TYPES_MAX)),
  };
}
