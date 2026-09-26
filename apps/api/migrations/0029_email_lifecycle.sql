-- docs/specs/014-identity/transactional-email.md: transactional & lifecycle email (Resend).
-- One row per AUTHENTICATED owner (Clerk user id), created on the first
-- request we see them when email is enabled. Drives the welcome + the
-- week-1 / week-2 onboarding series (the *_sent_at stamps make each send
-- idempotent). Rows are removed by deleteAccount (db/account.ts).
CREATE TABLE IF NOT EXISTS email_lifecycle (
  owner_id        TEXT PRIMARY KEY,
  email           TEXT NOT NULL,
  created_at      INTEGER NOT NULL,
  welcome_sent_at INTEGER,
  week1_sent_at   INTEGER,
  week2_sent_at   INTEGER
);

-- The cron series-sender scans by age, so index the timestamp it filters on.
CREATE INDEX IF NOT EXISTS idx_email_lifecycle_due ON email_lifecycle (created_at);
