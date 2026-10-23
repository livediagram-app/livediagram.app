-- The onboarding series each account is sent (liveworkspace/docs/accounts.md "Onboarding emails"): one
-- series per person, whichever apps they use, sent by this Worker's cron. Written by hand, like 0002.
-- Goes with the account (foreign key).
CREATE TABLE email_lifecycle (
  user_id            TEXT    NOT NULL PRIMARY KEY REFERENCES "user" (id) ON DELETE CASCADE,
  -- When the account was made: the series' clock.
  created_at         INTEGER NOT NULL,
  -- Each stage's stamp, set when it is claimed (before sending) or skipped for someone who turned tips
  -- off; a failed send takes its stamp back.
  welcome_sent_at    INTEGER,
  week1_sent_at      INTEGER,
  week2_sent_at      INTEGER,
  activation_sent_at INTEGER,
  winback_sent_at    INTEGER,
  -- Failed sends in a row; at 3 the account leaves every due list (a dead address). A success resets it.
  send_attempts      INTEGER NOT NULL DEFAULT 0,
  last_attempt_at    INTEGER,
  -- The newest save on anything the person owns, in any app, as the apps report it: null until they
  -- first make something. The activation nudge and the win-back read it.
  active_at          INTEGER
) WITHOUT ROWID;
-- One partial index per stage, holding only the accounts still owed it, so each due list reads just those.
CREATE INDEX email_lifecycle_welcome ON email_lifecycle (created_at) WHERE welcome_sent_at IS NULL;
CREATE INDEX email_lifecycle_week1 ON email_lifecycle (created_at) WHERE week1_sent_at IS NULL;
CREATE INDEX email_lifecycle_week2 ON email_lifecycle (created_at) WHERE week2_sent_at IS NULL;
CREATE INDEX email_lifecycle_activation ON email_lifecycle (created_at)
  WHERE activation_sent_at IS NULL AND week1_sent_at IS NULL AND active_at IS NULL;
CREATE INDEX email_lifecycle_winback ON email_lifecycle (active_at) WHERE winback_sent_at IS NULL;
