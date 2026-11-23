# Subscription: blueprint

Derived from [subscription.md](../subscription.md). The spec decides; this file only adds engineering precision, read
from the code. Paths are relative to the repository root.

This file covers the Worker (`liveworkspace/apps/subscription`), the contract (`packages/subscription`) and how
every app is wired to them. The pieces people see (`packages/subscription-ui`, the Settings category, the site's
pricing, checkout and billing pages) are not described here.

## Files

| File                                               | Role                                                                                                                                                                                                                                                                                                                                                           |
| -------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `liveworkspace/apps/subscription/src/index.ts`     | The Worker: 404 outside `/api/subscription`; 404 for everything when `PRO_ENABLED` is off; `/internal/*` (no CORS); `OPTIONS`; `/mock/*`; the browser routes; the cron                                                                                                                                                                                         |
| `.../src/config.ts`                                | The Worker's own constants (below)                                                                                                                                                                                                                                                                                                                             |
| `.../src/env.ts`                                   | `Env`, `appKey`, `subscriptionEnabled`, `environmentOf`, `accountsUrl`, `siteOrigin`, `audiences`                                                                                                                                                                                                                                                              |
| `.../src/http.ts`                                  | `json`, `refusal` (each error's status), `readObject` (a capped JSON body), `withCors`, `preflight`                                                                                                                                                                                                                                                            |
| `.../src/origins.ts`                               | `isKnownOrigin` (the site and every app, per environment), `safeReturnTo`                                                                                                                                                                                                                                                                                      |
| `.../src/account.ts`                               | `callerOf`: the account behind an access token, checked offline (`createPersonVerifier`); `bearerOf`                                                                                                                                                                                                                                                           |
| `.../src/currency.ts`                              | `currencyOf`: `request.cf.country`, or `?currency=` outside production                                                                                                                                                                                                                                                                                         |
| `.../src/rate.ts`                                  | `withinBudget`, `networkKey` over `SUBSCRIPTION_RATE_LIMITER`                                                                                                                                                                                                                                                                                                  |
| `.../src/seats.ts`                                 | `teamMembers`: a team's joined members, from accounts (`readTeamPeople`), remembered 30 seconds; `teamsMembers`: several teams' at once (`readTeamMemberCounts`), one call; `teamMemberNow` and `teamAdminNow`: whether an account is a joined member (or admin) now, never remembered; `accountName`: the name accounts shows for an account (`readProfiles`) |
| `.../src/team-requests.ts`                         | Ask an Admin: `recordTeamRequest` (one a member, team and UTC day), `clearTeamRequests`, `teamRequestStatements` and `teamRequestsFrom` (`/me`'s two reads, in its one batch)                                                                                                                                                                                  |
| `.../src/team-billing.ts`                          | `teamBillingRefusal`: the refusal for someone who may not change a team's billing now, or for accounts not saying                                                                                                                                                                                                                                              |
| `.../src/media-usage.ts`                           | `mediaUsage`: what media holds for several owners, in one call; `withMediaUsage`                                                                                                                                                                                                                                                                               |
| `.../src/internal-routes.ts`                       | `handleInternal`, `callerApp` (the app's key, in constant time), the four internal routes                                                                                                                                                                                                                                                                      |
| `.../src/browser-routes.ts`                        | `handleBrowser`: `/prices`, `/me`, `/owner`, `/checkout`, `/portal`, `/team-request`, `/ended/dismiss`                                                                                                                                                                                                                                                         |
| `.../src/subscriptions/state.ts`                   | `SubscriptionRow`, `liveUntil`, `stateAt` (the row AND the clock), `isLive`, `endedAt` (when it stopped giving its paid tier, swept or not), `changed` (every state change), `renewedTo` (the mock's renewal), `subscribed`, `seatsOf`                                                                                                                         |
| `.../src/subscriptions/store.ts`                   | `readSubscription`, `subscriptionsOf`, `writeSubscriptionStatement`, `applyChange` (a guarded write), `dismissEnded`                                                                                                                                                                                                                                           |
| `.../src/subscriptions/entitlement.ts`             | `tierAt`, `entitlementAt`, `summaryAt` (with `endedAt` and `endedTier` for 30 days after a paid tier ends)                                                                                                                                                                                                                                                     |
| `.../src/meters/limits.ts`                         | `LIVE_AT` (`liveUntil` in SQL), `ENTITLED_LIMIT`: the SQL clause that works out an owner's limit inside the statement that enforces it; `limitBinds`                                                                                                                                                                                                           |
| `.../src/meters/spend.ts`                          | `spend`: one statement                                                                                                                                                                                                                                                                                                                                         |
| `.../src/meters/gauges.ts`                         | `addToGauge`, `removeFromGauge`: one batch each                                                                                                                                                                                                                                                                                                                |
| `.../src/meters/item-usage.ts`                     | `countItem`: an item's standing count, a growing one refused past the owner's total                                                                                                                                                                                                                                                                            |
| `.../src/meters/usage.ts`                          | `readOwners`: several owners' rows and usage in one batch                                                                                                                                                                                                                                                                                                      |
| `.../src/billing/provider.ts`                      | `BillingProvider` (`startCheckout`, `openPortal`), `billingProvider(env)`: Stripe when configured, else the mock outside production, else none; `providerName`, `isMock`, `isStripe`                                                                                                                                                                           |
| `.../src/billing/mock.ts`                          | The mock provider: its two session tables, `sessionId`                                                                                                                                                                                                                                                                                                         |
| `.../src/billing/mock-routes.ts`                   | `handleMock`: the mock checkout and portal                                                                                                                                                                                                                                                                                                                     |
| `.../src/billing/stripe/config.ts`                 | `stripeConfig`: the key, webhook secret, both Prices and the portal configuration, or null; `tierOfPrice`                                                                                                                                                                                                                                                      |
| `.../src/billing/stripe/api.ts`                    | `stripeApi`: the Stripe calls over `fetch`, form-encoded, pinned to `STRIPE_API_VERSION`; `StripeError`; the object shapes read                                                                                                                                                                                                                                |
| `.../src/billing/stripe/provider.ts`               | `stripeProvider`: Checkout with Managed Payments (one open checkout an owner, the last expired), the portal; `setStripeSeats`                                                                                                                                                                                                                                  |
| `.../src/billing/stripe/sync.ts`                   | `rowFromStripe` (pure: Stripe's subscription to the owner's row, the state table) and `syncSubscription` (read from Stripe, write, cancel a duplicate)                                                                                                                                                                                                         |
| `.../src/billing/stripe/customers.ts`              | `stripe_customers`: each owner's customer and open checkout                                                                                                                                                                                                                                                                                                    |
| `.../src/billing/stripe/signature.ts`              | `isSignedByStripe`: the `Stripe-Signature` HMAC, constant time, within 5 minutes                                                                                                                                                                                                                                                                               |
| `.../src/billing/stripe/webhook.ts`                | `handleStripeWebhook` (`POST /stripe/webhook`), `subscriptionOfEvent`; `events.ts` holds `STRIPE_EVENTS`                                                                                                                                                                                                                                                       |
| `.../scripts/stripe-setup.ts`                      | Sets up and checks a Stripe account: Products, Prices, the portal, the webhook endpoint                                                                                                                                                                                                                                                                        |
| `.../src/sweep.ts`                                 | `sweepSubscriptions` (the cron's run), `oldestMonthKept`                                                                                                                                                                                                                                                                                                       |
| `.../src/test-sqlite-d1.ts`, `.../src/test-kit.ts` | A real SQLite behind the D1 API, signed access tokens and HTTP helpers for the tests                                                                                                                                                                                                                                                                           |
| `.../migrations/0001_subscription.sql`             | The tables and indexes                                                                                                                                                                                                                                                                                                                                         |
| `.../migrations/0002_renewal.sql`                  | `anchor_day`, the `subscriptions_lapse` index in place of the two partial ones, and `gauge_values` dropped (below)                                                                                                                                                                                                                                             |
| `.../migrations/0003_ended_and_requests.sql`       | `ended_at` (filled from `updated_at` for rows already ended) and `ended_seen` on `subscriptions`; the `team_requests` table                                                                                                                                                                                                                                    |
| `packages/subscription/src/tiers.ts`               | `TIER_LIMITS`, `limitsFor(tier, seats)`, `seatsFor`, `TEAM_SEATS_MIN`, `TEAM_SEATS_MAX`, `PER_MEMBER_LIMITS`, `limitReached`, `limitLeft`                                                                                                                                                                                                                      |
| `packages/subscription/src/image-sizes.ts`         | Largest Image (one number, every tier) and `IMAGE_MAX_BYTES_ANY_TIER`, apart from the limits table so a page that only stops an oversized upload (the Explorer's gallery) carries none of it in its first load                                                                                                                                                 |
| `packages/subscription/src/prices.ts`              | `PRICES`, `currencyForCountry`, `priceList`, `formatPrice`                                                                                                                                                                                                                                                                                                     |
| `packages/subscription/src/owner.ts`               | `OwnerScope`, `personScope`, `teamScope`, `ownerScopeOf`, `parseOwnerScope`                                                                                                                                                                                                                                                                                    |
| `packages/subscription/src/periods.ts`             | `dayKey`, `monthKey`, `periodKey`, `addMonth(from, anchorDay)`, `anchorDayOf` and the day and month starts                                                                                                                                                                                                                                                     |
| `packages/subscription/src/wire.ts`                | The route path, the app header, states, meters, gauges, every request and answer shape, the errors                                                                                                                                                                                                                                                             |
| `packages/subscription/src/client.ts`              | `createSubscriptionClient`, `subscriptionClientOf(env, app)`, `SubscriptionEnv`, `limitOf`, `freeEntitlement`, `refusedByService`                                                                                                                                                                                                                              |
| `packages/subscription/src/browser.ts`             | `createSubscriptionBrowserClient`, `SubscriptionRequestError`                                                                                                                                                                                                                                                                                                  |
| `packages/subscription/src/rows.ts`                | `LIMIT_ROWS` and the formatters the comparison is drawn from                                                                                                                                                                                                                                                                                                   |
| `packages/subscription/src/flag.ts`                | `proEnabled`                                                                                                                                                                                                                                                                                                                                                   |

## Routes

All under `/api/subscription`, on `www.liveworkspace.app`, `liveworkspace.app` and `staging.liveworkspace.app`. With
`PRO_ENABLED` off every one answers `404 {"error":"not_found"}` with no CORS headers, a preflight included, and
nothing is read from the database.

Refusals are `{ "error": <code> }`:

| Code                   | Status | When                                                                                                |
| ---------------------- | ------ | --------------------------------------------------------------------------------------------------- |
| `unauthorised`         | 401    | No app key, or no account's access token (a guest's is refused)                                     |
| `bad_request`          | 400    | A body or query that cannot be read, or a `returnTo` that is not allowed                            |
| `not_found`            | 404    | No such route or session, or Pro is off                                                             |
| `not_team_admin`       | 403    | Checkout or the portal for an owner the caller does not run the billing of                          |
| `already_subscribed`   | 409    | Checkout for an owner already on a paid tier                                                        |
| `not_subscribed`       | 409    | The portal, or a change, for an owner with no subscription                                          |
| `invalid_state`        | 409    | A change the subscription's state does not allow                                                    |
| `rate_limited`         | 429    | The budget is spent                                                                                 |
| `billing_unavailable`  | 503    | `BILLING_PROVIDER` names no provider this Worker has here (the mock, in production, is none)        |
| `accounts_unavailable` | 503    | A team's billing, and accounts could not say whether the caller is its admin now (`Retry-After: 5`) |
| `method_not_allowed`   | 405    | The wrong method, with `Allow`                                                                      |
| `storage_unavailable`  | 503    | D1 is down (`Retry-After: 5`), from the shared request guard                                        |

A request body is JSON, an object, and at most 4,096 bytes.

### Internal routes

`POST` only. `Authorization: Bearer <the app's key>` and `X-Subscription-App: <app>`, where the key is the env's
`SUBSCRIPTION_KEY_<APP>` for that app, compared in constant time. No CORS. Each body names an `owner`
(`p:<accountId>` or `t:<teamId>`).

| Route                        | Body                                                                                                               | Answer                                                                            | Cost                             |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------- | -------------------------------- |
| `POST /internal/entitlement` | `{ owner }`                                                                                                        | `Entitlement`                                                                     | One primary-key read             |
| `POST /internal/spend`       | `{ owner, meter, amount }`, `amount` a whole number from 1 to 1,000                                                | `SpendResult`; `ok: false` when refused                                           | One statement                    |
| `POST /internal/gauge`       | `{ owner, gauge, op: 'add' \| 'remove', key }`, `gauge` one of `GAUGES` (`publicRoadmaps`, `publicKnowledgebases`) | `GaugeResult`; `ok: false` when an add is refused                                 | One batch of two                 |
| `POST /internal/item-count`  | `{ owner, meter, item, used, adding? }`, `meter` `rules` or `pages`                                                | `ItemCountResult`: the owner's total; `ok: false` when a growing count is refused | One statement (two when refused) |

- **Spend** is one `INSERT ... ON CONFLICT DO UPDATE ... RETURNING` whose `WITH` clause reads the owner's
  subscription, judges it against the clock and works out the limit. The row is written only while
  `used + amount <= limit`, so concurrent spends can never pass the limit, and a limit of 0 refuses everything. A
  meter with no limit (none has one today) takes every spend, and answers `limit: null` as a gauge does. Only a
  refusal makes a second read, to say what was used.
- **Gauge add** inserts the entry only while what the owner holds is under the limit, in one statement; an entry
  already there is a success that changes nothing. What an owner holds of a gauge is its entries. There is no
  reported number: Image Storage and Walkthroughs Stored are media's to count ("What media holds" below), and `set`
  is a `bad_request`.
- **Item counts** keep one row per item (`period` `all`). A count of 0 deletes the row. A growing count with `adding` is
  written only while the owner's other items plus it stay within the limit, in the same statement; any other is written
  whatever the total. Rows of a day or a month are an older meter's (Automation Runs, Email to Board, Form Responses
  were item meters before 2026-11-22): nothing reads them, and the sweep drops them.

### Browser routes

`Authorization: Bearer <account access token>`, checked offline against `${ACCOUNTS_URL}/api/auth`'s keys for any
audience in `INDEX_AUDIENCES`, through the `ACCOUNTS` binding. CORS answers the site's and every app's origins in
this environment (`@liveworkspace/sites` `appOrigins`), and any localhost origin in development; no credentials.

| Route                 | Who             | Answer                                                                                                                                                                 |
| --------------------- | --------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `GET /prices`         | Anyone          | `PricesResponse`. Currency from `request.cf.country`; `?currency=XXX` in development and staging. `Cache-Control: private, max-age=300`                                |
| `GET /me`             | An account      | `MeResponse`: the personal summary, one `TeamSubscription` per team in the token's `teams` claim (the first 50), usage per owner; a team's billing only for its admins |
| `GET /owner?scope=`   | An account      | `OwnerView`: what the caller may do, and for the owner or its team the tier and limits                                                                                 |
| `POST /checkout`      | The owner       | `RedirectResponse`. Body `{ owner, returnTo }`                                                                                                                         |
| `POST /portal`        | The owner       | `RedirectResponse`. Body `{ owner, returnTo }`                                                                                                                         |
| `POST /team-request`  | A joined member | `TeamRequestResponse` (`{ sent, askedAt }`). Body `{ owner: 't:<team>', limit?, note? }`. `Cache-Control: no-store`                                                    |
| `POST /ended/dismiss` | An account      | `{ ok: true }`. Body `{ owner }`. Writes only for the person themself or an admin of the team; anyone else is answered the same and nothing is written                 |

- **`/me`** reads every owner in one D1 batch of four statements (subscriptions, spend counters for this month, gauge
  entries counted, the sum of each item count over the owner's items) and, in the same batch, the two of
  Ask an Admin (below), and beside it asks media once for
  what every owner holds. `prices` are in the currency of the caller's own live subscription, else the visitor's.
  `provider` is `mock` where the mock may be used, else `none`.
- **A team for someone who is not its admin** (`role: 'member'` in the claim) has `currency`, `amount`, `periodEnd`
  and `graceEnds` null and its usage without `item` names (`forMember`): the tier, state, seats, limits and counts
  are a member's to see, the billing and the team's items' names are its admins'. `/me` and `/owner` read the role
  from the token's claim, which is good enough for a read.
- **A team's `members`** cost `/me` at most one call to accounts however many teams: a subscribed team's are its
  row's `seats`; every other team's (an admin's or a member's) are a remembered answer (30 seconds), and all the rest
  are asked for together in one `POST /api/account/internal/teams/member-counts` (`teamsMembers`, at most 50 teams,
  which is `ME_TEAMS_MAX`). A team accounts did not answer for (no credentials, out of reach, deleted) shows 3.
- **Back on Free.** On Free, a summary whose row stopped giving its paid tier less than `ENDED_SHOWN_MS` (30 days)
  ago and has `ended_seen = 0` carries `endedAt` (`endedAt` in `state.ts`: the row's `ended_at`, or for a row the
  sweep has not reached the moment the clock passed `liveUntil`, the same figure) and `endedTier`. `forMember`
  drops both. `/ended/dismiss` sets `ended_seen = 1` on a row that is not live; any change that lands on the row,
  a mock renewal and a new subscription set it back to 0.
- **Ask an Admin.** `/team-request` checks the body (a team scope, a limit key or null, a note of at most
  `TEAM_REQUEST_NOTE_MAX` = 500 characters or null), the budget (`account:<id>`), then asks accounts whether the
  caller is a joined member now (`teamMemberNow`: `not_team_member` 403 if not, `accounts_unavailable` 503 with
  `Retry-After: 5` if accounts cannot say), then refuses a team that is not Free (`already_subscribed`). It keeps the
  member's name as accounts lists it, never an address. One `INSERT ... ON CONFLICT DO NOTHING` on `(team, account,
day)` makes two presses one request; `sent: false` with the first `askedAt` when it was already there. `/me`
  reads, for the teams the caller is an admin of, each member's newest request of the last 30 days (the newest
  `TEAM_REQUESTS_SHOWN` = 5 a team, all counted) as `requests`, and for the teams they are a member of their own
  request today as `askedAt`; both only while the team is on Free. Paying a mock checkout deletes the team's
  requests in the same batch.
- **The name on a checkout or the portal** is a team's name, or for a person the name accounts shows for them
  (`accountName`, `POST /api/account/internal/profiles/read`), else their email, else "Your account".
- **`/owner`** action: `manage` or `upgrade` for the person themself or an admin of the team, `ask_admin` for a
  team's other members, `none` for anyone else. The team and role come from the token's `teams` claim.
  Anyone else gets `tier` and `limits` null, and no row is read: whether another person or team subscribes is not
  theirs to learn. The item's own app tells a collaborator the limits they meet.
- **Checkout and the portal** are for the person themself or an admin of the team, else `not_team_admin`.
  `returnTo` must be an absolute `http(s)` URL without credentials, at most 2,000 characters, on the site's or an
  app's origin in this environment. Each account has a budget (the rate limiter, keyed `account:<id>`).
- **A team's admin is confirmed with accounts** on both, after the claim, the `returnTo` and the budget
  (`teamBillingRefusal`, `teamAdminNow`): a joined member with the role `admin` in `POST
/api/account/internal/teams/members` at that moment. Anyone else is `not_team_admin`. No credentials, accounts out
  of reach or slow (3 seconds): `accounts_unavailable`, with `Retry-After: 5`. The answer is never remembered. A
  person's own checkout and portal ask accounts nothing.
- **A team's seats at checkout** are its joined members (`teamMembers`), never fewer than 3.

### Mock provider routes

Only while `BILLING_PROVIDER` is `mock` AND `environmentOf(env)` is not `production` (`isMock`); otherwise 404, for
every route, whatever session it names. Production, and any `ENVIRONMENT` the Worker does not know (which reads as
production), therefore has no mock checkout, no mock portal and no way to subscribe without a real provider. No
account: the session id (32 random bytes, base64url, 43 characters) is the secret. Each network has a budget (keyed
`net:<address>`), counted before anything is read.

A change to a team's subscription (`POST /mock/portal/:id`, and `pay` on a team's checkout) first asks accounts
whether the account that opened the session is still the team's admin (`teamBillingRefusal`, as above): the session
outlives a role, its holder's standing must not.

| Route                     | Answer                                                                                                  |
| ------------------------- | ------------------------------------------------------------------------------------------------------- |
| `GET /mock/checkout/:id`  | `MockCheckout`                                                                                          |
| `POST /mock/checkout/:id` | `{ action: 'pay' \| 'cancel' }`: `RedirectResponse` back to `returnTo`. The session is spent either way |
| `GET /mock/portal/:id`    | `MockPortal`                                                                                            |
| `POST /mock/portal/:id`   | `MockPortalRequest`: the `MockPortal` after the change                                                  |

Checkout sends the person to `<SITE_ORIGIN>/subscription/checkout?session=<id>` and the portal to
`<SITE_ORIGIN>/subscription/billing?session=<id>`, both pages of the site.

Paying writes the subscription `active` from now to `addMonth(now)`, with `anchor_day` the UTC day of the month it
was paid on, at the session's currency and unit amount (the visitor's at the moment the checkout was started), in one
batch with the session's deletion.

## States

`liveUntil(row)` is the moment a row stops giving its paid tier, and `stateAt(row, now)` (the stored state while
`now < liveUntil`, else `ended`) is the state every read uses, whether or not the sweep has run:

| Stored state | Live until                                                                              |
| ------------ | --------------------------------------------------------------------------------------- |
| `active`     | `period_end + RENEWAL_TOLERANCE_MS` (3 days): the provider's word on the renewal is due |
| `cancelling` | `max(period_end, grace_end)`: `period_end` exactly, unless it was cancelled past due    |
| `past_due`   | `max(period_end, grace_end)`: grace never ends Pro before the paid period does          |
| `ended`      | Never                                                                                   |

`LIVE_AT` in `src/meters/limits.ts` says the same in SQL, inside the statement that spends or adds.
`subscriptions/state.test.ts` compares the two for every state at every edge, so they cannot part.

| Portal action     | Change              | Allowed from           | Does                                                                                                          |
| ----------------- | ------------------- | ---------------------- | ------------------------------------------------------------------------------------------------------------- |
| `cancel`          | `cancel`            | `active`, `past_due`   | `cancelling`, `cancel_at_period_end = 1`; `grace_end` is kept, so one cancelled past due keeps what it had    |
| `resume`          | `resume`            | `cancelling`           | `active`, or `past_due` when `grace_end` says the renewal was never paid; `cancel_at_period_end = 0`          |
| `fail_payment`    | `payment_failed`    | `active`               | `past_due`, `grace_end = now + 7 days`                                                                        |
| `recover_payment` | `payment_recovered` | `past_due`             | `active`, `grace_end = null`; a period that ended meanwhile moves on a month from its end, on the anchor day  |
| `end_grace`       | `grace_ended`       | `past_due`             | `ended`, `grace_end = now`                                                                                    |
| `end_period`      | `period_ended`      | `active`, `cancelling` | `ended`, `period_end = now`, `grace_end = null`                                                               |
| `renew`           | `renewed`           | `active`               | `period_start = period_end`, `period_end = addMonth(period_end, anchor_day)`; only from 3 days before its end |
| `set_seats`       | `seats`             | A live team's          | `seats` from 3 to 200 (`SEATS_MAX`, the most people a team holds); more is `bad_request`                      |

Anything else is `invalid_state`. "Allowed from" is the STORED state while the row is live, so a provider's renewal
or failure that lands after the period ended (within the tolerance) is taken; before, it was judged by the clock
alone and refused, and grace could never start. A renewal reported more than 3 days before the period's end is
`invalid_state`: months never stack. `applyChange` writes only onto the row it read (same state, period end and
`updated_at`), so two changes at once cannot both land.

`addMonth(from, anchorDay)` holds the day of the month the subscription was taken on (`anchor_day`, 1 to 31) to each
month's last day: the 31st of January, the 28th of February, the 31st of March.

The mock provider renews by itself, as a real one does: the sweep moves an `active` mock subscription whose period
has ended on to the period now falls in (`renewedTo`). A real provider's subscription is renewed by the provider's
own report, and ends 3 days past its period if none comes.

## Tables

`liveworkspace-subscription` (D1), from `migrations/0001_subscription.sql`, `0002_renewal.sql` and
`0003_ended_and_requests.sql`. Every table is `WITHOUT ROWID`.

| Table                    | Key                   | Columns                                                                                                                                                                                                                                                                                        | Indexes                                                                                                                                                 |
| ------------------------ | --------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `subscriptions`          | `owner`               | `tier` (`pro`, `team`), `state`, `seats`, `currency`, `unit_amount`, `period_start`, `period_end`, `anchor_day` (1 to 31), `grace_end`, `cancel_at_period_end`, `provider`, `provider_ref`, `subscribed_by`, `seats_checked_at`, `ended_at`, `ended_seen` (0 or 1), `created_at`, `updated_at` | `subscriptions_lapse (state, period_end)`, under the sweep's lapses and renewals; `subscriptions_seats (seats_checked_at)` where a team's and not ended |
| `spend_counters`         | `owner, meter, month` | `used`, `updated_at`                                                                                                                                                                                                                                                                           | `spend_counters_month (month)`                                                                                                                          |
| `gauge_entries`          | `owner, gauge, key`   | `created_at`                                                                                                                                                                                                                                                                                   |                                                                                                                                                         |
| `item_usage`             | `owner, meter, item`  | `name`, `period`, `used`, `updated_at`                                                                                                                                                                                                                                                         | `item_usage_busiest (owner, period, meter, used)`; `item_usage_updated (updated_at)`                                                                    |
| `mock_checkout_sessions` | `id`                  | `owner`, `owner_name`, `tier`, `seats`, `currency`, `unit_amount`, `return_to`, `created_by`, `created_at`, `expires_at`                                                                                                                                                                       | `mock_checkout_sessions_expiry (expires_at)`                                                                                                            |
| `team_requests`          | `team, account, day`  | `name`, `limit_key`, `note`, `created_at`                                                                                                                                                                                                                                                      | `team_requests_created (created_at)`, under the sweep                                                                                                   |
| `mock_portal_sessions`   | `id`                  | `owner`, `owner_name`, `return_to`, `created_by`, `created_at`, `expires_at`                                                                                                                                                                                                                   | `mock_portal_sessions_expiry (expires_at)`                                                                                                              |

An owner without a `subscriptions` row is Free. Times are milliseconds. `period` is a UTC day (`2026-11-20`), a UTC
month (`2026-11`) or `all`.

## Bindings and env vars

The Worker, `liveworkspace-subscription` (`-staging`), from `liveworkspace/apps/subscription/wrangler.toml`:

| Name                                           | Kind       | Value                                                                                                                                                                                                                                                                                                                                                   |
| ---------------------------------------------- | ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `SUBSCRIPTION_DB`                              | D1         | `liveworkspace-subscription` (`-staging`)                                                                                                                                                                                                                                                                                                               |
| `ACCOUNTS`                                     | Service    | `liveworkspace-accounts` (`-staging`): the token keys and a team's members                                                                                                                                                                                                                                                                              |
| `SUBSCRIPTION_RATE_LIMITER`                    | Rate limit | 60 a minute a key; namespaces `1111` and `2111`                                                                                                                                                                                                                                                                                                         |
| `ENVIRONMENT`                                  | Var        | `production`, `staging` or `development`                                                                                                                                                                                                                                                                                                                |
| `PRO_ENABLED`                                  | Var        | `"false"` in `wrangler.toml`; `true` locally (`.dev.vars.example`)                                                                                                                                                                                                                                                                                      |
| `BILLING_PROVIDER`                             | Var        | `none` in production (the mock never runs there, whatever this says); `mock` on staging and locally                                                                                                                                                                                                                                                     |
| `MEDIA`                                        | Service    | `liveworkspace-media` (`-staging`): what each owner holds. The public route (`MEDIA_URL`) when it is absent or fails                                                                                                                                                                                                                                    |
| `MEDIA_URL`                                    | Var        | Media's API; `<SITE_ORIGIN>/api/media` when unset; `http://localhost:8792/api/media` locally                                                                                                                                                                                                                                                            |
| `SITE_ORIGIN`                                  | Var        | Where the mock pages live: the site                                                                                                                                                                                                                                                                                                                     |
| `ACCOUNTS_URL`, `INDEX_AUDIENCES`              | Vars       | As the Community's and Drive's                                                                                                                                                                                                                                                                                                                          |
| `SUBSCRIPTION_KEY_<APP>`                       | Secrets    | One per app: `LIVEDIAGRAM`, `LIVEPLANNER`, `LIVEDOCUMENTS`, `LIVEDESIGN`, `LIVEHUDDLE`, `LIVEKNOWLEDGE`, and `LIVEWORKSPACE` for media and the other platform Workers. `LIVEWORKSPACE`'s is also what this Worker shows media when it asks what owners hold                                                                                             |
| `ACCOUNTS_CLIENT_ID`, `ACCOUNTS_CLIENT_SECRET` | Secrets    | An OAuth client at accounts, for `teams/members`, `teams/member-counts` and `profiles/read`. Needed for a team's billing: without them a team's checkout, portal, billing changes and Ask an Admin answer `accounts_unavailable`, its seats are 3 or what the mock portal set, a Free team shows 3 members and a checkout names a person by their email |

Cron: `17 * * * *` (hourly). Dev port 8794, inspector 9138.

Each product's api Worker and media (with the platform's `liveworkspace.app` key) read `SubscriptionEnv`
(`packages/subscription/src/client.ts`); the index reads none, as an item's messages are spent as Automation Runs by
the app that sends them:

| Name               | Where                                                                                                                                 |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------------------- |
| `PRO_ENABLED`      | `"false"` in `[vars]` and `[env.staging.vars]`; `true` in `.dev.vars.example`                                                         |
| `SUBSCRIPTION_KEY` | A secret, the same value as the service's `SUBSCRIPTION_KEY_<APP>`; `dev-<app>-subscription-key` locally                              |
| `SUBSCRIPTION_URL` | Unset in production (the client's default); staging's in `[env.staging.vars]`; `http://localhost:8794/api/subscription` locally       |
| `SUBSCRIPTION`     | The service binding to `liveworkspace-subscription` (`-staging`). Commented out in each `wrangler.toml` until that Worker is deployed |

## Constants

From `packages/subscription` (the contract):

| Constant                        | Value      |
| ------------------------------- | ---------- |
| `TEAM_SEATS_MIN`                | 3          |
| `TEAM_SEATS_MAX`                | 200        |
| `GRACE_DAYS`, `GRACE_MS`        | 7 days     |
| `RENEWAL_TOLERANCE_DAYS`, `_MS` | 3 days     |
| `MEDIA_USAGE_OWNERS_MAX`        | 60 owners  |
| `SPEND_AMOUNT_MAX`              | 1,000      |
| `ITEM_NAME_MAX`                 | 120        |
| `GAUGE_KEY_MAX`                 | 200        |
| `ENTITLEMENT_FRESH_MS`          | 60 seconds |
| `ENTITLEMENT_STALE_MS`          | 24 hours   |
| `ENTITLEMENT_CACHE_MAX`         | 500 owners |
| `SUBSCRIPTION_CALL_TIMEOUT_MS`  | 3 seconds  |
| `SUBSCRIPTION_RETRY_MS`         | 10 seconds |

From `liveworkspace/apps/subscription/src/config.ts`:

| Constant                  | Value      | What                                                                                            |
| ------------------------- | ---------- | ----------------------------------------------------------------------------------------------- |
| `MAX_BODY_BYTES`          | 4,096      | The largest request body                                                                        |
| `RETURN_TO_MAX`           | 2,000      | The longest `returnTo`                                                                          |
| `MOCK_CHECKOUT_TTL_MS`    | 30 minutes | How long a mock checkout's link works                                                           |
| `MOCK_PORTAL_TTL_MS`      | 60 minutes | How long a mock portal's link works                                                             |
| `SEATS_MAX`               | 200        | The most seats a team's subscription holds (`TEAM_SEATS_MAX`, accounts' `MAX_MEMBERS_PER_TEAM`) |
| `MOCK_RENEWALS_PER_SWEEP` | 200        | The most mock subscriptions one sweep renews                                                    |
| `SERVICE_CALL_TIMEOUT_MS` | 3 seconds  | How long a call to accounts or to media may take                                                |
| `REPORTED_MAX`            | 1e15       | The largest reported gauge value or item count                                                  |
| `ITEM_ID_MAX`             | 200        | The longest item id                                                                             |
| `ME_TEAMS_MAX`            | 50         | The most teams `/me` answers for                                                                |
| `MEMBERS_FRESH_MS`        | 30 seconds | How long a team's member count is remembered in an isolate                                      |
| `MEMBERS_CACHE_MAX`       | 500        | The most teams' counts one isolate remembers                                                    |
| `SPEND_MONTHS_KEPT`       | 13         | Months of spend counters kept, the current one included                                         |
| `ITEM_USAGE_KEPT_MS`      | 62 days    | How long an unreported day or month count is kept                                               |
| `SEATS_CHECK_EVERY_MS`    | 24 hours   | How often a subscribed team's seats follow its members                                          |
| `SEATS_CHECKS_PER_SWEEP`  | 20         | The most teams checked in one sweep                                                             |
| `PRICES_MAX_AGE_SECONDS`  | 300        | How long a browser may keep the prices                                                          |

## The client an app's Worker holds

`subscriptionClientOf(env, app)` (`packages/subscription/src/client.ts`):

- With `PRO_ENABLED` off it makes no request: `entitlement` is `null`, and every spend and gauge is allowed.
  `limitOf(entitlement, key, legacy)` gives the legacy cap for a `null` entitlement.
- An entitlement is cached per owner for 60 seconds in the isolate (at most 500 owners).
- A call is given up on after 3 seconds.

What a call came to decides the rest. The two failures are never read as one another:

| The call                                                                                            | Entitlement                                                                                        | Spend, gauge add                                                             | Logged                                                                                      |
| --------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| **Answered**, in the shape its route gives                                                          | The answer, cached                                                                                 | The service's own answer                                                     |                                                                                             |
| **Out of reach**: no answer in 3 seconds, a failure on the way, a 5xx, a body that is not JSON      | The last answer for up to 24 hours, then Free. `confirmedEntitlement`: that answer, then `unknown` | `ok: true`, `used: 0`, `unmetered: 'unreachable'`. Nothing is counted        | No. The service is left alone 10 seconds                                                    |
| **Refused**: any 4xx (401 for a rotated key, 400, 404, 429), or a 200 that is not the route's shape | Free, and the last answer is NOT used. `confirmedEntitlement`: `unknown`                           | `ok: false`, `used: 0`, `unmetered: 'refused'`                               | `console.error`, once per 10 seconds, with the app, the route and the status, never the key |
| **No key** (Pro on, `SUBSCRIPTION_KEY` unset or empty): nothing asked                               | Free. `confirmedEntitlement`: `unknown`                                                            | `unmetered: 'no_key'`: `ok: true` with Free's limit and `used: 0`, uncounted | No                                                                                          |

- A fresh cached entitlement (under 60 seconds) is used without a call, whatever the service would say.
- `limit` in a client's own answer is the owner's last known limit, else Free's. `unmetered` is absent on the
  service's own answer, so a caller can tell a count it may show from one it may not.
- `refusedByService(result)` is true for the third row only: the caller refuses the work as "could not be checked"
  (never "limit reached", never an offer to upgrade).
- An entitlement is only taken for the owner asked about, with whole seats of 1 or more. Each limit is checked on its
  own (`limitFrom`): a number of 0 or more, `null` only for a limit some tier leaves unlimited, a boolean for
  `ownAiKey`. A key the service did not send, or sent as anything else, takes this build's own figure for that
  tier and those seats (`limitsFor`), so an app deployed before the service never reads a new limit as unlimited.

How each caller copes with a refusal by the service (`refusedByService`):

| Caller                                              | Does                                                                                                                                                                               |
| --------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| liveplanner, a rule's messages (`automation-sends`) | None is sent; the step's line reads "Webhook deliveries could not be checked, so nothing was sent"                                                                                 |
| liveplanner, an AI step (`automation-ai`)           | The step is skipped: "AI credits could not be checked, so the AI was not asked"                                                                                                    |
| liveplanner, Describe a Rule, a Plan, a Form        | 503 (`automation_ai_unavailable`, `plan_draft_unavailable`, `form_draft_unavailable`); no model asked                                                                              |
| liveplanner, publishing a roadmap                   | The request fails (500): nothing is published uncounted                                                                                                                            |
| livehuddle, the call meter                          | A join that needs a minute paid is refused 503 `calls_off` (`unconfigured`); a running call keeps going and its minute is asked for again each minute; nothing is recorded as used |
| livediagram, a photo read                           | 503 `ai_not_configured`; no model asked                                                                                                                                            |
| media                                               | Reads entitlements only: an owner reads as Free                                                                                                                                    |

## The sweep

Hourly (`17 * * * *`), `sweepSubscriptions`, and nothing when `PRO_ENABLED` is off.

First, only where the mock provider may be used (never in production): up to 200 `active` rows of the mock's whose
period has ended, oldest first, each moved on to the period now falls in (`renewedTo`), a month at a time on its
anchor day. A write lands only on the row it was worked out from (same owner, still `active`, same `period_end`).

Then one batch of seven statements, each on an index. The two that end a row change what nobody is entitled to: they
write what `stateAt` already said, and `ended_at` is the moment the clock ended it (`liveUntil`), not the sweep's.

1. `active` rows whose `period_end` is 3 days or more past become `ended` (`ended_at = period_end + 3 days`).
2. `cancelling` and `past_due` rows at or past both `period_end` and `grace_end` become `ended` (`ended_at` the
   later of the two).
3. Expired mock checkout sessions go.
4. Expired mock portal sessions go.
5. Spend counters older than 13 months go.
6. Day and month item counts not reported for 62 days go. Standing counts stay.
7. Requests for Pro for Teams 30 days old go.

Then, only with an OAuth client at accounts: the 20 subscribed teams whose seats were checked longest ago, and more
than 24 hours ago, get their seats set from their joined members. A team accounts could not answer for keeps its
seats and is asked again a day later.

## What media holds

Image Storage and Walkthroughs Stored are not kept here. `mediaUsage(env, owners)` asks media, `POST
<MEDIA_URL>/app/usage/owners` with `{ owners }` (at most 60 scopes), `X-Media-App: subscription` and `Authorization:
Bearer <SUBSCRIPTION_KEY_LIVEWORKSPACE>`, through the `MEDIA` binding and through the public route when the binding
is absent or fails. Media counts each owner's bytes and walkthroughs from its own rows in one batch
([media's blueprint](../../006-media/blueprints/media.md) "What Subscription shows"). `/me` merges the answer into each
owner's usage; an owner media holds nothing for reads 0. No key, no answer in 3 seconds or an answer that is not one:
the two figures are left out of the usage and the read still answers.

Reporting them from media was dropped for this: a report was only made after an upload, a delete and a stored
walkthrough, so a release, either sweep, a copy, a guest's merge and an account's deletion left the figure wrong,
and two reports could land out of order. A read of the rows the caps are enforced on cannot be wrong in either way.

## Seats

A team's seats are its joined members, never fewer than 3 or more than 200: at checkout, daily from the sweep, and by
`set_seats` in the mock portal (which the sweep leaves alone for 24 hours). The entitlement reads `seats` from the
row, so the hot path never asks accounts. `/me` shows a subscribed team's `members` as the `seats` billed, and a Free
team's from accounts (remembered 30 seconds, one call a read at most, for every team at once).

## Local development

`corepack pnpm dev:workspace` starts the Worker with the other services; `corepack pnpm dev:subscription` starts it
alone on 8794. Its `dev` script copies `.dev.vars.example` to `.dev.vars` when there is none and applies the
migrations to the local D1. The site's dev server forwards `/api/subscription/*` to it
(`liveworkspace/apps/site/next.config.ts`, `SUBSCRIPTION_DEV_ORIGIN`), so an app's page reaches it at
`http://localhost:3000/api/subscription` across origins, as it reaches the Community. An app's api reaches it at
`SUBSCRIPTION_URL` with its `SUBSCRIPTION_KEY` (each api's `.dev.vars.example`).

The pages read `NEXT_PUBLIC_PRO_ENABLED`, which each editor's and marketing app's `.env.example` lists, off. To see
Pro in an app locally, set it for the app's dev servers, either in the shell
(`NEXT_PUBLIC_PRO_ENABLED=true corepack pnpm dev:diagram`, and the same for `dev:workspace`) or as a line in the
app's `.env.local` (`<product>/apps/editor/.env.local`, livedesign's `apps/live/.env.local`, and
`liveworkspace/apps/site/.env.local`), then restart the dev server: Next reads it when it starts. The api and media
already read `PRO_ENABLED=true` from the `.dev.vars` their `dev` scripts copy from `.dev.vars.example`.

Every editor mounts the one `SubscriptionProvider` in the provider all five share
(`packages/workbench/src/components/providers/auth-provider.tsx`), inside its auth context, from the kit's
`/provider` subpath so the first load carries only the context. Its `account` is `checking` until the session
answers and on the workbench embed's page, where nothing is asked.

The e2e stacks (`scripts/e2e-stack/stack.mjs`, media's `scripts/e2e-media.mjs`) start their api, index and media with
`PRO_ENABLED:false` and run no subscription Worker.

## Before the first deploy

The Worker is held out of every deploy (`HELD_WORKERS` in `.github/scripts/ci-plan.mjs`), because its
`wrangler.toml` holds placeholder database ids. To release it:

1. Create `liveworkspace-subscription` and `liveworkspace-subscription-staging` (D1) and put their ids in
   `liveworkspace/apps/subscription/wrangler.toml`.
2. Set the secrets on both Workers: one `SUBSCRIPTION_KEY_<APP>` per app, and `ACCOUNTS_CLIENT_ID` and
   `ACCOUNTS_CLIENT_SECRET` (a team cannot be subscribed or its billing changed without them, and seats follow
   members with them). Set `SUBSCRIPTION_KEY` on each api, on media and on the index.
3. Remove the Worker from `HELD_WORKERS`. The deploy applies the migration, then the code.
4. Once it is deployed, uncomment the `SUBSCRIPTION` service binding in each api's, media's and the index's
   `wrangler.toml`.
5. Turn `PRO_ENABLED` on where Pro should be live: the subscription Worker, each api, media, the index, and
   `NEXT_PUBLIC_PRO_ENABLED` for the pages.

Production has no billing provider (`BILLING_PROVIDER = "none"`), and the mock cannot be turned on there: with Pro on
in production before a real provider is wired in, every owner is Free and Subscribe answers that billing is
unavailable. Deploying media with this Worker matters too: the `MEDIA` binding names `liveworkspace-media`.

The status page has no check for it yet (`liveworkspace/packages/status`): a check would read red while Pro is off.

## Tests

`liveworkspace/apps/subscription/src` (Vitest, a real SQLite behind the D1 API):

| File                                   | Covers                                                                                                                                                                                                                                                                                                                                                                                      |
| -------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `index.test.ts`                        | Every route 404 with the flag off (and nothing read), only the API's path served, 405s, the cron, CORS per environment, a D1 outage as a 503                                                                                                                                                                                                                                                |
| `internal-routes.test.ts`              | App keys; entitlement for a person and a team, pooled limits, the clock; spend at the limit, at 0, concurrently, per month; gauges; item usage; `readOwners`                                                                                                                                                                                                                                |
| `meters/spend-unlimited.test.ts`       | A spend against no limit: taken, counted, answered `limit: null`                                                                                                                                                                                                                                                                                                                            |
| `browser-routes.test.ts`               | Prices by country and the override; 401s; `/me` and `/owner` shapes, a member's view of a team, one accounts call a read, media's figures; checkout and portal permissions, the admin asked of accounts, `returnTo`, the provider failing closed, production without the mock, budgets; every Free team counted in one call; the person's name on a checkout; Ask an Admin and Back on Free |
| `billing/mock-routes.test.ts`          | The checkout (pay, cancel, expiry, a spent link), every portal action and refusal, the clock, two changes at once; no mock route in production; Renew and seats bounded; a demoted admin's session                                                                                                                                                                                          |
| `billing/stripe/units.test.ts`         | The signature, form encoding, config, each event's subscription, and every Stripe state's row                                                                                                                                                                                                                                                                                               |
| `billing/stripe/stripe-routes.test.ts` | Checkout fields, one open checkout, a paid one meanwhile, the portal, every webhook path and refusal, the sweep's seats and day-old reads                                                                                                                                                                                                                                                   |
| `subscriptions/state.test.ts`          | Every change from every state, the clock, `liveUntil` in SQL against TypeScript, the anchor day, the mock's renewal, a new row, entitlement and summary                                                                                                                                                                                                                                     |
| `sweep.test.ts`                        | Lapsed rows by the new rules, the mock's renewals (and none in production), expired sessions, old counters and item counts, seats following members                                                                                                                                                                                                                                         |
| `seats.test.ts`                        | Joined members counted, remembered, unknown when accounts cannot say                                                                                                                                                                                                                                                                                                                        |
| `origins.test.ts`                      | `returnTo` and the env readers                                                                                                                                                                                                                                                                                                                                                              |
| `schema.test.ts`                       | The tables, their checks, the second migration over rows the first left, and an index under every hot and sweep statement                                                                                                                                                                                                                                                                   |

`packages/subscription/src/*.test.ts` hold the contract to 100% of lines, branches, functions and statements
(`corepack pnpm --filter @liveworkspace/subscription test:coverage`).
