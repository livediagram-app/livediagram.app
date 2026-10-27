# Accounts: blueprint

Derived from [sign-in.md](../sign-in.md), [accounts.md](../accounts.md) and [email.md](../email.md). The spec
decides; this file only adds engineering precision, read from the code. Defaults applied where the spec is silent are
ledgered in [DEFAULTS.md](DEFAULTS.md) and cited as `ACCn`. Paths are relative to the repository root.

This file holds the Worker as a whole: routing, its doors and who may use each, the crons, closing an account, the
outboxes to the index and telemetry, configuration, logs and tests. Each feature has its own file:

| Feature                                                     | Blueprint                                            |
| ----------------------------------------------------------- | ---------------------------------------------------- |
| Email codes, Google, Turnstile, the app-address hand-off    | [sign-in.md](sign-in.md)                             |
| Sessions, guests, the workspace token, bearers, guest merge | [sessions-and-guests.md](sessions-and-guests.md)     |
| Teams, invitations, the join link, the change feed          | [teams.md](teams.md)                                 |
| API tokens and their expiry                                 | [tokens.md](tokens.md)                               |
| The OAuth provider, clients, ID token claims, device grant  | [oauth.md](oauth.md)                                 |
| Settings and profiles                                       | [settings-and-profiles.md](settings-and-profiles.md) |
| Every email, the onboarding series, notification support    | [email.md](email.md)                                 |

Workbench pairings, tickets and sessions run in this Worker too; they are blueprinted in
[011-workbench](../../011-workbench/blueprints/workbench.md).

## Domain and naming

| Term         | Identifier                                                                                 | Meaning                                                          |
| ------------ | ------------------------------------------------------------------------------------------ | ---------------------------------------------------------------- |
| Account      | `user` row, id `user_<32 hex>` (`newUserId`); any `^user_[A-Za-z0-9]{1,64}$` (`USER_ID`)   | A person; the prefix kept from Clerk, so imported ids never move |
| Guest        | `guest_<v4 uuid>` (`GUEST_ID`), cookie `lw_guest`                                          | One guest identity across every app                              |
| Session      | Better Auth `session`                                                                      | Signed in on liveworkspace.app                                   |
| Access token | a JWT from `/api/auth/oauth2/token`, keys at `/api/auth/jwks`                              | What an app's server and the services check offline              |
| API token    | `lwt_…` (`API_TOKEN_PREFIX`), legacy `lvd_…`                                               | One per integration, on every app's API and MCP                  |
| Team         | `team`, `team_member`                                                                      | Made on liveworkspace.app, the same in every app                 |
| Client       | an OAuth client, one per app (`oauth_client_app`)                                          | Registered with `POST /api/auth/internal/clients`                |
| App          | `SettingsApp`: `livediagram.app`, `liveplanner.app`, `livedocuments.app`, `livedesign.app` | The site id the account data is keyed by                         |

## Behaviour and state

### Routing (`index.ts`), in order

1. No `BETTER_AUTH_SECRET`: every request `503 { error: 'not_configured' }` (logged). Shorter than 32 characters,
   `getAuth` throws.
