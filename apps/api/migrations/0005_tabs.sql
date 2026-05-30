-- Per-tab storage. See spec/13-per-tab-storage.md.
--
-- Before this migration tabs lived as a JSON array inside
-- diagrams.data. Every keystroke serialised every tab on every save.
-- After: each tab is its own row keyed on (id), referenced by
-- diagrams via the FK. diagrams.data stays in place for one release
-- window so a rollback can fall back to the old format; a later
-- migration drops it.
--
-- Backfill: we walk each existing diagram and explode its data JSON
-- into one row per tab. SQLite's json_each works perfectly for this.

CREATE TABLE tabs (
  id           TEXT PRIMARY KEY,
  diagram_id   TEXT NOT NULL,
  name         TEXT NOT NULL,
  order_index  INTEGER NOT NULL,
  -- JSON shape mirrors the live app's Tab type minus { id, name },
  -- which live on the row. Holds elements + per-tab metadata
  -- (theme, backgroundColor, backgroundPattern, backgroundOpacity,
  -- patternColor, templateChosen, locked).
  data         TEXT NOT NULL,
  updated_at   INTEGER NOT NULL,
  FOREIGN KEY (diagram_id) REFERENCES diagrams(id) ON DELETE CASCADE
);

CREATE INDEX tabs_diagram_idx ON tabs(diagram_id, order_index);

-- Backfill from the old diagrams.data blob. `json_each` iterates the
-- top-level tabs array; `value` gives us each tab object. We strip
-- id/name out before stashing the rest in data, since those become
-- their own columns. `key` is the array index, which doubles as
-- order_index. saved_at is reused as updated_at.
INSERT INTO tabs (id, diagram_id, name, order_index, data, updated_at)
SELECT
  json_extract(je.value, '$.id')   AS id,
  d.id                              AS diagram_id,
  json_extract(je.value, '$.name') AS name,
  je.key                            AS order_index,
  json_remove(je.value, '$.id', '$.name') AS data,
  d.saved_at                        AS updated_at
FROM diagrams d, json_each(d.data) je;
