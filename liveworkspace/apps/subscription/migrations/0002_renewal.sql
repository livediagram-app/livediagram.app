-- Renewals (liveworkspace/docs/specs/019-subscription/subscription.md "States").

-- The day of the month a subscription renews on: the day it was taken, so one taken on the 31st renews on the 28th
-- of February and the 31st of March, never sliding to the 28th for good. Rows from before take their period's day.
ALTER TABLE subscriptions ADD COLUMN anchor_day INTEGER NOT NULL DEFAULT 1 CHECK (anchor_day BETWEEN 1 AND 31);
UPDATE subscriptions SET anchor_day = CAST(strftime('%d', period_start / 1000, 'unixepoch') AS INTEGER);

-- The sweep's lapses and the mock provider's renewals each read one state's rows by when their period ended
-- (src/sweep.ts), so one index over both replaces the two partial ones.
DROP INDEX subscriptions_period;
DROP INDEX subscriptions_grace;
CREATE INDEX subscriptions_lapse ON subscriptions (state, period_end);

-- Image Storage and Walkthroughs Stored are no longer reported here: media counts them live where it enforces them,
-- and the service asks media when it shows an owner their usage (src/media-usage.ts), so nothing kept here can drift.
DROP TABLE gauge_values;
