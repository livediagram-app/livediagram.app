// The subscription service's own numbers (liveworkspace/docs/specs/019-subscription/blueprints/README.md
// "Constants"). The tiers, limits and prices are the contract's (@liveworkspace/subscription), never restated here.

import { SUBSCRIPTION_API_PATH, TEAM_SEATS_MAX } from '@liveworkspace/subscription';

export const API_PATH = SUBSCRIPTION_API_PATH;

const MINUTE_MS = 60 * 1000;
const DAY_MS = 24 * 60 * MINUTE_MS;

/** No request body is larger than this: every one is a few short fields. */
export const MAX_BODY_BYTES = 4096;

/** A `returnTo` longer than this is refused. */
export const RETURN_TO_MAX = 2000;

/** How long a mock checkout's link works. */
export const MOCK_CHECKOUT_TTL_MS = 30 * MINUTE_MS;
/** How long a mock billing portal's link works. */
export const MOCK_PORTAL_TTL_MS = 60 * MINUTE_MS;

/** The most seats a team's subscription holds, whatever a provider or the mock portal says: the most people accounts
 *  lets a team have (`MAX_MEMBERS_PER_TEAM`, liveworkspace/apps/accounts/src/teams/shared.ts; a test holds the two
 *  together). */
export const SEATS_MAX = TEAM_SEATS_MAX;

/** The sweep renews no more mock subscriptions than this in one run: the rest wait an hour, live meanwhile. */
export const MOCK_RENEWALS_PER_SWEEP = 200;

/** A call to accounts or to media is given up on after this long. */
export const SERVICE_CALL_TIMEOUT_MS = 3000;

/** A reported gauge value and an item's count are whole numbers no larger than this (1 PB of bytes). */
export const REPORTED_MAX = 1e15;
/** An item's id, as its app names it. */
export const ITEM_ID_MAX = 200;

/** `/me` answers for no more teams than this: the ones the token lists first. */
export const ME_TEAMS_MAX = 50;
/** A team's joined member count is asked of accounts again after this long: brief, so someone who joined a moment
 *  ago is counted on the next read, and long enough that a page's burst of reads asks once. */
export const MEMBERS_FRESH_MS = 30 * 1000;
/** One isolate remembers no more teams' member counts than this: the oldest goes first. */
export const MEMBERS_CACHE_MAX = 500;

/** The sweep keeps this many months of spend counters, the current one included. */
export const SPEND_MONTHS_KEPT = 13;
/** A subscribed team's seats are set from its joined members again after this long. */
export const SEATS_CHECK_EVERY_MS = DAY_MS;
/** The sweep checks no more teams' seats than this in one run. */
export const SEATS_CHECKS_PER_SWEEP = 20;

/** How long a browser may keep the prices it was shown. Never a shared cache: the answer follows the visitor's country. */
export const PRICES_MAX_AGE_SECONDS = 300;

/** The Stripe API version every call is pinned to: the first with Managed Payments on a Checkout Session. */
export const STRIPE_API_VERSION = '2026-04-22.dahlia';
/** A call to Stripe is given up on after this long. */
export const STRIPE_CALL_TIMEOUT_MS = 8000;
/** A webhook whose signed time is further than this from now is refused, so an old one can't be sent again. */
export const STRIPE_SIGNATURE_TOLERANCE_S = 300;
/** No webhook body is larger than this. Stripe's events for a subscription are a few kilobytes. */
export const STRIPE_WEBHOOK_MAX_BYTES = 512 * 1024;
/** How long a Stripe Checkout's link works. Stripe takes 30 minutes to a day. */
export const STRIPE_CHECKOUT_TTL_MS = 60 * MINUTE_MS;
/** A live Stripe subscription not heard of for this long is read from Stripe by the sweep. */
export const STRIPE_SYNC_EVERY_MS = DAY_MS;
/** The sweep reads no more Stripe subscriptions than this in one run. */
export const STRIPE_SYNCS_PER_SWEEP = 20;
