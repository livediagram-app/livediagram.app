-- Each address's day of email codes (liveworkspace/docs/specs/003-accounts/sign-in.md "A day's codes per address"):
-- how many codes it was sent over a 24 hour window from its first. Keyed by the SHA-256 of the trimmed, lower-case
-- address, so an address nobody signed up with is never kept. Not an account's data: the hourly cron deletes windows
-- that ended. Written by hand, like 0002.
CREATE TABLE sign_in_code_limit (
  emailHash   TEXT    NOT NULL PRIMARY KEY CHECK (length(emailHash) = 64),
  -- When the window started, epoch ms.
  windowStart INTEGER NOT NULL,
  sends       INTEGER NOT NULL DEFAULT 0
);
-- The cron's sweep of ended windows, the oldest first.
CREATE INDEX sign_in_code_limit_window ON sign_in_code_limit (windowStart);
