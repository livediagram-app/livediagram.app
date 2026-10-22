-- A diagram is private by default. Sharing produces a short share code
-- that goes into the share URL `/live?s=<code>`; the owner's URL
-- (`/live?d=<id>`) stays the same and remains private to them. Realtime
-- (Durable Object room + presence) is only active while `shareable = 1`,
-- so unshared diagrams skip the WebSocket entirely.
--
-- `share_code` is nullable: NULL means "never shared". Revoking sets it
-- back to NULL; re-sharing mints a new code, so old URLs are invalid.
ALTER TABLE diagrams ADD COLUMN share_code TEXT;
ALTER TABLE diagrams ADD COLUMN shareable INTEGER NOT NULL DEFAULT 0;
CREATE UNIQUE INDEX idx_diagrams_share_code ON diagrams (share_code)
WHERE share_code IS NOT NULL;
