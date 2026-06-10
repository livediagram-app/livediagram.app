-- Token-based team invites (spec/32): an unguessable token per pending
-- invite so a person can claim it from a shared link, independent of
-- the Clerk session-token `email` claim (which the auto-connect path
-- relies on and which is easy to misconfigure). NULL on joined /
-- creator rows; set when an invite is created. Indexed for the
-- claim-by-token lookup.
ALTER TABLE team_members ADD COLUMN invite_token TEXT NULL;
CREATE INDEX team_members_invite_token_idx ON team_members(invite_token);
