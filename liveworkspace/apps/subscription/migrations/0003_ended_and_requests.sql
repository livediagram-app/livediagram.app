-- Back on Free, and a member's request for Pro for Teams (liveworkspace/docs/specs/019-subscription/subscription.md
-- "You're Back on Free", "Ask an Admin").

-- When a subscription stopped giving its paid tier: written by whatever ends it (the sweep, with the moment the
-- clock ended it; a provider's report, with the moment it came). Null while it is live. Rows already ended take the
-- time they were last written.
ALTER TABLE subscriptions ADD COLUMN ended_at INTEGER;
UPDATE subscriptions SET ended_at = updated_at WHERE state = 'ended';
-- 1 once the owner has dismissed "You're Back on Free". A new subscription starts it again at 0.
ALTER TABLE subscriptions ADD COLUMN ended_seen INTEGER NOT NULL DEFAULT 0 CHECK (ended_seen IN (0, 1));

-- A team member asked its admins for Pro for Teams: one row per member, team and UTC day, so asking twice in a day
-- is one request. The name is the member's as accounts had it when they asked, and the note is theirs to the admins
-- (at most 500 characters); no address is kept. Read by team (the primary key's prefix); the sweep drops old rows by
-- `created_at`.
CREATE TABLE team_requests (
  -- t:<teamId>
  team TEXT NOT NULL,
  account TEXT NOT NULL,
  -- 2026-11-21
  day TEXT NOT NULL,
  name TEXT,
  -- The limit that prompted it (a key of the contract's limits), or null.
  limit_key TEXT,
  note TEXT,
  created_at INTEGER NOT NULL,
  PRIMARY KEY (team, account, day)
) WITHOUT ROWID;

CREATE INDEX team_requests_created ON team_requests (created_at);
