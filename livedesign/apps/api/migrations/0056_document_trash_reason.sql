-- Empty document clean-up (docs/specs/013-workspace/empty-document-cleanup.md):
-- why a document is in the Trash. NULL = a person deleted it; 'empty' = the
-- daily sweep moved it after 30 days with nothing on any tab. Cleared on
-- restore, so a live row is always NULL.
--
-- No backfill: every row already in the Trash was deleted by a person. No
-- index: nothing filters on it. The daily sweep scans live rows (no index
-- orders them by saved_at, and one would cost every autosave a write to save
-- a once-a-day ~10 ms scan).

ALTER TABLE documents ADD COLUMN trash_reason TEXT NULL;
