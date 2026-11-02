-- The one migration notice to everyone moved from the old livediagram.app (src/migration-notice.ts,
-- liveworkspace/docs/specs/003-accounts/accounts.md "Emails", docs/migration.md step 8). One row per address, claimed
-- before its send so a re-run never sends it twice: `sentAt` and `messageId` once it went, `error` when a send timed
-- out and may have gone. A send that was refused outright deletes its row, so the next run tries it again.
-- Written by hand, like 0002 and 0011.
CREATE TABLE migration_notice (
  email TEXT PRIMARY KEY NOT NULL,
  claimedAt INTEGER NOT NULL,
  sentAt INTEGER,
  messageId TEXT,
  error TEXT
) WITHOUT ROWID;
