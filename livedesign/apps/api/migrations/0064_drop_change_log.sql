-- Retire the Tab Activity panel's audit log (removed, see
-- docs/specs/012-collaboration/README.md "Removed: the Activity panel"). Undo / Redo never read this table, they replay in-memory
-- snapshots, so nothing else depends on it. The daily retention sweep that
-- pruned it is gone in the same change.
--
-- Dropping the table drops its indexes too; the explicit DROP INDEX lines just
-- make the intent readable and keep a partially-applied replay idempotent.

DROP INDEX IF EXISTS change_log_created_idx;
DROP INDEX IF EXISTS change_log_tab_created_at_idx;
DROP TABLE IF EXISTS change_log;
