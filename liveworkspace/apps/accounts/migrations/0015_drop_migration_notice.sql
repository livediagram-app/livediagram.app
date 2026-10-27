-- The one migration notice to everyone moved from the old livediagram.app (0014, docs/migration.md step 8) was sent
-- on 2026-10-27 and its code removed, so its table goes too: the recipients' addresses aren't kept.
DROP TABLE IF EXISTS migration_notice;
