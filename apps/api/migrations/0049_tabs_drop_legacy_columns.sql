-- Drop tabs.diagram_id + tabs.order_index (docs/specs/006-document/tab-document-many-to-many.md,
-- phase 5). Every read has gone through diagram_tabs since 0011, and the
-- diagram_id FK's ON DELETE CASCADE was a trap: deleting the diagram a tab
-- was born in destroyed the tab in every other diagram it was linked into.
--
-- SQLite can't DROP COLUMN a foreign-key column, so this is the table
-- rebuild of 0012 / 0013 with one difference that matters: `tabs` is a
-- PARENT table. With foreign keys on (D1 always has them on, and
-- defer_foreign_keys does not stop actions), DROP TABLE tabs runs an
-- implicit DELETE that cascades into diagram_tabs, change_log,
-- collab_actions and collab_threads. So every child row is parked first
-- and handed back once the new `tabs` stands under the old name.
--
-- The children's FK clauses name `tabs` as text, so they bind to the
-- rebuilt table unchanged. Tabs no diagram links are carried over as they
-- are. A child row pointing at a missing tab fails the restore's FK check,
-- which aborts the migration and halts the deploy before any worker moves.

CREATE TABLE keep_diagram_tabs AS SELECT * FROM diagram_tabs;
CREATE TABLE keep_change_log AS SELECT * FROM change_log;
CREATE TABLE keep_collab_actions AS SELECT * FROM collab_actions;
CREATE TABLE keep_collab_threads AS SELECT * FROM collab_threads;

DROP INDEX IF EXISTS tabs_diagram_idx;

CREATE TABLE tabs_new (
  id          TEXT    PRIMARY KEY,
  name        TEXT    NOT NULL,
  -- The live app's Tab minus { id, name }: elements + per-tab settings.
  data        TEXT    NOT NULL,
  updated_at  INTEGER NOT NULL
);

INSERT INTO tabs_new (id, name, data, updated_at)
SELECT id, name, data, updated_at FROM tabs;

DROP TABLE tabs;
ALTER TABLE tabs_new RENAME TO tabs;

-- The cascade emptied what referenced a tab; change_log rows with no tab
-- survived it, so clear each child before handing its rows back.
DELETE FROM diagram_tabs;
INSERT INTO diagram_tabs SELECT * FROM keep_diagram_tabs;
DELETE FROM change_log;
INSERT INTO change_log SELECT * FROM keep_change_log;
DELETE FROM collab_actions;
INSERT INTO collab_actions SELECT * FROM keep_collab_actions;
DELETE FROM collab_threads;
INSERT INTO collab_threads SELECT * FROM keep_collab_threads;

DROP TABLE keep_diagram_tabs;
DROP TABLE keep_change_log;
DROP TABLE keep_collab_actions;
DROP TABLE keep_collab_threads;
