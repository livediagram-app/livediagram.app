-- The diagrams.data JSON blob was retained one release window as a
-- rollback safety net after the per-tab storage refactor (spec/13 +
-- migration 0005). The new code has been live and writing to the
-- `tabs` table; the column is now dead weight.
--
-- D1's SQLite (3.45+) supports ALTER TABLE DROP COLUMN cleanly so
-- this is a one-liner. Existing rows lose nothing else.

ALTER TABLE diagrams DROP COLUMN data;
