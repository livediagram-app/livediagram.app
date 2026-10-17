-- Team invites: decline from the email, reminders, and expiry (docs/specs/013-workspace/teams.md
-- "Declining from the email" and "Reminders and expiry").
--
-- `status` gains two rejected values, 'declined' and 'expired' (TEXT, no CHECK, so no column change).
--
-- decline_token_hashes: the SHA-256 hashes (hex) of the decline tokens the invite's emails carry, space-separated,
-- at most four (the invite plus three reminders). Only hashes: the token itself lives only in the email.
-- reminder1/2/3_sent_at: each reminder's stamp, 0 = skipped. reminder_attempts: failed reminder sends in a row.
-- clock_started_at: when the invite's reminder and expiry clock started (ms). A new invite sets it to its
-- created_at; an invite already pending here starts it now, at the deploy.
ALTER TABLE team_members ADD COLUMN decline_token_hashes TEXT;
ALTER TABLE team_members ADD COLUMN reminder1_sent_at INTEGER;
ALTER TABLE team_members ADD COLUMN reminder2_sent_at INTEGER;
ALTER TABLE team_members ADD COLUMN reminder3_sent_at INTEGER;
ALTER TABLE team_members ADD COLUMN reminder_attempts INTEGER NOT NULL DEFAULT 0;
ALTER TABLE team_members ADD COLUMN clock_started_at INTEGER;

-- Invites already pending were sent before reminders existed: their clock starts at this deploy, so they get the
-- full reminder series and expire 28 days from now, and none is rejected on the first run.
UPDATE team_members
   SET clock_started_at = CAST(strftime('%s', 'now') AS INTEGER) * 1000
 WHERE status = 'invited';

-- The daily sweep's reads (expiry + the three reminder stages) only ever look at pending invites by clock.
CREATE INDEX IF NOT EXISTS team_members_pending_idx ON team_members (clock_started_at)
  WHERE status = 'invited';
