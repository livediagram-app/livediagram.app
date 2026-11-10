-- The sweep (liveworkspace/docs/specs/007-community/community.md "The sweep"): when the service last checked each post
-- against the index, through its app. Every existing post starts at 0, so the first runs after the deploy check them
-- all (the oldest first) and remove those whose document is gone, archived, in the Trash or someone else's.
ALTER TABLE posts ADD COLUMN checked_at INTEGER NOT NULL DEFAULT 0;

-- One app's posts checked longest ago, read a batch at a time.
CREATE INDEX idx_posts_checked ON posts (app, checked_at);
