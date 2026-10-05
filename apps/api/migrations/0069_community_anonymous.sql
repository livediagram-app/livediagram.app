-- Anonymous Community posts (docs/specs/025-community/community.md "Publishing"): when set, the post shows
-- "Anonymous" instead of the author's name and picture everywhere it is shown. Posts published before this
-- migration kept their name, so they stay named (0).
ALTER TABLE community_posts ADD COLUMN anonymous INTEGER NOT NULL DEFAULT 0;
