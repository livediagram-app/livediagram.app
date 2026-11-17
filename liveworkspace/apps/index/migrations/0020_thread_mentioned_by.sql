-- Who wrote a thread's latest comment and who mentioned each person in it (liveworkspace/docs/specs/004-index/
-- one-explorer-contracts.md "What an item pushes", blueprints/inbox.md): the Inbox names whoever mentioned the reader,
-- whoever replied after, and never reads the reader's own reply as someone else's. Both are added, so a thread pushed
-- before them reads as it did (no latest author id, nobody named) until its app pushes it again. Written by hand.
ALTER TABLE collab_threads ADD COLUMN latest_author_id TEXT NULL;
ALTER TABLE collab_threads ADD COLUMN mentioned_by TEXT NOT NULL DEFAULT '{}';
