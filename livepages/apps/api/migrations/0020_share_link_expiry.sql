-- Share-link expiry (docs/specs/013-workspace/share-link-expiry.md): an optional lifetime chosen at link
-- creation. `expiry` keeps the chosen duration token so Extend knows
-- what to re-apply; `expires_at` is the enforcement deadline the
-- read-side lookup filters on. Both NULL = never expires, which is
-- what every pre-existing row gets.

ALTER TABLE share_links ADD COLUMN expiry TEXT NULL;
ALTER TABLE share_links ADD COLUMN expires_at INTEGER NULL;
