-- docs/specs/014-identity/transactional-email.md (#4): track the one-time activation nudge ("you signed up but haven't
-- drawn anything yet") so it fires at most once per user. NULL = not yet sent.
-- Lives on email_lifecycle alongside the welcome / week-1 / week-2 stamps.
ALTER TABLE email_lifecycle ADD COLUMN activation_sent_at INTEGER;
