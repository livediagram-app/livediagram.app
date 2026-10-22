-- Folders. See docs/specs/013-workspace/folders.md.
--
-- Each diagram belongs to at most one folder (folder_id IS NULL → the
-- conceptual "Unsorted" bucket). Folders nest via self-referential
-- parent_id; both FKs use ON DELETE SET NULL so deleting a folder
-- promotes its direct children rather than cascading. Cycle
-- prevention on the folders tree lives in the API layer (D1 can't
-- enforce it declaratively).

CREATE TABLE folders (
  id          TEXT PRIMARY KEY,
  owner_id    TEXT NOT NULL,
  parent_id   TEXT NULL,
  name        TEXT NOT NULL,
  created_at  INTEGER NOT NULL,
  updated_at  INTEGER NOT NULL,
  FOREIGN KEY (parent_id) REFERENCES folders(id) ON DELETE SET NULL
);

CREATE INDEX folders_owner_idx ON folders(owner_id);
CREATE INDEX folders_parent_idx ON folders(parent_id);

-- Diagrams reference folders via a nullable column. SQLite doesn't
-- support adding a column with a REFERENCES clause via ALTER, so the
-- FK is declared but unenforced at the schema level — the app keeps
-- referential integrity via the API.
ALTER TABLE diagrams ADD COLUMN folder_id TEXT NULL;

CREATE INDEX diagrams_folder_idx ON diagrams(folder_id);
