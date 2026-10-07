// The item store on the wire (docs/specs/026-plan/items.md, blueprint item-store.md "Interfaces and
// contracts"). Item shapes come from @livediagram/items; these are the request and response bodies.

import type { Item, ItemCreate, ItemMove, ItemPatch, ItemTypeCatalogue } from '@livediagram/items';

// The item shapes the api documents, re-exported so the OpenAPI generator finds them here.
export type {
  Item,
  ItemCreate,
  ItemFields,
  ItemFieldValue,
  ItemMove,
  ItemPatch,
  ItemPerson,
  ItemPlace,
  ItemTypeCatalogue,
  ItemTypeDef,
  CustomFieldDef,
  CustomFieldKind,
} from '@livediagram/items';

// GET /api/documents/:id/items[?tabId=]: the store, or the items one tab shows.
export type ItemsResponse = { items: Item[]; rev: number };

// One item as written: POST /items, PATCH /items/:itemId, POST .../move, POST .../vote.
export type ItemResponse = { item: Item; rev: number };

// What a patch or a move may add to its change: the write is an undo or redo, so a card type's left-out
// statuses do not refuse it (docs/specs/026-plan/item-types.md "An item type").
type ItemUndoFlag = {
  /** Marks an undo or redo of an earlier change: lets it restore a status the card's type leaves out. */
  undo?: true;
};

// POST /api/documents/:id/items/:itemId: the change, optionally marked as an undo or redo.
export type ItemPatchRequest = ItemPatch & ItemUndoFlag;

// POST /api/documents/:id/items/:itemId/move: the move, optionally marked as an undo or redo.
export type ItemMoveRequest = ItemMove & ItemUndoFlag;

// POST /api/documents/:id/items/bulk: template seeds and an offline document's items.
export type ItemsBulkRequest = { items: ItemCreate[] };

// POST /api/documents/:id/items/patches: up to 200 items changed in one write (a card type's or a removed column's
// cards to the Trash), optionally marked as an undo or redo.
export type ItemsPatchRequest = { items: (ItemPatch & { id: string })[] } & ItemUndoFlag;

// POST /api/documents/:id/items/:itemId/vote.
export type ItemVoteRequest = { delta: 1 | -1 };

// The room op every item write sends (system kind). `upserts` and `removed` are empty for a
// session scoped to one tab: it refetches the items its tab shows.
export type ItemsRoomOp = { kind: 'items'; upserts: Item[]; removed: string[]; rev: number };

// PUT /api/documents/:id/item-types (docs/specs/026-plan/item-types.md "Storage and sync"): the
// document's type catalogue, whole, or null to go back to the built-in types. The answer is the
// catalogue as stored.
export type ItemTypesRequest = { itemTypes: ItemTypeCatalogue | null };
export type ItemTypesResponse = { itemTypes: ItemTypeCatalogue | null };

// The room op a catalogue write sends (system kind), to every session including tab-scoped ones.
export type ItemTypesRoomOp = { kind: 'item-types'; itemTypes: ItemTypeCatalogue | null };

export const ITEM_ERRORS = ['item_not_found', 'item_exists', 'item_busy', 'items_full'] as const;
export type ItemError = (typeof ITEM_ERRORS)[number];
