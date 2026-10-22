-- Within reach replaces frecency in Explorer Home's Jump back in
-- (docs/specs/013-workspace/explorer-home.md "Jump back in"; blueprint
-- docs/specs/013-workspace/blueprints/explorer-home.md "Data and persistence").
--
-- Most used now counts use days (the person's document_opened events and real
-- edits) over the last 90 days at read time, and recent reads the last open, so
-- the frecency rank, its index, the lifetime counters and the one-off seed's
-- stamp have nothing left to serve. The index goes first: a column under an
-- index cannot be dropped.

DROP INDEX IF EXISTS document_opens_rank_idx;
ALTER TABLE document_opens DROP COLUMN frecency_key;
ALTER TABLE document_opens DROP COLUMN open_days;
ALTER TABLE document_opens DROP COLUMN first_opened_at;
ALTER TABLE timeline_scope_state DROP COLUMN frecency_seeded_at;
