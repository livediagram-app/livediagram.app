-- Image reference index (docs/specs/009-elements/images.md, "Reference index").
--
-- Which gallery images a tab places lives in `tabs.data`, and that stays the
-- source of truth. This is a projection of it that SQL can query without
-- reading tab bodies: the retention sweep, the usage map and share-visitor
-- image reads all read it. Every write of `tabs.data` maintains it in the
-- same batch.
--
-- Deliberately no foreign keys. A cascade from `tabs` would empty the index
-- whenever a migration rebuilds `tabs` with DROP TABLE (0049 did exactly that
-- to its FK children), and an empty index reads as "nothing is referenced".
-- A row whose tab is gone is harmless instead: every reader joins `tabs` or
-- `diagram_tabs`, and the delete paths prune them.

CREATE TABLE image_refs (
  tab_id   TEXT NOT NULL,
  image_id TEXT NOT NULL,
  PRIMARY KEY (tab_id, image_id)
) WITHOUT ROWID;

-- The sweep and the share read look up by image.
CREATE INDEX image_refs_image_idx ON image_refs (image_id);

-- One row: progress of indexing the tabs saved before this migration. The
-- daily cron advances it in rowid pages; nothing reads the index as complete
-- until `completed_at` is set. A database with no tabs yet starts complete.
CREATE TABLE image_refs_backfill (
  id           INTEGER PRIMARY KEY CHECK (id = 1),
  created_at   INTEGER NOT NULL,
  cursor       INTEGER NOT NULL DEFAULT 0,
  completed_at INTEGER
);

INSERT INTO image_refs_backfill (id, created_at, cursor, completed_at)
SELECT 1,
       CAST(strftime('%s', 'now') AS INTEGER) * 1000,
       0,
       CASE WHEN EXISTS (SELECT 1 FROM tabs) THEN NULL
            ELSE CAST(strftime('%s', 'now') AS INTEGER) * 1000 END;
