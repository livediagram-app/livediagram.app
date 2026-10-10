-- What the Explorer's Details view shows of a document without reading a tab body
-- (docs/specs/013-workspace/explorer-details-view.md "Where the numbers come from").
--
-- One row per tab: its editor mode, element and comment counts, the byte size of its stored body,
-- and when it was written. Every tab write upserts its row in the same batch. A table of its own
-- rather than columns on `tabs`, whose columns after the `data` blob sit behind its overflow pages:
-- summing over a document's tabs here reads no body. Tabs written before this migration are
-- counted by the daily cron (apps/api/src/tab-stats-backfill.ts); this migration only creates the
-- table, so it is constant-time however large `tabs` is.
CREATE TABLE tab_stats (
  tab_id        TEXT    PRIMARY KEY REFERENCES tabs(id) ON DELETE CASCADE,
  mode          TEXT    NOT NULL,
  element_count INTEGER NOT NULL,
  comment_count INTEGER NOT NULL,
  data_bytes    INTEGER NOT NULL,
  written_at    INTEGER NOT NULL
);
