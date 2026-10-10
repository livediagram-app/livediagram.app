-- docs/specs/014-identity/profile-and-email-notifications.md (a): throttle the "someone joined your document"
-- email to at most one per document per ~15 min, the new-comment email's rule (comment_notified_at, 0035),
-- so a run of first visits is one email, not one per visitor. The last time we emailed about a join on this
-- document. NULL = never.
ALTER TABLE documents ADD COLUMN join_notified_at INTEGER;
