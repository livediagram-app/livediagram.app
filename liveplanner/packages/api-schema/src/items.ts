// The item store on the wire (docs/specs/026-plan/items.md, blueprint item-store.md "Interfaces and
// contracts"). Item shapes come from @liveplanner/items; these are the request and response bodies.

import type {
  Item,
  ItemCreate,
  ItemHistoryEntry,
  ItemMove,
  ItemPatch,
  ItemTypeCatalogue,
  ItemTypeDef,
  PlanBoardOutline,
  PlanStatusName,
} from '@liveplanner/items';

// The item shapes the api projects, re-exported so the OpenAPI generator finds them here.
export type {
  Item,
  ItemCreate,
  ItemFields,
  ItemFieldValue,
  ItemHistoryChange,
  ItemHistoryEntry,
  ItemHistoryTag,
  ItemHistoryValue,
  ItemMove,
  ItemPatch,
  ItemPerson,
  ItemPlace,
  ItemTypeCatalogue,
  ItemTypeDef,
  CustomFieldDef,
  CustomFieldKind,
  PlanBoardOutline,
  PlanBoardKind,
  PlanColumnOutline,
  PlanStatusName,
} from '@liveplanner/items';

// GET /api/projects/:id/items[?tabId=][&include=calculated]: the store, or the items one tab shows.
export type ItemsResponse = {
  items: Item[];
  rev: number;
  /** Asked for with include=calculated: each card's Calculated field values (a count, a whole percentage, a
   *  Formula's number, text, true or false or ISO day, or null), by card id then field id; only cards whose type has
   *  a Calculated field. Worked out as read, never stored. */
  calculated?: Record<string, Record<string, number | string | boolean | null>>;
};

// One item as written: POST /items, PATCH /items/:itemId, POST .../move, POST .../vote.
export type ItemResponse = { item: Item; rev: number };

// GET /api/projects/:id/items/:itemId/history (docs/specs/026-plan/items.md "History"): the card's history, newest
// first, grouped. An author is named by name and colour; `mine` marks the caller's own.
export type ItemHistoryResponse = { entries: ItemHistoryEntry[] };

// A card comment add's answer also names the comment it wrote, so the editor can point the mention email at
// the stored comment (docs/specs/012-collaboration/comment-mentions.md "The email").
export type ItemCommentAddResponse = ItemResponse & { commentId: string };

// What a patch or a move may add to its change: the write is an undo or redo, so a card type's left-out
// statuses do not refuse it (docs/specs/026-plan/item-types.md "An item type").
type ItemUndoFlag = {
  /** Marks an undo or redo of an earlier change: lets it restore a status the card's type leaves out. */
  undo?: true;
};

// POST /api/projects/:id/items/:itemId: the change, optionally marked as an undo or redo.
export type ItemPatchRequest = ItemPatch & ItemUndoFlag;

// POST /api/projects/:id/items/:itemId/move: the move, optionally marked as an undo or redo.
export type ItemMoveRequest = ItemMove & ItemUndoFlag;

// POST /api/projects/:id/items/bulk: template seeds and an offline project's items.
export type ItemsBulkRequest = { items: ItemCreate[] };

// POST /api/projects/:id/items/patches: up to 200 items changed in one write (a card type's or a removed column's
// cards to the Trash), optionally marked as an undo or redo.
export type ItemsPatchRequest = { items: (ItemPatch & { id: string })[] } & ItemUndoFlag;

// POST /api/projects/:id/items/tally: a session vote's tally, up to 200 cards, added when its host ends it. `field` is
// the Votes field it counts in (the built-in `votes` when absent, or a custom Votes field's id); a card whose type
// does not offer it takes its dots in the built-in.
export type ItemsTallyRequest = {
  items: { id: string; votes: Record<string, number> }[];
  field?: string;
};

// The room op every item write sends (system kind). `upserts` and `removed` are empty for a
// session scoped to one tab: it refetches the items its tab shows.
export type ItemsRoomOp = { kind: 'items'; upserts: Item[]; removed: string[]; rev: number };

// PUT /api/projects/:id/item-types (docs/specs/026-plan/item-types.md "Storage and sync"): the
// project's type catalogue, whole, or null to go back to the built-in types. `expectedRev` names the
// catalogue's revision the change was made to (the project's `itemTypesRev`); when it has moved on the
// write is refused, 409 `item_types_stale` with the stored catalogue and revision (ItemTypesStale), so the
// caller re-applies its change to them. Left out, the write lands whatever is stored. The answer is the
// catalogue as stored, with its new revision.
export type ItemTypesRequest = { itemTypes: ItemTypeCatalogue | null; expectedRev?: number };
export type ItemTypesResponse = { itemTypes: ItemTypeCatalogue | null; itemTypesRev: number };
export type ItemTypesStale = {
  error: 'item_types_stale';
  itemTypes: ItemTypeCatalogue | null;
  itemTypesRev: number;
};

// The room op a catalogue write sends (system kind), to every session including tab-scoped ones.
export type ItemTypesRoomOp = {
  kind: 'item-types';
  itemTypes: ItemTypeCatalogue | null;
  // Absent from an op sent before the catalogue had a revision.
  itemTypesRev?: number;
};

// GET /api/projects/:id/plan (docs/specs/026-plan/plan-agents.md "Reading the plan"): the project's Plan boards
// with their columns, the statuses they name (each once) and the card types, for agents. A tab-scoped link passes
// tabId and gets that tab's boards.
// A tab as the plan read names it (docs/specs/026-plan/plan-agents.md "Reading the plan": tabs).
export type PlanTabOutline = {
  id: string;
  name: string;
  // What the tab is (diagram, board, sheet, dashboard, form).
  kind: string;
  // Its theme, when it has one of its own.
  theme?: string;
  // A Sheet tab's sheets, in canvas order.
  sheetIds?: string[];
};

export type PlanResponse = {
  boards: PlanBoardOutline[];
  statuses: PlanStatusName[];
  types: readonly ItemTypeDef[];
  // Every tab the caller may read, in order; absent from an api older than forms for agents.
  tabs?: PlanTabOutline[];
  // The catalogue's revision, for a change of card types to name as its `expectedRev`.
  itemTypesRev: number;
};
