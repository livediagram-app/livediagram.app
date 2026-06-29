-- spec/64 (#6): track the one-time diagram-count milestone email so it fires
-- once per owner (the first milestone they reach). NULL = not yet sent.
ALTER TABLE email_lifecycle ADD COLUMN milestone_sent_at INTEGER;
