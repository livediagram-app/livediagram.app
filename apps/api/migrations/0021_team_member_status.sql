-- Invite accept/decline handshake (docs/specs/013-workspace/teams.md). Membership becomes a
-- two-step: an invite row is born 'invited' and only counts as
-- membership once its owner accepts ('joined'). Declining deletes the
-- row (no column needed for that side).
--
-- Backfill: rows that already connected a user_id joined under the
-- old auto-join rules, so they're grandfathered as 'joined' (anything
-- else would silently eject existing members). Never-connected invite
-- rows (user_id IS NULL) become 'invited' — exactly the state the new
-- flow would have put them in.

ALTER TABLE team_members ADD COLUMN status TEXT NULL;

UPDATE team_members
SET status = CASE WHEN user_id IS NULL THEN 'invited' ELSE 'joined' END;
