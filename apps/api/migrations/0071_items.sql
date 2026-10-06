-- Items: a document's item store (docs/specs/026-plan/items.md, blueprint item-store.md
-- "Data and persistence"). Items are framed by Plan boards and Plan cards on the canvas
-- but stored apart from tabs. `fields` is an open JSON bag, never a column per field, so
-- the table holds any kind of item, not only tickets.
CREATE TABLE items (
  document_id TEXT NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  id TEXT NOT NULL,
  type TEXT NOT NULL,
  item_key INTEGER NOT NULL,
  rank TEXT NOT NULL,
  fields TEXT NOT NULL,
  rev INTEGER NOT NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  created_by TEXT NOT NULL,
  updated_by TEXT NOT NULL,
  PRIMARY KEY (document_id, id)
);

-- The number people say out loud ("#12") is unique per document and never reused.
CREATE UNIQUE INDEX items_document_key ON items(document_id, item_key);

-- The store's revision (raised on every item write, carried by the room op) and the
-- next item key to hand out.
ALTER TABLE documents ADD COLUMN items_rev INTEGER NOT NULL DEFAULT 0;
ALTER TABLE documents ADD COLUMN items_next_key INTEGER NOT NULL DEFAULT 1;
