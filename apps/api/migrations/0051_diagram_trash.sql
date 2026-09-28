-- Trash (docs/specs/013-workspace/trash.md): deleting a diagram stamps the
-- time here instead of removing the row; the daily cron purges a row 30 days
-- after. NULL = live.
--
-- A column rather than a separate table: every child row (tabs through
-- diagram_tabs, share links, stars, history) keeps pointing at the diagram
-- it belongs to, so a restore is clearing one value.
--
-- 0050 is taken by the image reference index (feat/image-refs); the two
-- are independent and apply in either order.

ALTER TABLE diagrams ADD COLUMN trashed_at INTEGER NULL;

-- Partial: the live rows (nearly all of them) stay out of it. Serves the
-- purge sweep ("trashed before X, oldest first") and bounds the Trash list.
CREATE INDEX diagrams_trashed_idx ON diagrams (trashed_at) WHERE trashed_at IS NOT NULL;
