-- The Stripe provider (liveworkspace/docs/specs/019-subscription/subscription.md "Stripe"): one Stripe customer per
-- owner, made by its first checkout and kept, and the one checkout an owner may have open. A subscription itself is
-- the owner's row in `subscriptions` (provider `stripe`, provider_ref its Stripe id).
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

-- The sweep reads Stripe subscriptions it has not heard of in a day: live Stripe rows, oldest written first.
CREATE INDEX subscriptions_provider_updated ON subscriptions (provider, state, updated_at);
