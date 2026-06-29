-- spec/64 (#6): track the one-time "first shared link" milestone email so it
-- fires once per owner. NULL = not yet sent.
ALTER TABLE email_lifecycle ADD COLUMN first_share_sent_at INTEGER;
