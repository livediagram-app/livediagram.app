// A linked card's own fields (docs/specs/026-plan/linked-boards.md "The link"), apart from the heal (linked-cards.ts)
// so the writes (apply.ts) can tell the heal's upkeep from a person's edit without importing the board.

// The card's link field: `<kind>/<tab id>/<element id>/<record id>`.
export const LINKED_FIELD = 'linked';
// The card's baseline: its record's stamp and its own revision when the two last agreed ("Keeping them together").
export const LINKED_AT_FIELD = 'linkedAt';
export const LINKED_REV_FIELD = 'linkedRev';
// Set on a card the link put in the Trash because its record went (deleted, or its element or tab was): the heal
// brings it back if the record does (an undo).
export const LINKED_GONE_FIELD = 'linkedGone';

// Every link field: a write touching one is the linked board keeping a card with its record, never a person's edit
// (docs/specs/026-plan/items.md "Created and Last Edited").
export const LINKED_FIELDS: readonly string[] = [
  LINKED_FIELD,
  LINKED_AT_FIELD,
  LINKED_REV_FIELD,
  LINKED_GONE_FIELD,
];
