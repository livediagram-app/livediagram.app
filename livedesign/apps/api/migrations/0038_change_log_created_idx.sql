-- The daily change-log retention sweep deletes by created_at alone
-- (deleteOldChangeLogEntries: DELETE FROM change_log WHERE created_at < ?),
-- but the only index covering created_at was the composite
-- (tab_id, created_at) from 0012/0013 — useless for a leading
-- created_at predicate, so the sweep full-scanned the table once a day.
CREATE INDEX change_log_created_idx ON change_log (created_at);
