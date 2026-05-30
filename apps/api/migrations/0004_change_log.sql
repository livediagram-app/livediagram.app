-- Per-diagram audit log. One row per undoable commit. See spec
-- specs/12-activity-and-audit.md.
--
-- before_state / after_state are JSON objects keyed by element id:
--   null  → element didn't exist on that side of the change
--   {...} → full Element snapshot
-- The pair lets the live app surgically revert one entry without
-- discarding any unrelated changes that came after.

CREATE TABLE change_log (
  id                TEXT PRIMARY KEY,
  diagram_id        TEXT NOT NULL,
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
  FOREIGN KEY (diagram_id) REFERENCES diagrams(id) ON DELETE CASCADE
);

CREATE INDEX change_log_diagram_idx ON change_log(diagram_id, created_at DESC);
CREATE INDEX change_log_tab_idx     ON change_log(tab_id);
