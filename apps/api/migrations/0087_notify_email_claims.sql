-- docs/specs/012-collaboration/assigned-actions.md §4 + docs/specs/012-collaboration/comment-mentions.md "The email": one row per
-- action-assigned or mention email sent. claim_key hashes the sender, document, recipient and the text the
-- email carries, so a replayed request emails nobody twice inside the dedupe window; sender_id + created_at
-- cap how many such emails one account can send an hour (db/notify-email-claims.ts). The daily cron deletes
-- rows past the dedupe window.
CREATE TABLE notify_email_claims (
  claim_key  TEXT PRIMARY KEY,
  sender_id  TEXT NOT NULL,
  created_at INTEGER NOT NULL
);

CREATE INDEX notify_email_claims_sender ON notify_email_claims (sender_id, created_at);
CREATE INDEX notify_email_claims_created ON notify_email_claims (created_at);