2. `GET`: `/api/auth/sign-in-options`; `/api/auth/guest` (first `GUEST_LIMITER` keyed `ip:<network>`, `429 {
error: 'rate_limited' }`); `/api/auth/workspace-token`; `/api/auth/end-session` (the browser's hop); the two
   discovery documents at the root.
3. `/api/account` and below: `handleAccountApi`; after it, the request's telemetry events and Timeline events are
   flushed in `waitUntil`.
4. `POST /api/auth/internal/clients`; `POST /api/auth/internal/bench-accounts`; `POST /api/auth/delete-account`;
   `POST /api/auth/end-session` (an app's Worker).
5. Anything else under `/api/auth`: the code routes are limited first (below), then Better Auth's handler (for
   Google on an app's address, an instance built for that origin; before `POST /sign-out` and Security's `revoke-*`, every
   app's tokens on the sessions they end are deleted, `endSessionTokensOf`), then three rewrites of the answer: `GET
/get-session` gains the presence colour; `GET /oauth2/authorize` may move the sign-in page to the app's address,
   and may merge a guest into a session already there. Welcomes queued by a sign-up go after the answer.
6. Else `404 Not found`.

Better Auth is built once per isolate (`getAuth`, keyed by the `env` object), and once per app origin for Google on
app addresses (`getGoogleAuthFor`, at most a dozen).

### The account API's doors (`account-api.ts`), in order

| Path                                  | Door                                                                                                   | Blueprint                                                    |
| ------------------------------------- | ------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------ |
| `/api/account/internal/*`             | an app's client credentials (`Basic`), checked by introspection, cached 5 min per isolate (≤ 100 keys) | by route                                                     |
| `/api/account/workbench/*`            | an API token, a ticket, a workbench session or the owner                                               | [011-workbench](../../011-workbench/blueprints/workbench.md) |
| `POST /api/account/index/teams`       | `Bearer INDEX_MERGE_KEY`                                                                               | [teams.md](teams.md)                                         |
| anything with `Authorization: Bearer` | an access or guest token for an app API (`bearer.ts`)                                                  | [sessions-and-guests.md](sessions-and-guests.md)             |
| the rest                              | the session cookie; writes must carry `Origin` equal to `BASE_URL` (`403 cross_origin`)                | by route                                                     |

Every account API answer is JSON with `cache-control: no-store`; a refusal is `{ error: <code> }`. A body that won't
parse is read as `{}`.

### The crons (`scheduled`)

Each step runs in `step()`: a throw logs `[accounts] cron step failed: <name>` and the run goes on.

| Cron           | Steps, in order                                                                                                                                                                               |
| -------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `*/15 * * * *` | 1. `index purges`: up to 25 `pending_purges` rows sent again. 2. `timeline`: the outbox trimmed to 5,000, then up to 10 calls of 100 events. 3. `lifecycle`: welcomes only.                   |
| `17 9 * * *`   | The same three (the lifecycle runs every stage), then 4. `invitation sweep`; 5. the token expiry emails, then the token Timeline notes (and a flush), then `server events`; 6. `idle guests`. |

Details: [teams.md](teams.md), [tokens.md](tokens.md), [email.md](email.md),
[sessions-and-guests.md](sessions-and-guests.md).

### Closing an account (`POST /api/auth/delete-account`), in order

1. Client credentials (`Basic`) and `{ token }`, the person's access token: missing either is `400
invalid_request`.
2. Introspection with those credentials: a wrong secret `401 invalid_client`; a token inactive, without a `sub`, or
   minted for another client `401 invalid_token`.
3. `leaveAllTeams` ([teams.md](teams.md)): teams run alone close; a sole admin's role passes to the longest-standing
   member; their address comes off every row.
4. Settings, then the profile, deleted.
5. `recordPendingPurge(userId, closedTeams)`, before the user goes.
6. Better Auth deletes the user: sessions, linked accounts, OAuth tokens, consents, API tokens, `account_app`,
   `email_lifecycle` cascade.
7. `purgeFromIndex`: `POST ${INDEX_URL}/internal/purge-person { personId, teamIds }` with `INDEX_MERGE_KEY`, 15 s;
   taken clears the row, else `attempts + 1` and the cron retries (logged as an error from the third try).
8. `closeAccountWorkbench`, then `DELETE https://drive/app/people/<id>` with `DRIVE_KEY_ACCOUNTS` in `waitUntil` (10
   s; `404` is done; nothing retried).
9. `200 { deleted: true }`.

### Telemetry (`telemetry.ts`)

`reportServerEvent(env, category, action, type, app)` holds up to 1,000 events per isolate (none without
`TELEMETRY_URL`); a flush resolves each event's app (a function is looked up only then), groups by app, and posts
`POST ${TELEMETRY_URL}/events { app, events (≤ 100) }` with `X-Telemetry-Key: TELEMETRY_KEY_<APP>`, 2 s, through the
`TELEMETRY` binding. An app with no key, or an event with no app, is dropped. Events: `Team·Created|Changed|Deleted|
Shared(Link)|Removed(Link|Self|Invite|Member)|Added(Member)|Changed(Role)|Joined|Declined(Invite|Email)`,
`Token·Created(Manual)|Removed`, `Email·Sent·<kind>`.

## Interfaces and contracts

| Path                                                                                                                                                                                                                                    | Blueprint                                                    |
| --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------ |
| `GET /api/auth/sign-in-options`, `POST /api/auth/email-otp/send-verification-otp`, `POST /api/auth/sign-in/email-otp`, `/api/auth/sign-in/social`, `/api/auth/callback/google`, `POST /api/auth/handoff/start`, `GET /api/auth/handoff` | [sign-in.md](sign-in.md)                                     |
| `GET /api/auth/get-session`, `GET /api/auth/guest`, `GET /api/auth/workspace-token`, `POST`/`GET /api/auth/end-session`, `POST /api/auth/sign-out`, `POST /api/account/internal/legacy-guests/claim`, `GET /api/account/people`         | [sessions-and-guests.md](sessions-and-guests.md)             |
| `/api/account/teams…`, `/api/account/invitations…`, `/api/account/join/:token`, `/api/account/internal/{teams,teams/of,teams/members,teams/changes,invitations}`, `POST /api/account/index/teams`                                       | [teams.md](teams.md)                                         |
| `/api/account/tokens…`, `/api/account/internal/tokens{,/verify,/revoke,/live}`, `POST /api/auth/internal/bench-accounts`                                                                                                                | [tokens.md](tokens.md)                                       |
| `/api/auth/oauth2/*`, `/api/auth/jwks`, `/.well-known/*`, `POST /api/auth/internal/clients`, an app's `/oauth/device*`                                                                                                                  | [oauth.md](oauth.md)                                         |
| `/api/account/settings…`, `/api/account/profile`, `/api/account/internal/{settings/read,settings/write,profiles/read,profiles/write}`                                                                                                   | [settings-and-profiles.md](settings-and-profiles.md)         |
| `/api/account/internal/{sightings,milestones/claim,activity,emails,settings/notify}`                                                                                                                                                    | [email.md](email.md)                                         |
| `POST /api/auth/delete-account`                                                                                                                                                                                                         | this file                                                    |
| `/api/account/workbench/*`, `/api/account/internal/workbench/*`, `/api/account/internal/allowance`                                                                                                                                      | [011-workbench](../../011-workbench/blueprints/workbench.md) |

## Errors and edge cases

| Case                        | Answer                                                  |
| --------------------------- | ------------------------------------------------------- |
| No secret                   | `503 not_configured` on every route                     |
| A write from another origin | `403 cross_origin`                                      |
| No session                  | `401 signed_out`                                        |
| Wrong client credentials    | `401 invalid_client`                                    |
| The index down when closing | the account closes; the purge waits in `pending_purges` |
| Drive down when closing     | logged, not retried                                     |
| A cron step throws          | logged; later steps run                                 |

## Security and trust

- Sessions are SameSite=Lax cookies; every session write also checks `Origin`.
- Every key and secret is compared with `sameSecret` (both SHA-256 hashed, then `timingSafeEqual`).
- An app's client credentials reach only its own app's data where the data is per app (settings, sightings,
  milestones, notify switches, legacy guests); the client's app comes from `oauth_client_app`, never the request.
- Secrets (not in `[vars]`): `BETTER_AUTH_SECRET`, `TURNSTILE_SECRET_KEY`, `ADMIN_TOKEN`, `GOOGLE_CLIENT_ID`,
  `GOOGLE_CLIENT_SECRET`, `INDEX_MERGE_KEY`, `DRIVE_KEY_ACCOUNTS`, `TELEMETRY_KEY_<APP>`, `LEGACY_GUEST_ID_HMAC_SECRET`.

## Performance and limits

Lists are bounded: 50 teams an account, 200 members a team, 20 live API tokens, 100 ids a profile, email or notify
read, 16,384 bytes of settings a row, 500 rows a change-feed page. Every cron sweep takes a bounded batch (25 purges,
10 x 100 Timeline events, 100 accounts a lifecycle stage, 500 expiries and 100 reminders a stage, 100 token
warnings and 500 notes, 500 idle guests). Measured numbers are in [sign-in.md "Performance"](../sign-in.md#performance).

## Observability

Every log line the service writes, by its fingerprint (the first literal of the call; `…` marks an interpolation):

| Level   | Fingerprint                                         | Where                             |
| ------- | --------------------------------------------------- | --------------------------------- |
| `error` | `Guest hand-off failed:`                            | `guests.ts`                       |
| `error` | `Guest merge failed:`                               | `guests.ts`                       |
| `error` | `Guest merge failed: …`                             | `guests.ts`                       |
| `warn`  | `Guest merge skipped: INDEX_URL or INDEX_MERGE_KEY` | `guests.ts`                       |
| `error` | `Guest profile merge failed:`                       | `guests.ts`                       |
| `error` | `Guest seen stamp failed:`                          | `guests.ts`, `workspace-token.ts` |
| `error` | `Guest settings merge failed:`                      | `guests.ts`                       |
| `error` | `Starting the onboarding series failed:`            | `auth-options.ts`                 |
| `error` | `[accounts] BETTER_AUTH_SECRET unset; refusing to`  | `index.ts`                        |
| `error` | `[accounts] cron step failed: …`                    | `index.ts`                        |
| `warn`  | `[accounts] drive disconnect failed`                | `drive-disconnect.ts`             |
| `warn`  | `[accounts] drive disconnect not taken`             | `drive-disconnect.ts`             |
| `log`   | `[accounts] index purges`                           | `index.ts`                        |
| `log`   | `[accounts] legacy guest claimed`                   | `legacy-guests.ts`                |
| `log`   | `[accounts] timeline events`                        | `index.ts`                        |
| `warn`  | `[accounts] timeline events dropped, over the outb` | `index.ts`                        |
| `log`   | `[email] To: … Subject: …`                          | `email.ts`                        |
| `log`   | `[guests] idle guests swept`                        | `index.ts`                        |
| `warn`  | `[lifecycle] giving up on an account after ${faile` | `lifecycle.ts`                    |
| `log`   | `[lifecycle] onboarding emails`                     | `index.ts`                        |
| `error` | `[lifecycle] welcome failed`                        | `index.ts`                        |
| `error` | `[lifecycle] … send failed`                         | `lifecycle.ts`                    |
| `error` | `[profile-picture] store failed`                    | `auth-options.ts`                 |
| `error` | `[profiles] guest seen failed`                      | `account-api.ts`                  |
| `error` | `[settings] guest seen failed`                      | `account-api.ts`                  |
| `log`   | `[teams] invitation sweep`                          | `index.ts`                        |
| `error` | `[teams] invite email failed`                       | `account-api.ts`                  |
| `error` | `[teams] invite response email failed`              | `account-api.ts`                  |
| `warn`  | `[telemetry] batch not sent`                        | `telemetry.ts`                    |
| `warn`  | `[timeline] events not taken; the cron sends them`  | `index-timeline.ts`               |
| `warn`  | `[timeline] flush failed`                           | `index-timeline.ts`               |
| `warn`  | `[timeline] trim failed`                            | `index-timeline.ts`               |
| `error` | `[tokens] expiry Timeline note failed`              | `index.ts`                        |
| `error` | `[tokens] expiry warning failed`                    | `token-expiry.ts`                 |
| `error` | `[tokens] expiry warning sweep failed`              | `index.ts`                        |
| `log`   | `[tokens] expiry warnings`                          | `index.ts`                        |
| `error` | `[workbench] closing an account’s workbench failed` | `revoke.ts`                       |
| `warn`  | `[workbench] dead token cleanup failed`             | `routes.ts`                       |
| `error` | `[workbench] ending a revoked token’s pairings fai` | `revoke.ts`                       |
| `warn`  | `[workbench] folder lookup failed`                  | `index-access.ts`                 |
| `warn`  | `[workbench] index access failed`                   | `index-access.ts`                 |
| `warn`  | `[workbench] mint-refused`                          | `routes.ts`                       |
| `log`   | `[workbench] paired`                                | `routes.ts`                       |
| `log`   | `[workbench] pairing-declined`                      | `routes.ts`                       |
| `log`   | `[workbench] pairing-requested`                     | `routes.ts`                       |
| `warn`  | `[workbench] room close failed`                     | `index-access.ts`, `revoke.ts`    |
| `log`   | `[workbench] rooms closed`                          | `index-access.ts`                 |
| `log`   | `[workbench] session-ended`                         | `routes.ts`, `store.ts`           |
| `log`   | `[workbench] session-opened`                        | `routes.ts`                       |
| `warn`  | `[workbench] session-refused`                       | `routes.ts`                       |
| `log`   | `[workbench] swept`                                 | `durable-object.ts`               |
| `log`   | `[workbench] ticket-minted`                         | `routes.ts`                       |
| `log`   | `[workbench] unpaired`                              | `store.ts`                        |

## Files

| File                                                          | Role                                                                                                                                                                                                               |
| ------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `liveworkspace/apps/accounts/src/account-api.ts`              | The account API under /api/account (liveworkspace/docs/specs/003-accounts/accounts.md "Teams" and "API tokens"): - for the signed-in person on liveworkspace.app, by their session cookie: th…                     |
| `liveworkspace/apps/accounts/src/account-apps.ts`             | What one app keeps about an account (liveworkspace/docs/specs/003-accounts/accounts.md "Sign-ups and milestones per app"): when it first saw the account, which is how it counts a sign-up, a…                     |
| `liveworkspace/apps/accounts/src/auth-options.ts`             | Everything Better Auth is configured with, apart from where the database lives                                                                                                                                     |
| `liveworkspace/apps/accounts/src/auth.ts`                     |                                                                                                                                                                                                                    |
| `liveworkspace/apps/accounts/src/bearer.ts`                   | The Explorer served under an app's own address (liveworkspace/docs/specs/004-index/one-explorer.md "The Explorer on each app's address") has no liveworkspace.app session: it is the app's…                        |
| `liveworkspace/apps/accounts/src/bench-accounts.ts`           | Throwaway accounts for the apps' local evaluation benches (each app's apps/mcp/eval/bench): an account and one API token each, so every bench run gets its own empty libra…                                        |
| `liveworkspace/apps/accounts/src/clients.ts`                  | Registering an app (a confidential OAuth client) with this Worker                                                                                                                                                  |
| `liveworkspace/apps/accounts/src/delete-account.ts`           | Closing a liveworkspace account, asked for by an app's own server when the person deletes their account there                                                                                                      |
| `liveworkspace/apps/accounts/src/drive-disconnect.ts`         | Closing an account disconnects its Google Drive mirror too (liveworkspace/docs/specs/005-drive/drive.md "Disconnecting and account deletion"): the Drive service revokes the grant and for…                        |
| `liveworkspace/apps/accounts/src/email-layout.ts`             | The frame every accounts email is drawn in (liveworkspace/docs/specs/003-accounts/accounts.md "Emails"), the same as the apps' own (each product's docs/specs/014-identity/transactional-emai…                     |
| `liveworkspace/apps/accounts/src/email.ts`                    |                                                                                                                                                                                                                    |
| `liveworkspace/apps/accounts/src/end-session.ts`              | Signing out everywhere (liveworkspace/docs/specs/003-accounts/accounts.md "Signing out"): an app's Worker ends the session its refresh token came from, and the browser's hop ends its own                         |
| `liveworkspace/apps/accounts/src/env.ts`                      |                                                                                                                                                                                                                    |
| `liveworkspace/apps/accounts/src/guest-sweep.ts`              | Guests who can never come back (liveworkspace/docs/specs/003-accounts/accounts.md "Guests who never come back")                                                                                                    |
| `liveworkspace/apps/accounts/src/guests.ts`                   | Guests: one identity across every app (liveworkspace/docs/specs/004-index/one-explorer-contracts.md "Guests").                                                                                                     |
| `liveworkspace/apps/accounts/src/handoff.ts`                  | Signing in on the app's own address (liveworkspace/docs/specs/003-accounts/accounts.md "Signing in on the app's own address").                                                                                     |
| `liveworkspace/apps/accounts/src/ids.ts`                      | Account ids keep Clerk's `user_` prefix                                                                                                                                                                            |
| `liveworkspace/apps/accounts/src/index-purge.ts`              | Closing an account empties the index too (liveworkspace/docs/specs/003-accounts/accounts.md "Closing an account")                                                                                                  |
| `liveworkspace/apps/accounts/src/index-timeline.ts`           | Teams' and API tokens' events on the Timeline (liveworkspace/docs/specs/003-accounts/accounts.md "On the Timeline")                                                                                                |
| `liveworkspace/apps/accounts/src/index.ts`                    |                                                                                                                                                                                                                    |
| `liveworkspace/apps/accounts/src/internal-invitations.ts`     | The invitations waiting for an account, for an app's server (liveworkspace/docs/specs/003-accounts/accounts.md "The API"): `POST /api/account/internal/invitations` `{ userId }`                                   |
| `liveworkspace/apps/accounts/src/legacy-guests.ts`            | Returning guests of the old livediagram.app (liveworkspace/docs/specs/003-accounts/accounts.md "Returning guests of the old livediagram.app", docs/migration.md step 6)                                            |
| `liveworkspace/apps/accounts/src/lifecycle-email.ts`          | The onboarding series' emails (liveworkspace/docs/specs/003-accounts/accounts.md "Onboarding emails"): a welcome, the Explorer at a week, teams at two weeks, a nudge for someone who hasn't …                     |
| `liveworkspace/apps/accounts/src/lifecycle.ts`                | The onboarding series (liveworkspace/docs/specs/003-accounts/accounts.md "Onboarding emails"): one per account, not one per app, so a person who uses all four apps hears it once                                  |
| `liveworkspace/apps/accounts/src/notify.ts`                   | What an app's notification emails need from accounts (liveworkspace/docs/specs/003-accounts/accounts.md "Notification emails"), beside the addresses (account-apps.ts `verifiedEmails`): whet…                     |
| `liveworkspace/apps/accounts/src/profiles.ts`                 | A person's display name and presence colour (liveworkspace/docs/specs/003-accounts/accounts.md "Profiles"): what collaborators see on their cursor, their comments and the presence list, the…                     |
| `liveworkspace/apps/accounts/src/rate-limit.ts`               |                                                                                                                                                                                                                    |
| `liveworkspace/apps/accounts/src/resources.ts`                |                                                                                                                                                                                                                    |
| `liveworkspace/apps/accounts/src/secrets.ts`                  | Constant-time comparison of two secrets of any length: both sides are hashed first, so neither the content nor the length leaks through timing.                                                                    |
| `liveworkspace/apps/accounts/src/settings.ts`                 | A person's settings (liveworkspace/docs/specs/003-accounts/accounts.md "Settings"), kept with the account so every app reads the same ones                                                                         |
| `liveworkspace/apps/accounts/src/sign-in-options.ts`          | What the sign-in pages need to know about this deployment                                                                                                                                                          |
| `liveworkspace/apps/accounts/src/teams.ts`                    | Teams (liveworkspace/docs/specs/003-accounts/accounts.md "Teams"): made and run on liveworkspace.app, the same team in every app                                                                                   |
| `liveworkspace/apps/accounts/src/telemetry.ts`                | The accounts Worker's own telemetry (liveworkspace/docs/specs/003-accounts/accounts.md "Onboarding emails", liveworkspace/docs/specs/008-telemetry/telemetry.md "Sending events"): `Email·Sent·<kind>` for each o… |
| `liveworkspace/apps/accounts/src/token-expiry.ts`             | The expiring-token warning (liveworkspace/docs/specs/003-accounts/accounts.md "API tokens"): once a day, the owner of each live token that expires within a week hears about it once, so a sc…                     |
| `liveworkspace/apps/accounts/src/tokens.ts`                   | API tokens (liveworkspace/docs/specs/003-accounts/accounts.md "API tokens"): one per integration, belonging to the account, so the same token works on every app's API and MCP server                              |
| `liveworkspace/apps/accounts/src/workbench/apps.ts`           | Each app's workbench dialect (liveworkspace/docs/specs/011-workbench/workbench.md "Addresses"): the app a request is for, its word for an item as the item scope (`project`, `document`, `desi…                    |
| `liveworkspace/apps/accounts/src/workbench/durable-object.ts` | The workbench store's Durable Object (store.ts), one per person, bound as WORKBENCH (wrangler.toml: a `new_sqlite_classes` migration)                                                                              |
| `liveworkspace/apps/accounts/src/workbench/index-access.ts`   | The owner's own access to an item or a folder, for a ticket's mint and redemption (liveworkspace/docs/specs/011-workbench/workbench.md "The handoff"): never a share code, whatever the reques…                    |
| `liveworkspace/apps/accounts/src/workbench/internal.ts`       | The apps' servers' doors into the workbench service (liveworkspace/docs/specs/011-workbench/workbench.md "The handoff"), under /api/account/internal with their client credentials, each for t…                    |
| `liveworkspace/apps/accounts/src/workbench/revoke.ts`         | Ending a workbench's access from accounts' side (liveworkspace/docs/specs/011-workbench/workbench.md "Ending access"): a token revoked ends its pairings and requests, an account closed drops…                    |
| `liveworkspace/apps/accounts/src/workbench/routes.ts`         | /api/account/workbench/* (liveworkspace/docs/specs/011-workbench/workbench.md "Addresses"): every app's workbench pairing, tickets and sessions                                                                    |
| `liveworkspace/apps/accounts/src/workbench/store.ts`          | One person's workbench (liveworkspace/docs/specs/011-workbench/workbench.md "The store"): their pairing requests, pairings, tickets, sessions, the rooms a workspace session joined, and their…                    |
| `liveworkspace/apps/accounts/src/workspace-token.ts`          | The liveworkspace Explorer's identity (liveworkspace/docs/specs/003-accounts/accounts.md "liveworkspace.app's own token")                                                                                          |
| `liveworkspace/apps/accounts/scripts/csv.ts`                  | RFC 4180 CSV: quoted fields, doubled quotes, and newlines inside quotes.                                                                                                                                           |
| `liveworkspace/apps/accounts/scripts/e2e-local.ts`            | Walks the whole sign-in flow against a local `pnpm dev`, the way an app would: redirect to /oauth2/authorize, register with a code and a name, swap the code for                                                   |
| `liveworkspace/apps/accounts/scripts/generate-migration.ts`   | Writes Better Auth's schema as a D1 migration                                                                                                                                                                      |
| `liveworkspace/apps/accounts/scripts/import-clerk-users.ts`   | Turns a Clerk user export (Dashboard → Users → Export, CSV) into SQL that creates the same accounts here, keeping each Clerk id as the account id                                                                  |
| `liveworkspace/apps/accounts/scripts/map-clients.ts`          | Says which app each OAuth client is, for clients registered before register-client.ts took --app (liveworkspace/docs/specs/003-accounts/accounts.md "Which app a client is")                                       |
| `liveworkspace/apps/accounts/scripts/register-client.ts`      | Registers an app with the accounts Worker and prints its client id and secret once.                                                                                                                                |
| `packages/auth-client/src/account-name.ts`                    | The app's readable account name (liveworkspace/docs/specs/003-accounts/accounts.md "An app's signed-in cookies")                                                                                                   |
| `packages/auth-client/src/account.ts`                         | An app's server talking to the liveworkspace account API (liveworkspace/docs/specs/003-accounts/accounts.md "Teams", "API tokens" and "Settings"), with its OAuth client credentials: checkin…                     |
| `packages/auth-client/src/e2e-token-stand-in.ts`              | The API tokens and profiles of the liveworkspace accounts Worker, for an app's e2e stack (its `scripts/e2e-stack.mjs`, which stands in for accounts on `/e2e/accounts`), s…                                        |
| `packages/auth-client/src/explorer-reads.ts`                  | The Explorer's reads from another app (liveworkspace/docs/specs/004-index/one-explorer.md): on an app's own address the Explorer asks as that app, with a token addressed to that app's AP…                        |
| `packages/auth-client/src/index.ts`                           |                                                                                                                                                                                                                    |
| `packages/auth-client/src/invitations.ts`                     | The team invitations waiting for an account (liveworkspace/docs/specs/003-accounts/accounts.md "The API", `POST /api/account/internal/invitations`), for an app's Invites view and its sideba…                     |
| `packages/auth-client/src/notify.ts`                          | What every app's notification emails share (liveworkspace/docs/specs/003-accounts/accounts.md "Notification emails"): the rules each one keeps, and the two questions each asks of accounts b…                     |
| `packages/auth-client/src/oauth.ts`                           | The app side of signing in through liveworkspace.app: an authorization-code flow with PKCE. The redirect leaves the app's domain on purpose                                                                        |
| `packages/auth-client/src/return-path.ts`                     | The one check on a path a sign-in (or any round trip) comes back to, for every app's api, editor and liveworkspace's site                                                                                          |
| `packages/auth-client/src/silent.ts`                          | Signing in without a click (liveworkspace/docs/specs/003-accounts/accounts.md "Signing in without a click").                                                                                                       |
| `packages/auth-client/src/verify.ts`                          | Checks a liveworkspace access token inside an app's own Worker                                                                                                                                                     |
| `packages/auth-client/src/workbench.ts`                       | An app's server and liveworkspace's workbench service (liveworkspace/docs/specs/011-workbench/workbench.md): pairing, tickets and sessions live in the accounts Worker, and an app only checks…                    |
| `packages/email/src/index.ts`                                 | Every email the platform sends, accounts' and each app's, goes out through Cloudflare Email Service's `send_email` binding (liveworkspace/docs/specs/003-accounts/email.md)                                        |
| `packages/settings/src/account.ts`                            | The account's own settings, as plain data (liveworkspace/docs/specs/010-site/site.md "Settings", accounts.md "Settings"): the switches in the `all` scope that mean something without an …                         |
| `packages/settings/src/catalogue.ts`                          | Each app's own settings as plain data (liveworkspace/docs/specs/003-accounts/accounts.md "Settings"), for liveworkspace.app to show and change outside the app: the settings in the app's sco…                     |
| `packages/settings/src/catalogues/livedesign.ts`              | livedesign's own settings as liveworkspace.app shows them: generated from its Settings catalogue by deriveCatalogue (../catalogue.ts)                                                                              |
| `packages/settings/src/catalogues/livediagram.ts`             | livediagram's own settings as liveworkspace.app shows them: generated from its Settings catalogue by deriveCatalogue (../catalogue.ts)                                                                             |
| `packages/settings/src/catalogues/livedocuments.ts`           | livedocuments's own settings as liveworkspace.app shows them: generated from its Settings catalogue by deriveCatalogue (../catalogue.ts)                                                                           |
| `packages/settings/src/catalogues/liveplanner.ts`             | liveplanner's own settings as liveworkspace.app shows them: generated from its Settings catalogue by deriveCatalogue (../catalogue.ts)                                                                             |
| `packages/settings/src/common.ts`                             | The Settings panel's Common group, as plain data (liveworkspace/docs/specs/003-accounts/accounts.md "Common settings", liveworkspace/docs/specs/010-site/site.md "Settings"): every editor setting two or mo…      |
| `packages/settings/src/device.ts`                             | Where each app's editor keeps a person's settings in the browser, on the app's own address (each app's docs/specs/007-editor/user-preferences.md, liveworkspace/docs/site.…                                        |
| `packages/settings/src/index.ts`                              | Which of a person's settings every app shares (liveworkspace/docs/specs/003-accounts/accounts.md "Settings")                                                                                                       |
| `packages/settings/src/presence.ts`                           | The presence colours every app offers (liveworkspace/docs/specs/003-accounts/accounts.md "Profiles"): the colour collaborators see on a person's cursor, comments and avatar, in every app an…                     |

## Constants and configuration: the Worker

`liveworkspace/apps/accounts/wrangler.toml`, account `851be7d244b76a6557bcbe6c4ded80f5`, main `src/index.ts`, compatibility date `2026-05-29`.

**Production**

| Setting                           | Value                                                                                                                        |
| --------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| Worker name                       | `liveworkspace-accounts`                                                                                                     |
| Route                             | `www.liveworkspace.app/api/auth/*`, `liveworkspace.app/api/auth/*`                                                           |
| Route                             | `www.liveworkspace.app/api/account/*`, `liveworkspace.app/api/account/*`                                                     |
| Route                             | `www.liveworkspace.app/.well-known/openid-configuration*`, `liveworkspace.app/.well-known/openid-configuration*`             |
| Route                             | `www.liveworkspace.app/.well-known/oauth-authorization-server*`, `liveworkspace.app/.well-known/oauth-authorization-server*` |
| D1 `AUTH_DB`                      | `liveworkspace-accounts`, migrations `migrations`                                                                            |
| Service `INDEX`                   | `liveworkspace-index`                                                                                                        |
| Service `TELEMETRY`               | `liveworkspace-telemetry`                                                                                                    |
| Service `DRIVE`                   | `liveworkspace-drive`                                                                                                        |
| Durable Object `WORKBENCH`        | class `WorkbenchStore`                                                                                                       |
| Rate limit `CODE_IP_LIMITER`      | 10 per 60 s                                                                                                                  |
| Rate limit `CODE_EMAIL_LIMITER`   | 3 per 60 s                                                                                                                   |
| Rate limit `GUEST_LIMITER`        | 60 per 60 s                                                                                                                  |
| Rate limit `TEAM_LINK_LIMITER`    | 20 per 60 s                                                                                                                  |
| Rate limit `WORKBENCH_LIMITER`    | 30 per 60 s                                                                                                                  |
| Rate limit `LEGACY_GUEST_LIMITER` | 10 per 60 s                                                                                                                  |
| Email `EMAIL`                     | `send_email`                                                                                                                 |
| Crons                             | `17 9 * * *`, `*/15 * * * *`                                                                                                 |
| Var `ENVIRONMENT`                 | `production`                                                                                                                 |
| Var `BASE_URL`                    | `https://www.liveworkspace.app`                                                                                              |
| Var `INDEX_URL`                   | `https://www.liveworkspace.app/api/index`                                                                                    |
| Var `EMAIL_FROM`                  | `sign-in@liveplanner.app`                                                                                                    |
| Var `TURNSTILE_SITE_KEY`          | `0x4AAAAAAFlfZFYIdJsaQor8`                                                                                                   |
| Var `TELEMETRY_URL`               | `https://www.liveworkspace.app/api/telemetry`                                                                                |
| Var `SIGN_IN_ON_APP_ORIGINS`      | `true`                                                                                                                       |
| Var `GOOGLE_ON_APP_ORIGINS`       | `false`                                                                                                                      |

**`env.staging`**

| Setting                           | Value                                                               |
| --------------------------------- | ------------------------------------------------------------------- |
| Worker name                       | `liveworkspace-accounts-staging`                                    |
| Route                             | `staging.liveworkspace.app/api/auth/*`                              |
| Route                             | `staging.liveworkspace.app/api/account/*`                           |
| Route                             | `staging.liveworkspace.app/.well-known/openid-configuration*`       |
| Route                             | `staging.liveworkspace.app/.well-known/oauth-authorization-server*` |
| D1 `AUTH_DB`                      | `liveworkspace-accounts-staging`, migrations `migrations`           |
| Service `INDEX`                   | `liveworkspace-index-staging`                                       |
| Service `TELEMETRY`               | `liveworkspace-telemetry-staging`                                   |
| Service `DRIVE`                   | `liveworkspace-drive-staging`                                       |
| Durable Object `WORKBENCH`        | class `WorkbenchStore`                                              |
| Rate limit `CODE_IP_LIMITER`      | 10 per 60 s                                                         |
| Rate limit `CODE_EMAIL_LIMITER`   | 3 per 60 s                                                          |
| Rate limit `GUEST_LIMITER`        | 60 per 60 s                                                         |
| Rate limit `TEAM_LINK_LIMITER`    | 20 per 60 s                                                         |
| Rate limit `WORKBENCH_LIMITER`    | 30 per 60 s                                                         |
| Rate limit `LEGACY_GUEST_LIMITER` | 10 per 60 s                                                         |
| Email `EMAIL`                     | `send_email`                                                        |
| Crons                             | `17 9 * * *`, `*/15 * * * *`                                        |
| Var `ENVIRONMENT`                 | `staging`                                                           |
| Var `BASE_URL`                    | `https://staging.liveworkspace.app`                                 |
| Var `INDEX_URL`                   | `https://staging.liveworkspace.app/api/index`                       |
| Var `EMAIL_FROM`                  | `sign-in@liveplanner.app`                                           |
| Var `TURNSTILE_SITE_KEY`          | `0x4AAAAAAFlfZFYIdJsaQor8`                                          |
| Var `TELEMETRY_URL`               | `https://staging.liveworkspace.app/api/telemetry`                   |
| Var `SIGN_IN_ON_APP_ORIGINS`      | `true`                                                              |
| Var `GOOGLE_ON_APP_ORIGINS`       | `false`                                                             |

Env fields (`env.ts`): `ADMIN_TOKEN`, `BASE_URL`, `BETTER_AUTH_SECRET`, `DRIVE_KEY_ACCOUNTS`, `EMAIL_FROM`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_ON_APP_ORIGINS`, `INDEX_MERGE_KEY`, `INDEX_URL`, `LEGACY_GUEST_ID_HMAC_SECRET`, `SIGN_IN_ON_APP_ORIGINS`, `TELEMETRY_KEY_LIVEDESIGN`, `TELEMETRY_KEY_LIVEDIAGRAM`, `TELEMETRY_KEY_LIVEDOCUMENTS`, `TELEMETRY_KEY_LIVEPLANNER`, `TELEMETRY_URL`, `TURNSTILE_SECRET_KEY`, `TURNSTILE_SITE_KEY`.

## Data and persistence

One D1 database (`AUTH_DB`). Each table's indexes, and what writes and reads it, are in the feature file that
owns it: Better Auth's own tables and `sign_in_handoff` in [sign-in.md](sign-in.md) and [oauth.md](oauth.md); `guest_seen`,
`legacy_guest` in [sessions-and-guests.md](sessions-and-guests.md); `team`, `team_member`, `team_seq` in [teams.md](teams.md);
`api_token` in [tokens.md](tokens.md); `settings`, `profile` in [settings-and-profiles.md](settings-and-profiles.md);
`email_lifecycle`, `account_app` in [email.md](email.md). `pending_purges` (`pending_purges_due (lastAttemptAt)`) and
`index_timeline_outbox` (`index_timeline_outbox_order (createdAt)`) are written and read as above.

Migrations, in order:

- `0001_better_auth.sql`
- `0002_teams_and_tokens.sql`
- `0003_settings.sql`
- `0004_pending_purges.sql`
- `0005_client_apps.sql`
- `0006_profiles.sql`
- `0007_account_apps.sql`
- `0008_email_lifecycle.sql`
- `0009_signup_app.sql`
- `0010_sign_in_handoff.sql`
- `0011_legacy_guest.sql`
- `0012_profile_picture.sql`
- `0013_legacy_guest_claiming.sql`

| Table                   | Columns                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         | Created in                  |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------- |
| `account`               | `id`, `accountId`, `providerId`, `userId`, `accessToken`, `refreshToken`, `idToken`, `accessTokenExpiresAt`, `refreshTokenExpiresAt`, `scope`, `password`, `createdAt`, `updatedAt`                                                                                                                                                                                                                                                                                                                                                                                             | `0001_better_auth.sql`      |
| `account_app`           | `user_id`, `app`, `first_seen_at`, `milestone_sent_at`, `first_share_sent_at`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   | `0007_account_apps.sql`     |
| `api_token`             | `id`, `userId`, `tokenHash`, `name`, `readOnly`, `createdAt`, `lastUsedAt`, `expiresAt`, `revokedAt`, `expiryWarnedAt`, `expiryNotedAt`                                                                                                                                                                                                                                                                                                                                                                                                                                         | `0002_teams_and_tokens.sql` |
| `email_lifecycle`       | `user_id`, `created_at`, `welcome_sent_at`, `week1_sent_at`, `week2_sent_at`, `activation_sent_at`, `winback_sent_at`, `send_attempts`, `last_attempt_at`, `active_at`, `signup_app (0009)`                                                                                                                                                                                                                                                                                                                                                                                     | `0008_email_lifecycle.sql`  |
| `guest_seen`            | `guest_id`, `seen_at`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           | `0006_profiles.sql`         |
| `index_timeline_outbox` | `id`, `body`, `createdAt`, `attempts`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           | `0004_pending_purges.sql`   |
| `jwks`                  | `id`, `publicKey`, `privateKey`, `createdAt`, `expiresAt`, `alg`, `crv`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         | `0001_better_auth.sql`      |
| `legacy_guest`          | `id`, `firstSeenAt`, `claimedAt`, `claimedBy`, `claimingBy (0013)`, `claimingUntil (0013)`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      | `0011_legacy_guest.sql`     |
| `oauthAccessToken`      | `id`, `token`, `clientId`, `sessionId`, `userId`, `referenceId`, `authorizationCodeId`, `resources`, `requestedUserInfoClaims`, `refreshId`, `expiresAt`, `createdAt`, `revoked`, `confirmation`, `scopes`                                                                                                                                                                                                                                                                                                                                                                      | `0001_better_auth.sql`      |
| `oauthClient`           | `id`, `clientId`, `clientSecret`, `clientDiscoveryId`, `disabled`, `skipConsent`, `enableEndSession`, `subjectType`, `scopes`, `clientCredentialsScopes`, `userId`, `createdAt`, `updatedAt`, `name`, `uri`, `icon`, `contacts`, `tos`, `policy`, `softwareId`, `softwareVersion`, `softwareStatement`, `redirectUris`, `postLogoutRedirectUris`, `backchannelLogoutUri`, `backchannelLogoutSessionRequired`, `tokenEndpointAuthMethod`, `applicationType`, `jwks`, `jwksUri`, `grantTypes`, `responseTypes`, `requirePKCE`, `dpopBoundAccessTokens`, `referenceId`, `metadata` | `0001_better_auth.sql`      |
| `oauthClientAssertion`  | `id`, `expiresAt`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               | `0001_better_auth.sql`      |
| `oauthClientResource`   | `id`, `clientId`, `resourceId`, `metadata`, `createdAt`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         | `0001_better_auth.sql`      |
| `oauthConsent`          | `id`, `clientId`, `userId`, `referenceId`, `resources`, `requestedUserInfoClaims`, `scopes`, `createdAt`, `updatedAt`                                                                                                                                                                                                                                                                                                                                                                                                                                                           | `0001_better_auth.sql`      |
| `oauthRefreshToken`     | `id`, `token`, `clientId`, `sessionId`, `userId`, `referenceId`, `authorizationCodeId`, `resources`, `requestedUserInfoClaims`, `expiresAt`, `createdAt`, `revoked`, `rotatedAt`, `rotationReplayResponse`, `rotationReplayExpiresAt`, `authTime`, `confirmation`, `scopes`                                                                                                                                                                                                                                                                                                     | `0001_better_auth.sql`      |
| `oauthResource`         | `id`, `identifier`, `name`, `accessTokenTtl`, `refreshTokenTtl`, `signingAlgorithm`, `signingKeyId`, `allowedScopes`, `customClaims`, `dpopBoundAccessTokensRequired`, `disabled`, `createdAt`, `updatedAt`, `policyVersion`, `metadata`                                                                                                                                                                                                                                                                                                                                        | `0001_better_auth.sql`      |
| `oauth_client_app`      | `clientId`, `app`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               | `0005_client_apps.sql`      |
| `pending_purges`        | `userId`, `teamIds`, `createdAt`, `attempts`, `lastAttemptAt`, `lastError`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      | `0004_pending_purges.sql`   |
| `profile`               | `owner_id`, `name`, `color`, `created_at`, `updated_at`, `show_picture (0012)`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  | `0006_profiles.sql`         |
| `session`               | `id`, `expiresAt`, `token`, `createdAt`, `updatedAt`, `ipAddress`, `userAgent`, `userId`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        | `0001_better_auth.sql`      |
| `settings`              | `owner_id`, `scope`, `prefs`, `updated_at`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      | `0003_settings.sql`         |
| `sign_in_handoff`       | `tokenHash`, `sessionId`, `userId`, `bindHash`, `returnUrl`, `expiresAt`, `usedAt`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              | `0010_sign_in_handoff.sql`  |
| `team`                  | `id`, `name`, `organisation`, `createdAt`, `updatedAt`, `deletedAt`, `rev`, `inviteLinkNonce`, `inviteLinkHash`, `inviteLinkExpiresAt`                                                                                                                                                                                                                                                                                                                                                                                                                                          | `0002_teams_and_tokens.sql` |
| `team_member`           | `id`, `teamId`, `userId`, `email`, `role`, `status`, `invitedBy`, `createdAt`, `updatedAt`, `rev`, `declineTokenHashes`, `clockStartedAt`, `reminder1SentAt`, `reminder2SentAt`, `reminder3SentAt`, `reminderAttempts`, `expiredAt`                                                                                                                                                                                                                                                                                                                                             | `0002_teams_and_tokens.sql` |
| `team_seq`              | `id`, `value`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   | `0002_teams_and_tokens.sql` |
| `user`                  | `id`, `name`, `email`, `emailVerified`, `image`, `createdAt`, `updatedAt`, `givenName`, `familyName`                                                                                                                                                                                                                                                                                                                                                                                                                                                                            | `0001_better_auth.sql`      |
| `verification`          | `id`, `identifier`, `value`, `expiresAt`, `createdAt`, `updatedAt`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              | `0001_better_auth.sql`      |

## Constants and configuration: named constants

| Constant                            | Value                                                                    | File                 |
| ----------------------------------- | ------------------------------------------------------------------------ | -------------------- |
| `ACCOUNT_API_PATH`                  | `'/api/account'`                                                         | `account-api.ts`     |
| `MAX_EMAIL_IDS`                     | `100`                                                                    | `account-apps.ts`    |
| `AUTH_BASE_PATH`                    | `'/api/auth'`                                                            | `auth-options.ts`    |
| `SEND_CODE_PATH`                    | `'/email-otp/send-verification-otp'`                                     | `auth-options.ts`    |
| `SIGN_IN_CODE_PATH`                 | `'/sign-in/email-otp'`                                                   | `auth-options.ts`    |
| `UNUSED_CODE_PATHS`                 | `(object or list, see file)`                                             | `auth-options.ts`    |
| `NAME_MAX_LENGTH`                   | `80`                                                                     | `auth-options.ts`    |
| `BENCH_ACCOUNTS_PATH`               | `${AUTH_BASE_PATH}/internal/bench-accounts`                              | `bench-accounts.ts`  |
| `BENCH_ACCOUNTS_MAX`                | `200`                                                                    | `bench-accounts.ts`  |
| `CLIENTS_PATH`                      | `${AUTH_BASE_PATH}/internal/clients`                                     | `clients.ts`         |
| `DELETE_ACCOUNT_PATH`               | `'/delete-account'`                                                      | `delete-account.ts`  |
| `INK`                               | `'#0f172a'`                                                              | `email-layout.ts`    |
| `MUTED`                             | `'#475569'`                                                              | `email-layout.ts`    |
| `GUEST_IDLE_MS`                     | `400 * DAY_MS`                                                           | `guest-sweep.ts`     |
| `GUEST_SWEEP_LIMIT`                 | `500`                                                                    | `guest-sweep.ts`     |
| `GUEST_PATH`                        | `'/guest'`                                                               | `guests.ts`          |
| `GUEST_COOKIE`                      | `'lw_guest'`                                                             | `guests.ts`          |
| `GUEST_TOKEN_TTL_SECONDS`           | `365 * 24 * 60 * 60`                                                     | `guests.ts`          |
| `AUTHORIZE_PATH`                    | `'/oauth2/authorize'`                                                    | `guests.ts`          |
| `HANDOFF_PATH`                      | `'/handoff'`                                                             | `handoff.ts`         |
| `HANDOFF_START_PATH`                | `'/handoff/start'`                                                       | `handoff.ts`         |
| `HANDOFF_NONCE_COOKIE`              | `'lw_handoff'`                                                           | `handoff.ts`         |
| `HANDOFF_BIND_PARAM`                | `'handoff'`                                                              | `handoff.ts`         |
| `HANDOFF_TTL_SECONDS`               | `60`                                                                     | `handoff.ts`         |
| `HANDOFF_NONCE_MAX_AGE_SECONDS`     | `900`                                                                    | `handoff.ts`         |
| `GUEST_ID`                          | `/^guest_[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/` | `ids.ts`             |
| `USER_ID`                           | `/^user_[A-Za-z0-9]{1,64}$/`                                             | `ids.ts`             |
| `PURGE_RETRY_CRON`                  | `'*/15 * * * *'`                                                         | `index-purge.ts`     |
| `PURGES_PER_RUN`                    | `25`                                                                     | `index-purge.ts`     |
| `TIMELINE_BATCH`                    | `100`                                                                    | `index-timeline.ts`  |
| `TIMELINE_SCOPES_MAX`               | `250`                                                                    | `index-timeline.ts`  |
| `TIMELINE_CALLS_PER_RUN`            | `10`                                                                     | `index-timeline.ts`  |
| `TIMELINE_MAX_ATTEMPTS`             | `96`                                                                     | `index-timeline.ts`  |
| `TIMELINE_OUTBOX_MAX`               | `5_000`                                                                  | `index-timeline.ts`  |
| `LEGACY_CLAIM_HOLD_MS`              | `60_000`                                                                 | `legacy-guests.ts`   |
| `ACTIVATION_DELAY_MS`               | `3 * DAY_MS`                                                             | `lifecycle.ts`       |
| `WINBACK_QUIET_MS`                  | `4 * WEEK_MS`                                                            | `lifecycle.ts`       |
| `SWEEP_LIMIT`                       | `100`                                                                    | `lifecycle.ts`       |
| `MAX_SEND_ATTEMPTS`                 | `3`                                                                      | `lifecycle.ts`       |
| `STAGE_ORDER`                       | `['welcome', 'activation', 'week1', 'week2', 'winback']`                 | `lifecycle.ts`       |
| `MAX_NOTIFY_OWNERS`                 | `100`                                                                    | `notify.ts`          |
| `MAX_NOTIFY_KEYS`                   | `8`                                                                      | `notify.ts`          |
| `MAX_PROFILE_IDS`                   | `100`                                                                    | `profiles.ts`        |
| `PROFILE_NAME_MAX`                  | `120`                                                                    | `profiles.ts`        |
| `PROFILE_COLOR_MAX`                 | `64`                                                                     | `profiles.ts`        |
| `RESOURCES`                         | `(object or list, see file)`                                             | `resources.ts`       |
| `ADMIN_HEADER`                      | `'x-liveworkspace-admin'`                                                | `secrets.ts`         |
| `SETTINGS_MAX_BYTES`                | `16_384`                                                                 | `settings.ts`        |
| `SIGN_IN_OPTIONS_PATH`              | `'/sign-in-options'`                                                     | `sign-in-options.ts` |
| `TEAM_NAME_MAX_LENGTH`              | `80`                                                                     | `teams.ts`           |
| `MAX_TEAMS_PER_ACCOUNT`             | `50`                                                                     | `teams.ts`           |
| `MAX_MEMBERS_PER_TEAM`              | `200`                                                                    | `teams.ts`           |
| `ORGANISATION_MAX_LENGTH`           | `80`                                                                     | `teams.ts`           |
| `INVITE_LINK_TTL_MS`                | `7 * 24 * 60 * 60 * 1000`                                                | `teams.ts`           |
| `REMINDER_AGES_MS`                  | `[1 * DAY_MS, 7 * DAY_MS, 21 * DAY_MS] as const`                         | `teams.ts`           |
| `INVITATION_TTL_MS`                 | `28 * DAY_MS`                                                            | `teams.ts`           |
| `EXPIRE_BATCH`                      | `500`                                                                    | `teams.ts`           |
| `REMINDER_BATCH`                    | `100`                                                                    | `teams.ts`           |
| `MAX_REMINDER_ATTEMPTS`             | `3`                                                                      | `teams.ts`           |
| `LIST_PREVIEW_MEMBERS`              | `4`                                                                      | `teams.ts`           |
| `DELETED_MEMBER_EMAIL`              | `'Deleted account'`                                                      | `teams.ts`           |
| `CHANGES_PAGE_SIZE`                 | `500`                                                                    | `teams.ts`           |
| `TELEMETRY_TIMEOUT_MS`              | `2_000`                                                                  | `telemetry.ts`       |
| `TOKEN_EXPIRY_WARNING_MS`           | `7 * DAY_MS`                                                             | `token-expiry.ts`    |
| `TOKEN_EXPIRY_SWEEP_LIMIT`          | `100`                                                                    | `token-expiry.ts`    |
| `TOKEN_EXPIRY_NOTE_LIMIT`           | `500`                                                                    | `token-expiry.ts`    |
| `API_TOKEN_PREFIX`                  | `'lwt_'`                                                                 | `tokens.ts`          |
| `LEGACY_API_TOKEN_PREFIX`           | `'lvd_'`                                                                 | `tokens.ts`          |
| `MAX_API_TOKENS_PER_ACCOUNT`        | `20`                                                                     | `tokens.ts`          |
| `TOKEN_NAME_MAX_LENGTH`             | `80`                                                                     | `tokens.ts`          |
| `LAST_USED_STAMP_WINDOW_MS`         | `60_000`                                                                 | `tokens.ts`          |
| `MAX_LIVE_TOKEN_IDS`                | `100`                                                                    | `tokens.ts`          |
| `WORKBENCH_TICKET_TTL_MS`           | `60_000`                                                                 | `routes.ts`          |
| `WORKBENCH_SESSION_TTL_MS`          | `8 * 60 * 60 * 1000`                                                     | `routes.ts`          |
| `WORKBENCH_TICKETS_PER_MINUTE`      | `30`                                                                     | `routes.ts`          |
| `WORKBENCH_NAME_MAX_LENGTH`         | `40`                                                                     | `routes.ts`          |
| `WORKBENCH_ORIGIN_MAX_LENGTH`       | `255`                                                                    | `routes.ts`          |
| `WORKBENCH_POLL_INTERVAL_S`         | `5`                                                                      | `routes.ts`          |
| `WORKBENCH_SESSION_PREFIX`          | `'lvw_'`                                                                 | `store.ts`           |
| `WORKBENCH_TICKET_BYTES`            | `16`                                                                     | `store.ts`           |
| `WORKBENCH_PAIRING_CODE_BYTES`      | `16`                                                                     | `store.ts`           |
| `WORKBENCH_SESSION_SECRET_BYTES`    | `32`                                                                     | `store.ts`           |
| `WORKBENCH_PAIRING_TTL_MS`          | `10 * 60 * 1000`                                                         | `store.ts`           |
| `WORKBENCH_SESSION_GRACE_MS`        | `24 * 60 * 60 * 1000`                                                    | `store.ts`           |
| `WORKBENCH_QUOTA_MAX`               | `1_000`                                                                  | `store.ts`           |
| `WORKBENCH_SESSION_ROOMS_MAX`       | `500`                                                                    | `store.ts`           |
| `WORKBENCH_TICKET_PATTERN`          | `/^[A-Za-z0-9_-]{22}\.[0-9a-f]{64}$/`                                    | `store.ts`           |
| `WORKBENCH_SESSION_PATTERN`         | `/^lvw_[A-Za-z0-9_-]{43}\.[0-9a-f]{64}$/`                                | `store.ts`           |
| `WORKBENCH_CODE_PATTERN`            | `/^[A-Za-z0-9_-]{22}$/`                                                  | `store.ts`           |
| `WORKSPACE_TOKEN_PATH`              | `'/workspace-token'`                                                     | `workspace-token.ts` |
| `WORKSPACE_TOKEN_TTL_SECONDS`       | `15 * 60`                                                                | `workspace-token.ts` |
| `ACCOUNT_NAME_MAX_LENGTH`           | `64`                                                                     | `account-name.ts`    |
| `ACCOUNT_COLOUR_MAX_LENGTH`         | `64`                                                                     | `account-name.ts`    |
| `TOKEN_VALID_FOR_MS`                | `60_000`                                                                 | `account.ts`         |
| `TOKEN_INVALID_FOR_MS`              | `10_000`                                                                 | `account.ts`         |
| `MAX_LIVE_TOKEN_IDS`                | `100`                                                                    | `account.ts`         |
| `MAX_PROFILE_IDS`                   | `100`                                                                    | `account.ts`         |
| `MAX_EMAIL_IDS`                     | `100`                                                                    | `account.ts`         |
| `MAX_NOTIFY_OWNERS`                 | `100`                                                                    | `account.ts`         |
| `INVITATIONS_TTL_MS`                | `30_000`                                                                 | `invitations.ts`     |
| `INVITATIONS_CACHE_MAX`             | `500`                                                                    | `invitations.ts`     |
| `MILESTONE_ITEM_COUNTS`             | `[10]`                                                                   | `notify.ts`          |
| `JOIN_NOTIFY_THROTTLE_MS`           | `15 * 60 * 1000`                                                         | `notify.ts`          |
| `NOTIFY_EMAIL_DEDUPE_MS`            | `24 * 60 * 60 * 1000`                                                    | `notify.ts`          |
| `NOTIFY_EMAILS_PER_SENDER_PER_HOUR` | `60`                                                                     | `notify.ts`          |
| `NOTIFY_RATE_WINDOW_MS`             | `60 * 60 * 1000`                                                         | `notify.ts`          |
| `GUEST_STATE_PATTERN`               | `/^[A-Za-z0-9_-]{8,200}$/`                                               | `oauth.ts`           |
| `SILENT_SESSION_KEY`                | `'liveworkspace:silent-sign-in'`                                         | `silent.ts`          |
| `SILENT_GUARD_MAX_AGE_SECONDS`      | `120`                                                                    | `silent.ts`          |
| `SIGNED_OUT_MAX_AGE_SECONDS`        | `400 * 24 * 3600`                                                        | `silent.ts`          |
| `SILENT_RETURN_MAX_LENGTH`          | `1500`                                                                   | `silent.ts`          |
| `WORKBENCH_SESSION_VALID_FOR_MS`    | `60_000`                                                                 | `workbench.ts`       |
| `WORKBENCH_SESSION_INVALID_FOR_MS`  | `10_000`                                                                 | `workbench.ts`       |
| `WORKBENCH_SESSION_CACHE_MAX`       | `1_000`                                                                  | `workbench.ts`       |
| `EMAIL_SEND_TIMEOUT_MS`             | `10_000`                                                                 | `index.ts`           |
| `NOTIFICATION_ROWS`                 | `(object or list, see file)`                                             | `account.ts`         |
| `IN_APP_ROWS`                       | `(object or list, see file)`                                             | `account.ts`         |
| `PRIVACY_ROWS`                      | `(object or list, see file)`                                             | `account.ts`         |
| `ACCESSIBILITY_ROWS`                | `(object or list, see file)`                                             | `account.ts`         |
| `ACCOUNT_TOGGLES`                   | `(object or list, see file)`                                             | `account.ts`         |
| `ACCOUNT_KEYS`                      | `new Set(ACCOUNT_TOGGLES.map((row) => row.key))`                         | `account.ts`         |
| `EDITOR_ONLY_KEYS`                  | `(object or list, see file)`                                             | `account.ts`         |
| `CATALOGUE`                         | `${JSON.stringify(catalogue, null, 2)}`                                  | `catalogue.ts`       |
| `CATALOGUE`                         | `(object or list, see file)`                                             | `livedesign.ts`      |
| `CATALOGUE`                         | `(object or list, see file)`                                             | `livediagram.ts`     |
| `CATALOGUE`                         | `(object or list, see file)`                                             | `livedocuments.ts`   |
| `CATALOGUE`                         | `(object or list, see file)`                                             | `liveplanner.ts`     |
| `PLATFORM_PLACES`                   | `(object or list, see file)`                                             | `common.ts`          |
| `DEVICE_PREFERENCES`                | `(object or list, see file)`                                             | `device.ts`          |
| `COMMON_SETTING_KEYS`               | `(object or list, see file)`                                             | `index.ts`           |
| `ALL_SETTING_KEYS`                  | `(object or list, see file)`                                             | `index.ts`           |
| `PRESENCE_COLOURS`                  | `(object or list, see file)`                                             | `presence.ts`        |
| `PRESENCE_COLOUR_VALUES`            | `PRESENCE_COLOURS.map((c) => c.value)`                                   | `presence.ts`        |
| `PROFILE_NAME_MAX`                  | `120`                                                                    | `presence.ts`        |

## Testing

Suites run against an in-memory D1 (`test-d1.ts`). Each feature file names the suites that pin it; these pin the
Worker as a whole:

| Test                                                                  | Pins                                                                                                                                                                         |
| --------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `liveworkspace/apps/accounts/src/account-api.test.ts` (33)            | the account API's doors: signed in, by bearer, for the apps                                                                                                                  |
| `liveworkspace/apps/accounts/src/index-purge.test.ts` (8)             | `purgeFromIndex`, `retryPendingPurges`, `deleteAccount`                                                                                                                      |
| `liveworkspace/apps/accounts/src/drive-disconnect.test.ts` (4)        | `disconnectDrive`: done, skipped, failed, a `404`                                                                                                                            |
| `liveworkspace/apps/accounts/src/telemetry.test.ts` (7)               | server events: held, bounded, one batch per app, keys                                                                                                                        |
| `liveworkspace/apps/accounts/src/index-timeline.test.ts` (16)         | API token and team events; sending to the index; the outbox's bound                                                                                                          |
| `liveworkspace/apps/accounts/src/ids.test.ts` (1)                     | account ids keep the `user_` shape                                                                                                                                           |
| `liveworkspace/apps/accounts/scripts/import-clerk-users.test.ts`      | the Clerk import ([012-migrate](../../012-migrate/blueprints/migrate.md))                                                                                                    |
| `packages/auth-client/src/*.test.ts`                                  | each app's side: OAuth, silent sign-in, return paths, verification, the account API client, invitations, notify rules, account names, the workbench client, the e2e stand-in |
| `packages/settings/src/*.test.ts`, `packages/email/src/index.test.ts` | the settings catalogue and common keys; the email binding wrapper                                                                                                            |

## Defaults ledger

- `ACC1`: the spec names no cron minute; the daily run is `17 9 * * *` and the frequent one `*/15 * * * *`.
- `ACC2`: closing an account answers `200` once the account is gone, whether or not the index, the workbench or
  Drive took their part; the index's is retried, Drive's is not.
- `ACC3`: a telemetry event with no app (someone who signed up on liveworkspace.app) is not counted.
