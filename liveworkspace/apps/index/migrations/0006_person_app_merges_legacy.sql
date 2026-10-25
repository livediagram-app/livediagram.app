-- The migration's returning guests of the old livediagram.app (src/merge.ts `legacy`, docs/migration.md step 6):
-- a legacy merge may have a guest as its target, so each app is told `{into, legacy: true}` and can tell it from an
-- ordinary guest-to-account merge. 1 for a legacy merge's rows, 0 for every other (and every row before this).
ALTER TABLE person_app_merges ADD COLUMN legacy INTEGER NOT NULL DEFAULT 0;
