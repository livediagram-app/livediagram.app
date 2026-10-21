-- Community counts that one person cannot inflate (docs/specs/025-community/community.md "Likes"; blueprint §3, §7).
-- A like and a copy remember the network they came from (a one-way hash of the caller's address range, salted with
-- the post id), so a post's like and copy counts take at most a few from any one network. Rows from before this
-- migration have none and each counts on its own, as before.
ALTER TABLE community_likes ADD COLUMN network_hash TEXT;
ALTER TABLE community_copies ADD COLUMN network_hash TEXT;

-- Featured on the home page ranks posts by likes in the last three months: read by time, not the whole table.
CREATE INDEX idx_community_likes_created ON community_likes (created_at);

-- A guest's copies follow them to their account, and an account's copies go with it: both look a copier up.
CREATE INDEX idx_community_copies_copier ON community_copies (copier_id);
