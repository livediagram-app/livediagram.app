-- Participant links (docs/specs/013-workspace/share-roles.md; blueprint "Data and persistence").
--
-- A link's access level gains a third value, `participate`. `role` keeps its two-valued CHECK and is written as
-- 'view' for a Participant link, so a worker from before this change, which reads any role it does not know as
-- edit, reads a Participant link as a Viewer and fails closed. `level` carries the real level; NULL on every row
-- written before, which reads as its `role`. Adding a column instead of rebuilding the table also leaves
-- community_posts, which cascades from share_links, untouched.
ALTER TABLE share_links ADD COLUMN level TEXT NULL
  CHECK (level IS NULL OR level IN ('view', 'participate', 'edit'));

-- A visit records the level it was granted the same way, so "Shared with you" finds the link at that level.
ALTER TABLE shared_with ADD COLUMN level TEXT NULL
  CHECK (level IS NULL OR level IN ('view', 'participate', 'edit'));

-- The room ticket of a Participant carries its adder key: the server-derived id the room stamps on the stickies
-- and text it adds, so it may later delete those and only those.
ALTER TABLE ws_tickets ADD COLUMN adder_key TEXT NULL;
