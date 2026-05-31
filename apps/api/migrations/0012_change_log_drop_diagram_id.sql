-- Drop change_log.diagram_id (item #14 / spec/17).
--
-- Every change_log entry is keyed on a tab_id today, and a tab now
-- (post migration 0011) lives in a many-to-many relationship with
-- diagrams via the diagram_tabs link table. That means "which
-- diagram does this change belong to" stops being a single-value
-- answer — the change belongs to every diagram that contains the
-- tab. Storing diagram_id on the change_log row freezes a snapshot
-- of that relationship at write time, which is the wrong place to
-- represent it.
--
-- After this migration, GET /api/diagrams/:id/log filters by
-- joining change_log → tabs → diagram_tabs on the requesting
-- diagram. Tab-scoped reads (`?tab=<tabId>`) stay one query.
--
-- SQLite supports ALTER TABLE … DROP COLUMN since 3.35, BUT
-- refuses when a FOREIGN KEY references the column. The shipped
-- 0004_change_log.sql declared `FOREIGN KEY (diagram_id)
-- REFERENCES diagrams(id) ON DELETE CASCADE`, so we use the
-- 12-step table-recreation pattern documented in the SQLite docs:
-- create the new shape, copy rows, drop the old, rename. Same
-- effect as DROP COLUMN once we're past it.

-- Drop the old indexes first so the recreation can claim their
-- names; they get re-built below at the end.
DROP INDEX IF EXISTS change_log_diagram_idx;
DROP INDEX IF EXISTS change_log_tab_idx;

CREATE TABLE change_log_new (
  id                TEXT PRIMARY KEY,
  tab_id            TEXT,
  participant_id    TEXT NOT NULL,
  participant_name  TEXT NOT NULL,
  participant_color TEXT NOT NULL,
  kind              TEXT NOT NULL,
  summary           TEXT NOT NULL,
  element_ids       TEXT NOT NULL,
  before_state      TEXT NOT NULL,
  after_state       TEXT NOT NULL,
  created_at        INTEGER NOT NULL,
  FOREIGN KEY (tab_id) REFERENCES tabs(id) ON DELETE CASCADE
);

INSERT INTO change_log_new (id, tab_id, participant_id, participant_name, participant_color, kind, summary, element_ids, before_state, after_state, created_at)
SELECT id, tab_id, participant_id, participant_name, participant_color, kind, summary, element_ids, before_state, after_state, created_at
FROM change_log;

DROP TABLE change_log;
ALTER TABLE change_log_new RENAME TO change_log;

-- "Most recent N entries for this diagram" still needs a fast
-- created_at sort. The diagram-scoped filter now goes through the
-- link table so the inner index is on (tab_id, created_at) —
-- diagram filter outside, then walk the order. Tab-scoped reads
-- pick up the same index.
CREATE INDEX change_log_tab_created_at_idx ON change_log(tab_id, created_at DESC);
