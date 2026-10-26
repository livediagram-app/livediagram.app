-- Signing in on an app's own address (liveworkspace/docs/specs/003-accounts/accounts.md "Signing in on the app's own address"): the
-- one-time token the sign-in pages hand the browser so the session made there is set on liveworkspace.app too. Only
-- the token's hash is kept, with the session it carries, the hash of the nonce cookie the starting browser holds, the
-- app address it goes back to, and when it stops working (60 seconds). Spent once (usedAt); rows go a minute after
-- they expire. Written by hand, like 0002.
CREATE TABLE sign_in_handoff (
  tokenHash TEXT PRIMARY KEY,
  sessionId TEXT NOT NULL REFERENCES session (id) ON DELETE CASCADE,
  userId TEXT NOT NULL,
  bindHash TEXT NOT NULL,
  returnUrl TEXT NOT NULL,
  expiresAt INTEGER NOT NULL,
  usedAt INTEGER
);
CREATE INDEX sign_in_handoff_expires ON sign_in_handoff (expiresAt);
