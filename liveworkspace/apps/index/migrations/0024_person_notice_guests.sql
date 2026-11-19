-- The guests merged into a closed account, kept for its app notices (src/person-notices.ts; liveworkspace/docs/specs/
-- 004-index/one-explorer-contracts.md "Closing an account", Work Tracker 1241). The person purge copies the person's
-- `person_aliases` here in the batch that records their notices, before it deletes the aliases, and every notice call
-- names them (`guests`), so each app anonymises what they left as a guest as it does the account's. The rows go once
-- no notice for the person is left. Only adds a table. Written by hand.
CREATE TABLE person_notice_guests (
  person_id TEXT NOT NULL,
  guest_id  TEXT NOT NULL,
  PRIMARY KEY (person_id, guest_id)
);
