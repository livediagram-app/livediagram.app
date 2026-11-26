-- The Inbox's AI comments and read state (liveworkspace/docs/specs/004-index/inbox-reading.md, blueprint inbox.md
-- "Read state", Work Tracker 1466, Work Tracker 1472).
--
-- `collab_threads` gains `latest_agent` (the assistant's name when the latest comment is an agent's; null for a
-- person's, as every existing row is) and `ai_state` ('' for neither, 'quiet' for a thread only agents wrote in with
-- nothing asked, which the Inbox read leaves out, 'ask' while an agent's comment asking for a response is newer than
-- every person's). Every existing row reads as before: '' and null, until its app pushes the tab again.
--
-- `inbox_reads` holds each person's read rows, by the row's key (`inboxRowKey`), at the row's time when it was read
-- (0: marked unread); `inbox_read_marks` their last Mark All Read. Both are new and empty. Plain ALTER and CREATE
-- statements: D1 runs the file as one transaction.

ALTER TABLE collab_threads ADD COLUMN latest_agent TEXT;
ALTER TABLE collab_threads ADD COLUMN ai_state TEXT NOT NULL DEFAULT '' CHECK (ai_state IN ('', 'quiet', 'ask'));

CREATE TABLE inbox_reads (
  person_id TEXT    NOT NULL,
  row_key   TEXT    NOT NULL,
  at        INTEGER NOT NULL,
  read_at   INTEGER NOT NULL,
  PRIMARY KEY (person_id, row_key)
);
CREATE INDEX inbox_reads_person ON inbox_reads (person_id, read_at DESC);

CREATE TABLE inbox_read_marks (
  person_id TEXT    PRIMARY KEY,
  before    INTEGER NOT NULL
);
