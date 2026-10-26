# Sign-in

One account across every liveworkspace app. People sign in once at **liveworkspace.app/sign-in** with a code sent
to their email or with Google, and every app trusts that sign-in. The accounts Worker
(`liveworkspace/apps/accounts`) runs on Cloudflare Workers and D1, using [Better Auth](https://www.better-auth.com)
with its email-code (`emailOTP`), Google and OAuth 2.1 / OpenID Connect provider plugins. Teams, API tokens,
guests, settings, profiles and the rest of the account are in [accounts.md](accounts.md).

The accounts Worker is an API only, on liveworkspace.app's origin: it is routed `/api/auth/*`, `/api/account/*`
and the two discovery documents under `/.well-known/` (`apps/accounts/wrangler.toml`), and the site
([site.md](../010-site/site.md)) keeps every other path. The issuer is `https://liveworkspace.app/api/auth`.

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

An app's Delete Account closes the whole liveworkspace account, for every app. The app's Worker
deletes its own data first, then sends `POST /api/auth/delete-account` with its client
credentials (Basic, as for the token endpoint) and the person's access token
(`closeAccount` in `@liveworkspace/auth-client`). The Worker checks both through the provider's
introspection, so a token alone closes nothing, and an app can close only the account of someone
signed in to it. Deleting the user removes its sessions, its Google link, and every app's tokens
and consents; refreshing then fails in every app, and an access token already issued runs out
within the hour.

Every app's own data for the account goes with the close: the closing app deletes its own first, and the
index purges every app's items and tells each app what was purged ([accounts.md](accounts.md#closing-an-account)).

## Deploys

CI's deploy ships the accounts Worker ([docs/ci.md](../../../../docs/ci.md#deploys) at the repository root):
staging on every push to `main`, production through the manual gate. It is in the first tier, so its D1 migrations
(`apps/accounts/migrations`, databases `liveworkspace-accounts` and `liveworkspace-accounts-staging`, ids in
`apps/accounts/wrangler.toml`) apply before its code. Email goes out through the `EMAIL` binding to Cloudflare Email
Service, with no key ([email.md](email.md)).

What a deploy never writes, set once per environment and kept across deploys:

- **Secrets**, with `wrangler secret put`: `BETTER_AUTH_SECRET` (`openssl rand -base64 32`), `TURNSTILE_SECRET_KEY`,
  `ADMIN_TOKEN` (`openssl rand -hex 32`), and for Google `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET`, plus the
  other services' keys listed at the top of `apps/accounts/wrangler.toml`.
- **The Turnstile widget** for `liveworkspace.app` and every app's hostnames ([accounts.md](accounts.md#before-deploy)),
  its site key in `TURNSTILE_SITE_KEY`.
- **The Google OAuth client** (Web application) in Google Cloud, with
  `https://liveworkspace.app/api/auth/callback/google` as its redirect URI (and the staging one), and the apps' own
  addresses ([accounts.md](accounts.md#before-deploy)).
- **Each app's OAuth client**, registered once per environment (below).

## Registering an app

1. Add the app's API to `RESOURCES` in `apps/accounts/src/resources.ts`; CI's deploy ships it.
2. Register it once per environment. The secret is printed once, so store it straight away as
   the app's Worker secret:

   ```sh
   ADMIN_TOKEN=… node apps/accounts/scripts/register-client.ts \
     --accounts https://liveworkspace.app \
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

3. Wire the app up: [integrating-an-app.md](../002-architecture/integrating-an-app.md).

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
- **Closing an account** needs an app's client secret and an access token issued to that app.
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

- **Sign-out everywhere:** an app drops its own tokens and revokes them at `/api/auth/oauth2/revoke`;
  ending the accounts session as well would need `enable_end_session` on the clients and a sign-out link to
  the provider's end-session endpoint.
- **Email change and closing from liveworkspace.app:** the Settings panel's Profile edits the name and colour,
  but there is no change-email flow, and closing an account goes through an app's server
  ([site.md](../010-site/site.md#settings)).
- **Expired rows:** the daily cron sweeps team invitations, idle guests and token expiry warnings, but nothing
  deletes expired codes, sessions and OAuth tokens from D1.
