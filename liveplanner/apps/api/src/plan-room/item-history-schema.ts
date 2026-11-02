// A card's history in the plan's SQLite (docs/specs/026-plan/items.md "History", blueprint item-store.md "History"):
// the plan schema's step V8 (plan-schema.ts). One row per card write that changed something a reader asks about,
// appended by the plan as it applies the write (db/item-history.ts), bounded per card there and by the daily upkeep.
// The foreign key takes a card's history with the card, and with the plan. Copies, files and offline records never
// read it, so history never travels with a card.
//
// Every statement is IF NOT EXISTS: the step runs again harmlessly, so renumbering it past another step changes
// nothing for a plan that already ran it.
export const ITEM_HISTORY_SCHEMA = `
CREATE TABLE IF NOT EXISTS item_history (
  id      INTEGER PRIMARY KEY,
  plan_id TEXT    NOT NULL,
  item_id TEXT    NOT NULL,
  at      INTEGER NOT NULL,
  by      TEXT    NOT NULL,
  tag     TEXT    NULL,
  changes TEXT    NOT NULL,
  FOREIGN KEY (plan_id, item_id) REFERENCES items (plan_id, id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS item_history_item ON item_history (plan_id, item_id, id);
`;
