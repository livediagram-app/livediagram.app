-- Empty diagram clean-up (docs/specs/013-workspace/empty-diagram-cleanup.md):
-- why a diagram is in the Trash. NULL = a person deleted it; 'empty' = the
-- daily sweep moved it after 30 days with nothing on any tab. Cleared on
-- restore, so a live row is always NULL.
--
-- No backfill: every row already in the Trash was deleted by a person. No
-- index: the sweep reads live rows by saved_at, and restore/list read it off
-- rows they already have.

ALTER TABLE diagrams ADD COLUMN trash_reason TEXT NULL;
