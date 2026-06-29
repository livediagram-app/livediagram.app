-- spec/64 (#1): throttle the immediate "new comment" email to at most one per
-- diagram per ~15 min, so a burst of comments doesn't spam the owner. Stores the
-- last time we emailed about a comment on this diagram. NULL = never.
ALTER TABLE diagrams ADD COLUMN comment_notified_at INTEGER;
