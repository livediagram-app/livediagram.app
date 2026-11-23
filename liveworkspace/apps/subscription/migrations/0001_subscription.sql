-- The subscription service's own database (liveworkspace/docs/specs/019-subscription/subscription.md "The
-- subscription Worker"): who is subscribed, what each owner has spent and holds, and the mock billing provider's
-- sessions. An owner is a scope as the index writes one: p:<accountId> for a person, t:<teamId> for a team.

-- One row per owner that has ever subscribed. An owner without a row is Free. The tier a row gives is worked out
-- from its state AND the clock on every read (src/subscriptions/state.ts), so a lapsed row is Free before the sweep
-- has marked it ended.
CREATE TABLE subscriptions (
  owner TEXT PRIMARY KEY,
  tier TEXT NOT NULL CHECK (tier IN ('pro', 'team')),
  state TEXT NOT NULL CHECK (state IN ('active', 'cancelling', 'past_due', 'ended')),
  -- 1 for a person. A team's joined members, never fewer than TEAM_SEATS_MIN.
  seats INTEGER NOT NULL CHECK (seats >= 1),
  -- The currency the subscription was taken in, and one seat's monthly amount in it, in whole units.
  currency TEXT NOT NULL,
  unit_amount INTEGER NOT NULL CHECK (unit_amount >= 0),
  period_start INTEGER NOT NULL,
  period_end INTEGER NOT NULL,
  -- While past_due: when grace runs out. Null otherwise.
  grace_end INTEGER,
  -- 1 while the subscription ends with its period rather than renewing.
  cancel_at_period_end INTEGER NOT NULL DEFAULT 0 CHECK (cancel_at_period_end IN (0, 1)),
  provider TEXT NOT NULL,
  provider_ref TEXT,
  -- The account that subscribed.
  subscribed_by TEXT NOT NULL,
  -- When a team's seats were last set from its joined members (or by hand in the mock portal).
  seats_checked_at INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
) WITHOUT ROWID;

-- The sweep's two lapses: a period that ended, and grace that ran out.
CREATE INDEX subscriptions_period ON subscriptions (period_end) WHERE state IN ('active', 'cancelling');
CREATE INDEX subscriptions_grace ON subscriptions (grace_end) WHERE state = 'past_due';
-- The sweep's seat check: the teams checked longest ago.
CREATE INDEX subscriptions_seats ON subscriptions (seats_checked_at) WHERE tier = 'team' AND state != 'ended';

-- Spend meters (AI Credits, Webhook Deliveries, Call Minutes): what an owner has spent in one UTC month.
CREATE TABLE spend_counters (
  owner TEXT NOT NULL,
  meter TEXT NOT NULL,
  -- 2026-11
  month TEXT NOT NULL,
  used INTEGER NOT NULL CHECK (used >= 0),
  updated_at INTEGER NOT NULL,
  PRIMARY KEY (owner, meter, month)
) WITHOUT ROWID;

-- The sweep drops months older than it keeps.
CREATE INDEX spend_counters_month ON spend_counters (month);

-- Counted gauges: one row per thing an owner holds (a published roadmap, a stored walkthrough).
CREATE TABLE gauge_entries (
  owner TEXT NOT NULL,
  gauge TEXT NOT NULL,
  key TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  PRIMARY KEY (owner, gauge, key)
) WITHOUT ROWID;

-- Reported gauges: one number an app reports for an owner (image storage, from media).
CREATE TABLE gauge_values (
  owner TEXT NOT NULL,
  gauge TEXT NOT NULL,
  value INTEGER NOT NULL CHECK (value >= 0),
  updated_at INTEGER NOT NULL,
  PRIMARY KEY (owner, gauge)
) WITHOUT ROWID;

-- Per-item counts, reported by the item's app so Subscription can show the owner's busiest item. One row per item:
-- a report for a new day or month replaces the last one's.
CREATE TABLE item_usage (
  owner TEXT NOT NULL,
  meter TEXT NOT NULL,
  item TEXT NOT NULL,
  name TEXT,
  -- 2026-11-20, 2026-11, or `all` for a standing count.
  period TEXT NOT NULL,
  used INTEGER NOT NULL CHECK (used >= 0),
  updated_at INTEGER NOT NULL,
  PRIMARY KEY (owner, meter, item)
) WITHOUT ROWID;

-- The busiest item of each meter in the current period, for one owner or several.
CREATE INDEX item_usage_busiest ON item_usage (owner, period, meter, used);
-- The sweep drops day and month counts long past.
CREATE INDEX item_usage_updated ON item_usage (updated_at);

-- The mock billing provider's checkout: the id is the secret, as a hosted checkout's link is.
CREATE TABLE mock_checkout_sessions (
  id TEXT PRIMARY KEY,
  owner TEXT NOT NULL,
  owner_name TEXT NOT NULL,
  tier TEXT NOT NULL CHECK (tier IN ('pro', 'team')),
  seats INTEGER NOT NULL CHECK (seats >= 1),
  currency TEXT NOT NULL,
  unit_amount INTEGER NOT NULL,
  return_to TEXT NOT NULL,
  created_by TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL
) WITHOUT ROWID;

CREATE INDEX mock_checkout_sessions_expiry ON mock_checkout_sessions (expires_at);

-- The mock billing portal.
CREATE TABLE mock_portal_sessions (
  id TEXT PRIMARY KEY,
  owner TEXT NOT NULL,
  owner_name TEXT NOT NULL,
  return_to TEXT NOT NULL,
  created_by TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL
) WITHOUT ROWID;

CREATE INDEX mock_portal_sessions_expiry ON mock_portal_sessions (expires_at);
