# liveworkspace-auth

One account across livediagram, liveplanner and the rest of liveworkspace. People sign in once at
**liveworkspace.app/sign-in** with a code sent to their email, and every app trusts that sign-in.

It replaces Clerk. It runs on Cloudflare Workers + D1, using [Better Auth](https://www.better-auth.com)
with its email-code (`emailOTP`), Google and OAuth 2.1 / OpenID Connect provider plugins.

liveworkspace.app is one static website ([docs/site.md](docs/site.md)): the front door, the
telemetry dashboard, and the sign-in, registration and consent pages. The accounts Worker is an
API only, on the same origin: it is routed `/api/auth/*` and the two discovery documents under
`/.well-known/` (`apps/accounts/wrangler.toml`), and the site keeps every other path. The issuer
is `https://liveworkspace.app/api/auth`.

```
apps/site              liveworkspace.app: every page, the sign-in pages included (a Next static export)
apps/accounts          the accounts API at liveworkspace.app/api/auth: codes, Google, tokens, JWKS
packages/auth-client   what each app imports: sign-in redirect, code swap, refresh, token check
docs/                  the site, adding an app, moving off Clerk, every product's comparison pages
```

Every app's logo lists liveworkspace's sites on hover: see [docs/site-switcher.md](docs/site-switcher.md).

liveworkspace also runs every app's anonymous telemetry, its API at liveworkspace.app/api/telemetry
and its dashboard at liveworkspace.app/telemetry: see
[docs/telemetry.md](docs/telemetry.md).

It holds every app's Community listings too, its API at liveworkspace.app/api/community; each app
hosts its own Community pages, which read it. See [docs/community.md](docs/community.md).

And it keeps every app's uploaded images, its API at liveworkspace.app/api/media, so a person's
pictures follow them from app to app. Each app still decides who may see one and serves the bytes
itself. See [docs/media.md](docs/media.md).

## How signing in works

The apps live on different sites (`livediagram.app`, `liveplanner.app`), so they can't share a
cookie. Each app sends the browser to the accounts site and gets it back with a one-time code:

1. The app redirects to `liveworkspace.app/api/auth/oauth2/authorize` (PKCE, `state`).
2. Not signed in there yet? The person continues with Google, or types their email, gets a
   6-digit code, and enters it. liveworkspace.app now has its own first-party cookie.
3. The browser lands on the app's `/auth/callback?code=…`. The app's Worker swaps the code for
   an access token, a refresh token and an ID token.
4. The app's API checks access tokens locally against the published keys
   (`/api/auth/jwks`), the same way it checks `CLERK_JWKS_URL` today. There's no per-request call.
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

Apps that keep their own data per account will need telling when another app closes it. Only
liveplanner signs in here today, so nothing does that yet; the next app to join adds it.

## Local development

```sh
corepack pnpm install
cd apps/accounts
cp .dev.vars.example .dev.vars
corepack pnpm db:migrate:local
cd ../..
corepack pnpm dev:workspace           # http://localhost:3000/sign-in
```

`dev:workspace` runs the site on 3300 with the accounts Worker (8787), the telemetry Worker
(8790) and the Community Worker (8791) behind it: the site's dev server forwards `/api/auth/*` and `/.well-known/*` to the
accounts Worker, so the pages and the API share one origin, as on liveworkspace.app. That origin,
`http://localhost:3000`, is the Worker's `BASE_URL` and the issuer apps check locally.

Locally, emails aren't sent. Each code email is printed in the accounts Worker's output. Turnstile
uses Cloudflare's always-pass test keys.

To run the whole flow (register a client, request and enter a code, swap it, verify, sign in again
without a code, refresh, start a Google sign-in, close an account) through the site's origin, with
the site's dev server running and the accounts Worker's output in a file:

```sh
corepack pnpm dev > dev.log 2>&1 &   # in apps/accounts
DEV_LOG=dev.log corepack pnpm e2e:local
```

Other checks, from the repo root: `corepack pnpm test`, `corepack pnpm typecheck`, `corepack pnpm lint`.

## First deploy

1. Create the databases and put their ids in `apps/accounts/wrangler.toml` (they are placeholders):
   `wrangler d1 create liveworkspace-accounts` (and `liveworkspace-accounts-staging`).
2. Turn on Email Sending for the domain: `wrangler email sending enable liveworkspace.app`.
3. Create a Turnstile widget for `liveworkspace.app` and put its site key in
   `TURNSTILE_SITE_KEY`.
4. Set the secrets: `BETTER_AUTH_SECRET` (`openssl rand -base64 32`), `TURNSTILE_SECRET_KEY`,
   and `ADMIN_TOKEN` (`openssl rand -hex 32`).
5. For Google: create an OAuth client (Web application) in Google Cloud with
   `https://liveworkspace.app/api/auth/callback/google` as its redirect URI (and the staging one
   for staging), then set `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET`.
6. `corepack pnpm db:migrate:remote`, then `corepack pnpm deploy`.
7. Register each app (below).

## Adding an app

1. Add the app's API to `RESOURCES` in `apps/accounts/src/resources.ts` and deploy.
2. Register it once per environment. The secret is printed once, so store it straight away as
   the app's Worker secret:

   ```sh
   ADMIN_TOKEN=… node apps/accounts/scripts/register-client.ts \
     --accounts https://liveworkspace.app \
     --name livediagram \
     --redirect https://www.livediagram.app/auth/callback \
     --redirect https://livediagram.app/auth/callback \
     --resource https://livediagram.app/api
   ```

3. Wire the app up: [docs/integrating-an-app.md](docs/integrating-an-app.md).

## Security notes

- **Guessing codes:** each code is 6 digits, lasts 10 minutes, allows 3 tries and is stored
  hashed. Requesting codes needs Turnstile. Workers Rate Limiting caps code requests at 10 a
  minute per IP, and at 3 a minute per email address, so nobody can flood an inbox from many
  IPs. Better Auth's own limiter is off: on Workers it would count per isolate, which an attacker
  can spread across.
- **Registering clients:** only `POST /api/auth/internal/clients` with `ADMIN_TOKEN` can do it. Better
  Auth's default would let any signed-in account register its own OAuth client, so
  `clientPrivileges` refuses everything without the admin token. Dynamic registration stays off.
- **Account ids** keep Clerk's `user_` prefix (`src/ids.ts`). Imported accounts keep their exact
  Clerk id, and livediagram's guard against an account id sent as a guest id keeps working.
- **Closing an account** needs an app's client secret and an access token issued to that app.
- **Names** are trimmed and cut to 80 characters whenever an account is created or updated.
- **The sign-in pages** can't be framed, send no Referer (the URL carries the signed OAuth
  request), and load scripts only from this origin and Turnstile (the site's Trusted Types policy).

## Performance

These were measured locally with `wrangler dev`, through the site's dev server. Production numbers
will differ but should be in the same range. The sign-in pages themselves are static files now:
see [docs/site.md](docs/site.md) for their weight.

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

## Not done yet

- **Sign-out everywhere:** an app can drop its own tokens and revoke them at
  `/api/auth/oauth2/revoke`. Ending the accounts session as well needs `enable_end_session` on the
  clients and a sign-out link to the provider's end-session endpoint.
- **An account page** on liveworkspace.app for changing your name or email, or closing the account
  without going through an app.
- **Cleanup of expired rows:** nothing yet sweeps expired codes, sessions and tokens out of D1.
  A daily cron can delete rows past `expiresAt` once the tables grow.
