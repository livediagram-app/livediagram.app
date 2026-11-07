# Sign-in

One account across every liveworkspace app. People sign in once at **liveworkspace.app/sign-in** with a code sent
to their email or with Google, and every app trusts that sign-in. The accounts Worker
(`liveworkspace/apps/accounts`) runs on Cloudflare Workers and D1, using [Better Auth](https://www.better-auth.com)
with its email-code (`emailOTP`), Google and OAuth 2.1 / OpenID Connect provider plugins. Teams, API tokens,
guests, settings, profiles and the rest of the account are in [accounts.md](accounts.md).

The accounts Worker is an API only, on liveworkspace.app's origin: it is routed `/api/auth/*`, `/api/account/*`
and the two discovery documents under `/.well-known/` (`apps/accounts/wrangler.toml`), and the site
([site.md](../010-site/site.md)) keeps every other path. The issuer is `https://www.liveworkspace.app/api/auth`.

## How signing in works

The apps live on different sites (`livediagram.app`, `liveplanner.app`), so they can't share a
cookie. Each app sends the browser to the accounts site and gets it back with a one-time code:

1. The app redirects to `liveworkspace.app/api/auth/oauth2/authorize` (PKCE, `state`).
2. Not signed in there yet? The person continues with Google, or types their email, gets a
   6-digit code, and enters it, on the app's own address (`livediagram.app/sign-in`, served by the
   app's router). One quick hop to liveworkspace.app then gives it its own first-party cookie
   ([accounts.md](accounts.md#signing-in-on-the-apps-own-address)).
3. The browser lands on the app's `/auth/callback?code=…`. The app's Worker swaps the code for
   an access token, a refresh token and an ID token.
4. The app's API checks access tokens locally against the published keys
   (`/api/auth/jwks`). There's no per-request call.
5. Signing in to a second app repeats step 1, finds the accounts cookie, and goes straight back
   with no code. That's single sign-on across all the apps.

## The sign-in and registration pages

`/sign-in` and `/sign-up` are livediagram's account pages, in liveworkspace's slate: the site's
header, the card, and beside it what an account adds (`apps/site/components/account/`). They are
static pages that call this API; on arrival they ask it for the deployment's options
(`GET /api/auth/sign-in-options`: the Turnstile site key, whether Google is set up, and the name
length), so one build of the site serves production and staging. Both ask for an email, then a
6-digit code. Registration also asks for a **first and last name**, stored as `givenName` and
`familyName` on the account (with `name` the two joined). Someone who signs in with a code to an
address that has no name yet is asked for one after the code, before going back to the app.
The card's line under the heading reads "One free account that works for every app in liveworkspace."

**Turnstile** checks once per code sent. A token goes with each send and is spent by it; the widget resets only
when the next send needs a fresh token (Resend, or a new address), so the code step doesn't show the widget again
straight after the email step's check.

**Continue with Google** sits above the email form on both pages when the Worker has a Google
OAuth client (`GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET`; without them the button isn't shown).
It takes Google's first and last name and leaves its picture behind, and an address that already
has an account (made with a code) signs in to that same account. The page hands the signed OAuth
request to `/sign-in/social`, and the provider finishes it when Google sends the browser back.
From `/sign-up`, the provider sends the browser back to `/sign-up`, which sees it is signed in and
finishes the registration as the email form does.

An app's "Create account" opens `/sign-up` by sending `prompt=create` to the authorize endpoint.
Once the account is made, the page tells the provider with `POST /oauth2/continue`
(`created: true`), which then returns to the app.

The ID token carries `name`, `given_name`, `family_name`, `email` and `email_verified`. Better
Auth's provider normally sends these only from `/userinfo`, so `customIdTokenClaims` adds them.

Access tokens last an hour and name the app's API as their audience, so a livediagram token is
refused by liveplanner. They carry `sub` (the account id), `email` and `email_verified`.

## Closing an account

An app's Delete Account closes the whole liveworkspace account, for every app. Being signed in is not enough on its
own: a session left open on a shared machine would let anyone close it. So closing needs a **6-digit code sent to the
account's email**, the same kind of code that signs in, and only the person who reads that inbox can give it.

1. **The code is sent.** The app's Worker asks `POST /api/auth/delete-account/code` with its client credentials
   (Basic, as for the token endpoint) and the person's access token (`sendDeletionCode` in `@liveworkspace/auth-client`).
   The code goes to the account's own address, never one the caller names, in the brand of the app that asked. A new
   code replaces the one before it.
2. **The code is checked, before anything is deleted.** The app's Worker sends the code it was given to
   `POST /api/auth/delete-account/check` (`checkDeletionCode`). A wrong code deletes nothing in any app.
3. **The app deletes its own data, then closes the account.** `POST /api/auth/delete-account` takes the same client
   credentials, the access token and the code (`closeAccount`), checks the code again and spends it, then closes the
   account. The check here is the one that counts: no app can close an account without the code, whatever it checked
   itself.

The Worker checks the client credentials and the token through the provider's introspection on all three, so a token
alone sends, checks and closes nothing, and an app can act only for someone signed in to it. Deleting the user removes
its sessions, its Google link, and every app's tokens and consents; refreshing then fails in every app, and an access
token already issued runs out within the hour.

Every app's own data for the account goes with the close: the closing app deletes its own first, and the
index purges every app's items and tells each app what was purged ([accounts.md](accounts.md#closing-an-account)).

## Signing out

Signing out in any app, or on liveworkspace.app, ends the liveworkspace session and every app's session in that
browser, so the next sign-in asks for a code or Google again. The app's Worker ends the session server to server
(`POST /api/auth/end-session`), then the browser takes one hop through `GET /api/auth/end-session`, which clears the
liveworkspace cookie and comes back to the app ([accounts.md](accounts.md#signing-out)).

## Deploys

CI's deploy ships the accounts Worker ([docs/ci.md](../../../../docs/ci.md#deploys) at the repository root):
staging on every push to `main`, production through the manual gate. It is in the first tier, so its D1 migrations
(`apps/accounts/migrations`, databases `liveworkspace-accounts` and `liveworkspace-accounts-staging`, ids in
`apps/accounts/wrangler.toml`) apply before its code. Email goes out through the `EMAIL` binding to Cloudflare Email
Service, with no key ([email.md](email.md)).

Because the migrations always apply before the code, the Worker never checks the database's tables while it runs.
Better Auth's own check would read D1's schema on every Worker's first request, before answering, which made the
first sign-in after a quiet spell (and the status page's Accounts check) wait on several round trips to the
database's region. The same check runs in CI instead, against a database built from the migrations, so a migration
that leaves out a table or column Better Auth needs still fails before it ships.

Better Auth answers a database failure itself, as a 500 or as no session. When D1 is unavailable during a request
and Better Auth's answer is an error, the Worker answers `503 storage_unavailable` instead
([architecture.md](../002-architecture/architecture.md) "When a request fails"), so an outage is retryable and never
reads as someone signed out.

What a deploy never writes, set once per environment and kept across deploys:

- **Secrets**, with `wrangler secret put`: `BETTER_AUTH_SECRET` (`openssl rand -base64 32`), `TURNSTILE_SECRET_KEY`,
  `ADMIN_TOKEN` (`openssl rand -hex 32`), and for Google `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET`, plus the
  other services' keys listed at the top of `apps/accounts/wrangler.toml`.
- **The Turnstile widget** for `liveworkspace.app` and every app's hostnames ([accounts.md](accounts.md#before-deploy)),
  its site key in `TURNSTILE_SITE_KEY`.
- **The Google OAuth client** (Web application) in Google Cloud, with
  `https://www.liveworkspace.app/api/auth/callback/google` as its redirect URI (and the staging one), and the apps' own
  addresses ([accounts.md](accounts.md#before-deploy)).
- **Each app's OAuth client**, registered once per environment (below).

## Registering an app

1. Add the app's API to `RESOURCES` in `apps/accounts/src/resources.ts`; CI's deploy ships it. An app can be
   registered before its launch, when nothing a person sees lists it yet
   ([Registered before launch](../002-architecture/integrating-an-app.md#registered-before-launch)), as livehuddle's
   API is in `RESOURCES` that way.
2. Register it once per environment. The secret is printed once, so store it straight away as
   the app's Worker secret:

   ```sh
   ADMIN_TOKEN=… node apps/accounts/scripts/register-client.ts \
     --accounts https://www.liveworkspace.app \
     --name livediagram \
     --app livediagram.app \
     --redirect https://www.livediagram.app/auth/callback \
     --redirect https://livediagram.app/auth/callback \
     --redirect https://livediagram.app/auth/guest \
     --resource https://livediagram.app/api
   ```

   `https://<app>/auth/guest` is where the guest hand-off returns
   ([accounts.md](accounts.md#guests)); an app registered before it needs it added to its
   client's `redirectUris`. `--app` is the app the client is, which keeps it to that app's own
   settings and records ([accounts.md](accounts.md#which-app-a-client-is)); a client
   registered without one is given it with `scripts/map-clients.ts`.

   A database that doesn't take the app yet (a local one built before the migration that added the app, such as
   `0018_livehuddle.sql`) refuses to record which app the client is. Registration then removes the client it just
   made, so nothing is left half-registered, and answers `500 client_app_refused`, naming the app and saying to
   apply the migrations. Locally, each service's `dev` script applies its local migrations before it starts, so a
   database catches up on its own; registering again then works.

3. Wire the app up: [integrating-an-app.md](../002-architecture/integrating-an-app.md).

## Local clients

A fresh checkout (a new clone, or a worktree an agent works in) signs in and makes guests with no manual steps. Each
app has a fixed local OAuth client, kept in one fixture (`apps/accounts/scripts/local-clients.ts`):

| App           | Client id             | Redirect URIs (its router)                                                    |
| ------------- | --------------------- | ----------------------------------------------------------------------------- |
| livediagram   | `local-livediagram`   | `http://localhost:3100/api/auth/callback`, `http://localhost:3100/auth/guest` |
| liveplanner   | `local-liveplanner`   | the same on 3200                                                              |
| livedocuments | `local-livedocuments` | the same on 3300                                                              |
| livedesign    | `local-livedesign`    | the same on 3400                                                              |
| livehuddle    | `local-livehuddle`    | the same on 3500                                                              |

Each secret is `local-<app>-client-secret`, the resource `http://localhost/api` (development's only one), and each
client is recorded as its app ([accounts.md](accounts.md#which-app-a-client-is)). They are local values, as
`ADMIN_TOKEN=local-admin-token` is: the fixture only ever writes a `--local` database, and production and staging take
no `http://localhost/api` resource, so the ids mean nothing there.

**The accounts Worker's `dev` script** runs three steps before `wrangler dev`:

1. **`.dev.vars`.** When there is none, it is copied from `.dev.vars.example` (`packages/api-kit/scripts/dev-vars.ts`).
   An existing `.dev.vars` is never changed: the copy is an exclusive create, so it can't overwrite one even in a race.
   Every liveworkspace service with a `.dev.vars.example` (community, Drive, export, the index, media, telemetry) runs
   the same step first in its own `dev` script.
2. **Migrations.** `wrangler d1 migrations apply --local`, as before.
3. **The local clients** (`scripts/seed-local-clients.ts`, also `corepack pnpm db:seed:local`). One SQL batch upserts
   the five clients, their resource and their apps. A client that is already there gets the fixture's secret and
   redirect URIs back, so a hand edit or an older copied database is put right on the next start; clients anyone
   registered with `register-client.ts` are left as they are. A local database copied in from another checkout picks
   the clients up the same way when the Worker restarts. It only ever passes `--local`.

`LOCAL_CLIENT_ORIGINS` adds redirect URIs for a stack run on other ports
(`LOCAL_CLIENT_ORIGINS=livedesign.app=http://localhost:3660`, several comma-separated; anything but an app and a
loopback `http` origin is skipped with a warning), and `--persist-to <dir>` seeds a database whose state lives
elsewhere.

**Each app's api** has a `.dev.vars.example` naming its local client (`ACCOUNTS_CLIENT_ID`, `ACCOUNTS_CLIENT_SECRET`),
`ACCOUNTS_URL=http://localhost:3000`, `API_RESOURCE`, `AUTH_ORIGIN` (its router) and the local index (`INDEX_ORIGIN`,
`INDEX_KEY`). Its `dev` script copies it to `.dev.vars` when there is none, but only once the checkout's accounts
Worker has a `.dev.vars` (it has run `dev:workspace`), because an api that names an accounts Worker sends every guest
there: started alone, the editor keeps working with no sign-in, as before. Run `dev:workspace` first, or restart the
app after it. A test checks each app's example against the fixture, so the two can't drift.

## Security notes

- **Guessing codes:** each code is 6 digits, lasts 10 minutes, allows 3 tries and is stored
  hashed. Requesting codes needs Turnstile. Workers Rate Limiting caps code requests at 10 a
  minute per IP, and at 3 a minute per email address, so nobody can flood an inbox from many
  IPs. Better Auth's own limiter is off: on Workers it would count per isolate, which an attacker
  can spread across.
- **Registering clients:** only `POST /api/auth/internal/clients` with `ADMIN_TOKEN` can do it. Better
  Auth's default would let any signed-in account register its own OAuth client, so
  `clientPrivileges` refuses everything without the admin token. Dynamic registration stays off.
- **Account ids** keep the `user_` prefix (`src/ids.ts`). Imported accounts keep their exact
  Clerk id, and livediagram's guard against an account id sent as a guest id keeps working.
- **Closing an account** needs an app's client secret, an access token issued to that app, and the code emailed to the
  account. The deletion code keeps the sign-in code's rules: 6 digits, 10 minutes, 3 tries (a correct check gives the
  tries back, so checking and then closing with it works), stored hashed in Better Auth's `verification` table. Each
  try counts in one atomic write, so guesses sent at once can't share a count. Sending one is held to the sign-in
  code's per-address limit (3 a minute, shared with signing in, so the two together can't flood an inbox); checking
  and closing to 10 a minute per account. It needs no Turnstile: only an app's server, for someone signed in to it, can
  ask.
- **Names** are trimmed and cut to 80 characters whenever an account is created or updated.
- **Signing in on an app's address:** the hand-off that brings the session to liveworkspace.app is
  single-use, lasts 60 seconds, is stored hashed, is bound to the browser that started the sign-in
  (a nonce cookie) and returns only to the app's own registered redirect URIs. The sign-in's
  cookies on the app's address are renamed, scoped to `/api/workspace/auth` and gone within 15
  minutes. The code limit per IP counts the address the app's router names
  (`X-Liveworkspace-Client-IP`): a caller going straight to the Worker could name any address
  there, but sending a code still needs Turnstile and the per-email limit holds.
- **The sign-in pages** can't be framed, send no Referer (the URL carries the signed OAuth
  request), and load scripts only from this origin and Turnstile (the site's Trusted Types policy).

## Performance

These were measured locally with `wrangler dev`, through the site's dev server. Production numbers
will differ but should be in the same range. The sign-in pages themselves are static files now:
see [site.md](../010-site/site.md) for their weight.

|                                            |                                                                                                       |
| ------------------------------------------ | ----------------------------------------------------------------------------------------------------- |
| Worker bundle                              | 2.95 MB, 490 KiB gzipped (well under the 10 MB limit; Better Auth, zod and kysely make up most of it) |
| Startup (`wrangler check startup`)         | 211 ms CPU, inside the 1 s limit. The Better Auth instance is built once per isolate, not per request |
| Sign-in options / authorize / JWKS         | 4 / 12 / 11 ms (options cached at the edge for 5 minutes)                                             |
| Send code / sign in with code / token swap | 69 / 30 / 32 ms average                                                                               |

There is no cost per app request: apps check tokens against cached keys, and the accounts
Worker is only involved at sign-in and on an hourly refresh. Each sign-in writes to D1 a
handful of times (code, session, authorization code, tokens).

**Startup is the risk to watch.** It grows with Better Auth upgrades. If it nears the 1 s
limit, start by checking which plugins are loaded.

## Known gaps

- **Email change and closing from liveworkspace.app:** the Settings panel's Profile edits the name and colour,
  but there is no change-email flow, and closing an account goes through an app's server
  ([site.md](../010-site/site.md#settings)).
- **Expired rows:** the daily cron sweeps team invitations, idle guests and token expiry warnings, but nothing
  deletes expired codes, sessions and OAuth tokens from D1.
