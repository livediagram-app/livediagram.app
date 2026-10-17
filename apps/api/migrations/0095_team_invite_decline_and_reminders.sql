-- Team invites: decline from the email, reminders, and expiry (docs/specs/013-workspace/teams.md
-- "Declining from the email" and "Reminders and expiry").
--
-- `status` gains two rejected values, 'declined' and 'expired' (TEXT, no CHECK, so no column change).
--
-- decline_token_hashes: the SHA-256 hashes (hex) of the decline tokens the invite's emails carry, space-separated,
-- at most four (the invite plus three reminders). Only hashes: the token itself lives only in the email.
-- reminder1/2/3_sent_at: each reminder's stamp, 0 = skipped. reminder_attempts: failed reminder sends in a row.
ALTER TABLE team_members ADD COLUMN decline_token_hashes TEXT;
ALTER TABLE team_members ADD COLUMN reminder1_sent_at INTEGER;
ALTER TABLE team_members ADD COLUMN reminder2_sent_at INTEGER;
ALTER TABLE team_members ADD COLUMN reminder3_sent_at INTEGER;
ALTER TABLE team_members ADD COLUMN reminder_attempts INTEGER NOT NULL DEFAULT 0;

-- The daily sweep's reads (expiry + the three reminder stages) only ever look at pending invites by age.
CREATE INDEX IF NOT EXISTS team_members_pending_idx ON team_members (created_at)
  WHERE status = 'invited';

-- Invites already pending were sent before reminders existed: never remind them (the 28-day expiry still applies).
UPDATE team_members
   SET reminder1_sent_at = 0, reminder2_sent_at = 0, reminder3_sent_at = 0
 WHERE status = 'invited';
