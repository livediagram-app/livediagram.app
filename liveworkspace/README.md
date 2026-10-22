# liveworkspace-auth

One account across livediagram, liveplanner and the rest of liveworkspace. People sign in once at
**accounts.liveworkspace.app** with a code sent to their email, and every app trusts that sign-in.

It replaces Clerk. It runs on Cloudflare Workers + D1, using [Better Auth](https://www.better-auth.com)
with its email-code (`emailOTP`) and OAuth 2.1 / OpenID Connect provider plugins.

```
apps/accounts          the Worker at accounts.liveworkspace.app: sign-in page, codes, tokens, JWKS
packages/auth-client   what each app imports: sign-in redirect, code swap, refresh, token check
docs/                  adding an app, moving off Clerk
```

## How signing in works

The apps live on different sites (`livediagram.app`, `liveplanner.app`), so they can't share a
cookie. Each app sends the browser to the accounts site and gets it back with a one-time code:

1. The app redirects to `accounts.liveworkspace.app/api/auth/oauth2/authorize` (PKCE, `state`).
2. Not signed in there yet? The person types their email, gets a 6-digit code, and enters it.
   The accounts site now has its own first-party cookie.
3. The browser lands on the app's `/auth/callback?code=…`. The app's Worker swaps the code for
   an access token, a refresh token and an ID token.
4. The app's API checks access tokens locally against the published keys
   (`/api/auth/jwks`), the same way it checks `CLERK_JWKS_URL` today. There's no per-request call.
5. Signing in to a second app repeats step 1, finds the accounts cookie, and goes straight back
   with no code. That's single sign-on across all the apps.

Access tokens last an hour and name the app's API as their audience, so a livediagram token is
refused by liveplanner. They carry `sub` (the account id), `email` and `email_verified`.

## Local development

```sh
corepack pnpm install
cd apps/accounts
cp .dev.vars.example .dev.vars
corepack pnpm db:migrate:local
corepack pnpm dev                     # http://localhost:8787/sign-in
```

Locally, emails aren't sent. Each code email is printed in the `pnpm dev` output. Turnstile uses
Cloudflare's always-pass test keys.

To run the whole flow (register a client, request and enter a code, swap it, verify, sign in again
without a code, refresh) against the running Worker:

```sh
corepack pnpm dev > dev.log 2>&1 &
DEV_LOG=dev.log corepack pnpm e2e:local
```

Other checks, from the repo root: `corepack pnpm test`, `corepack pnpm typecheck`, `corepack pnpm lint`.

## First deploy

1. Create the databases and put their ids in `apps/accounts/wrangler.toml` (they are placeholders):
   `wrangler d1 create liveworkspace-accounts` (and `liveworkspace-accounts-staging`).
2. Turn on Email Sending for the domain: `wrangler email sending enable liveworkspace.app`.
3. Create a Turnstile widget for `accounts.liveworkspace.app` and put its site key in
   `TURNSTILE_SITE_KEY`.
4. Set the secrets: `BETTER_AUTH_SECRET` (`openssl rand -base64 32`), `TURNSTILE_SECRET_KEY`,
   and `ADMIN_TOKEN` (`openssl rand -hex 32`).
5. `corepack pnpm db:migrate:remote`, then `corepack pnpm deploy`.
6. Register each app (below).

## Adding an app

1. Add the app's API to `RESOURCES` in `apps/accounts/src/resources.ts` and deploy.
2. Register it once per environment. The secret is printed once, so store it straight away as
   the app's Worker secret:

   ```sh
   ADMIN_TOKEN=… node apps/accounts/scripts/register-client.ts \
     --accounts https://accounts.liveworkspace.app \
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
- **Registering clients:** only `POST /internal/clients` with `ADMIN_TOKEN` can do it. Better
  Auth's default would let any signed-in account register its own OAuth client, so
  `clientPrivileges` refuses everything without the admin token. Dynamic registration stays off.
- **Account ids** keep Clerk's `user_` prefix (`src/ids.ts`). Imported accounts keep their exact
  Clerk id, and livediagram's guard against an account id sent as a guest id keeps working.
- **The sign-in pages** can't be framed, send no Referer (the URL carries the signed OAuth
  request), and load scripts only from this origin and Turnstile.

## Performance

These were measured locally with `wrangler dev`. Production numbers will differ but should be in
the same range.

|                                            |                                                                                                       |
| ------------------------------------------ | ----------------------------------------------------------------------------------------------------- |
| Worker bundle                              | 2.95 MB, 491 KiB gzipped (well under the 10 MB limit; Better Auth, zod and kysely make up most of it) |
| Startup (`wrangler check startup`)         | 211 ms CPU, inside the 1 s limit. The Better Auth instance is built once per isolate, not per request |
| Sign-in page / authorize / JWKS            | 5 / 12 / 8 ms                                                                                         |
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
- **Google sign-in:** Better Auth's Google provider can be added next to codes if you want it back.
- **An account page** for changing your email or deleting your account.
- **Cleanup of expired rows:** nothing yet sweeps expired codes, sessions and tokens out of D1.
  A daily cron can delete rows past `expiresAt` once the tables grow.
