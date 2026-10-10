-- docs/specs/014-identity/transactional-email.md §5: failed lifecycle sends per owner, so an address that
-- always fails (a deleted mailbox, a hard bounce) stops being retried after MAX_SEND_ATTEMPTS
-- (db/email-lifecycle.ts) instead of filling the oldest-first daily batch forever. A successful send, or a
-- changed address, resets the count. last_attempt_at is the last failure (ms), for diagnosis.
ALTER TABLE email_lifecycle ADD COLUMN send_attempts INTEGER NOT NULL DEFAULT 0;
ALTER TABLE email_lifecycle ADD COLUMN last_attempt_at INTEGER;
