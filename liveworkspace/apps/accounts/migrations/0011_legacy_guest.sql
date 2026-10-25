-- Returning guests of the old livediagram.app (liveworkspace/docs/accounts.md "Returning guests of the old
-- livediagram.app", docs/migration.md step 6): one row per migrated guest, written by the migrate tool, never by
-- this Worker. `id` is `guest_<old uuid>`, the owner their copied work is under; `firstSeenAt` is when the old site
-- first saw them (epoch ms), which decides whether an unsigned id may be claimed; `claimedAt` and `claimedBy` are
-- stamped once the guest has been merged into whoever claimed it. Every read and write is by the primary key.
-- Written by hand, like 0002.
CREATE TABLE legacy_guest (
  id TEXT PRIMARY KEY,
  firstSeenAt INTEGER NOT NULL,
  claimedAt INTEGER,
  claimedBy TEXT
);
