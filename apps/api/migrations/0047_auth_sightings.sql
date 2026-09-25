-- Server-side sign-up / sign-in counting (spec/22, Session).
--
-- Session·SignedUp and Session·SignedIn used to be emitted by the browser on
-- the email-code paths only, so a Google sign-up or sign-in (the OAuth
-- redirect through /sso-callback) was never counted. The api worker now
-- decides both from the first time it sees a verified Clerk session:
--
--   auth_sessions  one row per Clerk session id (`sid`) ever seen. A new sid
--                  is a completed sign-in or sign-up, whatever the method.
--                  Holds no owner id, so it is not personal data; swept after
--                  90 days by the daily cron.
--   auth_accounts  one row per Clerk account ever seen. A new sid whose
--                  account is ALSO new is a sign-up (counted as SignedUp
--                  only, never also as SignedIn). Removed by deleteAccount.

CREATE TABLE auth_sessions (
  session_id    TEXT PRIMARY KEY NOT NULL,
  first_seen_at INTEGER NOT NULL
);
CREATE INDEX auth_sessions_seen_idx ON auth_sessions (first_seen_at);

CREATE TABLE auth_accounts (
  owner_id      TEXT PRIMARY KEY NOT NULL,
  first_seen_at INTEGER NOT NULL
);

-- Backfill every Clerk account the database already knows about, so an
-- existing user's first request after this ships is not read as a sign-up.
-- Clerk user ids are `user_<...>`; guests are UUIDs and never match. Accounts
-- missed here (no row anywhere) are also covered at runtime: a session whose
-- first factor was verified over an hour ago counts as neither event.
INSERT OR IGNORE INTO auth_accounts (owner_id, first_seen_at)
  SELECT owner_id, created_at FROM email_lifecycle;
INSERT OR IGNORE INTO auth_accounts (owner_id, first_seen_at)
  SELECT DISTINCT owner_id, 0 FROM diagrams WHERE owner_id LIKE 'user\_%' ESCAPE '\';
INSERT OR IGNORE INTO auth_accounts (owner_id, first_seen_at)
  SELECT DISTINCT owner_id, 0 FROM folders WHERE owner_id LIKE 'user\_%' ESCAPE '\';
INSERT OR IGNORE INTO auth_accounts (owner_id, first_seen_at)
  SELECT DISTINCT owner_id, 0 FROM user_preferences WHERE owner_id LIKE 'user\_%' ESCAPE '\';
INSERT OR IGNORE INTO auth_accounts (owner_id, first_seen_at)
  SELECT DISTINCT owner_id, 0 FROM shared_with WHERE owner_id LIKE 'user\_%' ESCAPE '\';
INSERT OR IGNORE INTO auth_accounts (owner_id, first_seen_at)
  SELECT DISTINCT owner_id, 0 FROM api_tokens WHERE owner_id LIKE 'user\_%' ESCAPE '\';
INSERT OR IGNORE INTO auth_accounts (owner_id, first_seen_at)
  SELECT DISTINCT user_id, 0 FROM team_members WHERE user_id LIKE 'user\_%' ESCAPE '\';
INSERT OR IGNORE INTO auth_accounts (owner_id, first_seen_at)
  SELECT DISTINCT id, 0 FROM participants WHERE id LIKE 'user\_%' ESCAPE '\';
