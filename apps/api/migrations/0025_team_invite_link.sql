-- Shareable team invite link (spec/32): an admin can actively turn on
-- a per-team join link that expires after a week. Anyone signed in who
-- opens the link can Join the team as a member. Distinct from the
-- per-address email invites (team_members rows) — this is one
-- regenerable token on the team itself, with its own expiry. NULL token
-- = the link is off. Indexed for the token -> team lookup on join.
ALTER TABLE teams ADD COLUMN invite_link_token TEXT NULL;
ALTER TABLE teams ADD COLUMN invite_link_expires_at INTEGER NULL;
CREATE INDEX teams_invite_link_token_idx ON teams(invite_link_token);
