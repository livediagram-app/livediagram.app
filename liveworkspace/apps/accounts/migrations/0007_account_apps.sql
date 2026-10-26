-- Which apps an account has used, and when each first saw it (liveworkspace/docs/specs/003-accounts/accounts.md "Sign-ups
-- and milestones per app"): an app counts a sign-up the first time it sees an account, and keeps its
-- one-time milestone emails here. Written by hand, like 0002. Goes with the account (foreign key).
CREATE TABLE account_app (
  user_id             TEXT    NOT NULL REFERENCES "user" (id) ON DELETE CASCADE,
  -- The app's site id, as @liveworkspace/sites spells it (and oauth_client_app).
  app                 TEXT    NOT NULL CHECK (app IN ('livediagram.app', 'liveplanner.app', 'livedocuments.app', 'livedesign.app')),
  first_seen_at       INTEGER NOT NULL,
  -- The app's one-time milestone emails, claimed before sending so a burst sends one: its tenth item,
  -- and its first share link.
  milestone_sent_at   INTEGER,
  first_share_sent_at INTEGER,
  PRIMARY KEY (user_id, app)
) WITHOUT ROWID;
