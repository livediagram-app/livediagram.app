-- The subscription service's own database (liveworkspace/docs/specs/019-subscription/subscription.md "The
-- subscription Worker"): who is subscribed, what each owner has spent and holds, a member's requests for Pro for
-- Teams, the mock billing provider's sessions and the Stripe provider's customers. An owner is a scope as the index writes one: p:<accountId> for a person, t:<teamId> for a team.

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
  updated_at INTEGER NOT NULL,
  -- The day of the month a subscription renews on: the day it was taken, so one taken on the 31st renews on the 28th
  -- of February and the 31st of March, never sliding to the 28th for good ("States").
  anchor_day INTEGER NOT NULL DEFAULT 1 CHECK (anchor_day BETWEEN 1 AND 31),
  -- When a subscription stopped giving its paid tier: written by whatever ends it (the sweep, with the moment the
  -- clock ended it; a provider's report, with the moment it came). Null while it is live ("You're Back on Free").
  ended_at INTEGER,
  -- 1 once the owner has dismissed "You're Back on Free". A new subscription starts it again at 0.
  ended_seen INTEGER NOT NULL DEFAULT 0 CHECK (ended_seen IN (0, 1))
) WITHOUT ROWID;

-- The sweep's lapses and the mock provider's renewals each read one state's rows by when their period ended
-- (src/sweep.ts).
CREATE INDEX subscriptions_lapse ON subscriptions (state, period_end);
-- The sweep's seat check: the teams checked longest ago.
CREATE INDEX subscriptions_seats ON subscriptions (seats_checked_at) WHERE tier = 'team' AND state != 'ended';
-- The sweep reads Stripe subscriptions it has not heard of in a day: live Stripe rows, oldest written first.
CREATE INDEX subscriptions_provider_updated ON subscriptions (provider, state, updated_at);

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

-- Counted gauges: one row per thing an owner holds (a published roadmap). What media holds (Image Storage,
-- Walkthroughs Stored) is not kept here: media counts it live where it enforces it (src/media-usage.ts).
CREATE TABLE gauge_entries (
  owner TEXT NOT NULL,
  gauge TEXT NOT NULL,
  key TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  PRIMARY KEY (owner, gauge, key)
) WITHOUT ROWID;

-- Items' standing counts (an owner's automation rules, knowledgebase pages), told by the item's app. One row per
-- item, so an owner's total is the sum over every item they own, read by the primary key's prefix.
CREATE TABLE item_usage (
  owner TEXT NOT NULL,
  meter TEXT NOT NULL,
  item TEXT NOT NULL,
  used INTEGER NOT NULL CHECK (used >= 0),
  updated_at INTEGER NOT NULL,
  PRIMARY KEY (owner, meter, item)
) WITHOUT ROWID;

-- A team member asked its admins for Pro for Teams ("Ask an Admin"): one row per member, team and UTC day, so asking
-- twice in a day is one request. The name is the member's as accounts had it when they asked, and the note is theirs
-- to the admins (at most 500 characters); no address is kept. Read by team (the primary key's prefix); the sweep
-- drops old rows by `created_at`.
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

-- The Stripe provider ("Stripe"): one Stripe customer per owner, made by its first checkout and kept, and the one
-- checkout an owner may have open. A subscription itself is the owner's row in `subscriptions` (provider `stripe`,
-- provider_ref its Stripe id).
CREATE TABLE stripe_customers (
  -- p:<accountId> or t:<teamId>
  owner TEXT PRIMARY KEY,
  -- cus_..., once a checkout has made one.
  customer TEXT,
  -- cs_...: the checkout open now, expired when another is started. Null when none is.
  open_checkout TEXT,
  open_checkout_expires INTEGER,
  updated_at INTEGER NOT NULL
) WITHOUT ROWID;
