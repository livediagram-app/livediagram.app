-- Drop change_log.participant_name + participant_color (item #15 /
-- docs/specs/006-diagram/tab-diagram-many-to-many.md). They were copy-on-write snapshots so the UI could render
-- "who did this" without needing the participants row to still
-- exist, but the denormalisation costs us:
--
-- 1. A rename in `participants` doesn't propagate to historical
--    change_log entries — old rows show the participant's old name
--    forever.
-- 2. Two columns of duplicate state on every audit row, the most
--    write-heavy table by entry count.
--
-- Post-migration the api joins through `participants` on read.
-- Orphaned participant ids (sign-out, account delete cascading
-- through diagrams → tabs → change_log doesn't always reach a still
-- alive participants row) fall back to "Unknown" / a muted grey on
-- the client.
--
-- Standard 12-step recreate dance again — `tab_id REFERENCES
-- tabs(id)` would let DROP COLUMN succeed in isolation, but doing
-- two recreates back-to-back is cleaner than mixing semantics.

DROP INDEX IF EXISTS change_log_tab_created_at_idx;

CREATE TABLE change_log_new (
  id             TEXT PRIMARY KEY,
  tab_id         TEXT,
  participant_id TEXT NOT NULL,
  kind           TEXT NOT NULL,
  summary        TEXT NOT NULL,
  element_ids    TEXT NOT NULL,
  before_state   TEXT NOT NULL,
  after_state    TEXT NOT NULL,
  created_at     INTEGER NOT NULL,
  FOREIGN KEY (tab_id) REFERENCES tabs(id) ON DELETE CASCADE
);

INSERT INTO change_log_new (id, tab_id, participant_id, kind, summary, element_ids, before_state, after_state, created_at)
SELECT id, tab_id, participant_id, kind, summary, element_ids, before_state, after_state, created_at
FROM change_log;

DROP TABLE change_log;
ALTER TABLE change_log_new RENAME TO change_log;

CREATE INDEX change_log_tab_created_at_idx ON change_log(tab_id, created_at DESC);
