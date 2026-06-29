-- spec/64 (#5): track the one-time win-back ("you've been away for a while")
-- email so it fires at most once per quiet user. NULL = not yet sent.
ALTER TABLE email_lifecycle ADD COLUMN winback_sent_at INTEGER;
