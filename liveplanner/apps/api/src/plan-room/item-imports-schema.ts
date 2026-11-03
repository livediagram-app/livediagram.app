// A whole import's held parts (db/item-imports.ts; docs/specs/026-plan/blueprints/tracker-import.md "A whole
// import"): plan schema step 13. One row per held card, its create as read (JSON text, at most a card's fields and one
// thread, far under the 2 MB a Durable Object string may hold). A plain rowid table: its rows are large.
export const ITEM_IMPORTS_SCHEMA = `
CREATE TABLE IF NOT EXISTS item_import_parts (
  plan_id    TEXT    NOT NULL,
  import_id  TEXT    NOT NULL,
  part       INTEGER NOT NULL,
  seq        INTEGER NOT NULL,
  body       TEXT    NOT NULL,
  created_at INTEGER NOT NULL,
  PRIMARY KEY (plan_id, import_id, part, seq)
);
CREATE INDEX IF NOT EXISTS item_import_parts_age ON item_import_parts (plan_id, created_at);
`;
