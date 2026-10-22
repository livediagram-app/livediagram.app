-- Drop diagrams.share_code. The column was a single-code field from
-- before share_links (migration 0003) introduced per-link rows for
-- multi-link sharing. The API now derives the diagram's "primary"
-- share code from share_links directly; the column has no remaining
-- readers after this release and is dropping out of every DTO.
--
-- No data migration needed — every code that mattered already lives
-- in share_links (createShareLink wrote both; deleteShareLink kept
-- the column in sync). The column simply goes away.
--
-- The unique index from migration 0002 has to go first or SQLite
-- refuses to drop the underlying column.

DROP INDEX IF EXISTS idx_diagrams_share_code;
ALTER TABLE diagrams DROP COLUMN share_code;
