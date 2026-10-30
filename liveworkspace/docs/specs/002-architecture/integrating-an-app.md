# Integrating an app

What an app (livediagram, liveplanner, …) needs once it's registered ([sign-in.md](../003-accounts/sign-in.md#registering-an-app)).
It's written against livediagram's shape: a browser app sends `Authorization: Bearer <token>`
to an API Worker, and that token comes from the app's own Worker.

## Secrets and config on the app's Worker

| Name                              | Example                                                                                        |
| --------------------------------- | ---------------------------------------------------------------------------------------------- |
| `ACCOUNTS_URL`                    | `https://www.liveworkspace.app`                                                                |
| `ACCOUNTS_ISSUER`                 | `https://www.liveworkspace.app/api/auth` (the `issuer` in `/.well-known/openid-configuration`) |
| `ACCOUNTS_CLIENT_ID`              | from `register-client.ts`                                                                      |
| `ACCOUNTS_CLIENT_SECRET` (secret) | from `register-client.ts`                                                                      |
| `API_RESOURCE`                    | `https://livediagram.app/api`                                                                  |

## Three routes on the app's Worker

The refresh token lives in an `HttpOnly` cookie on the app's own domain. The browser never sees
it. It only ever holds a short-lived access token in memory.

```ts
import {
  authorizeUrl,
  createPkcePair,
  exchangeCode,
  randomState,
  refreshTokens,
} from '@liveworkspace/auth-client';

const credentials = (env: Env) => ({
  accountsUrl: env.ACCOUNTS_URL,
  clientId: env.ACCOUNTS_CLIENT_ID,
  clientSecret: env.ACCOUNTS_CLIENT_SECRET,
});
const callbackUrl = (request: Request) => new URL('/auth/callback', request.url).toString();

// GET /auth/sign-in → the accounts site
async function signIn(request: Request, env: Env) {
  const { verifier, challenge } = await createPkcePair();
  const state = randomState();
  const to = authorizeUrl({
    accountsUrl: env.ACCOUNTS_URL,
    clientId: env.ACCOUNTS_CLIENT_ID,
    redirectUri: callbackUrl(request),
    state,
    codeChallenge: challenge,
    resource: env.API_RESOURCE,
  });
  return new Response(null, {
    status: 302,
    headers: {
      location: to,
      'set-cookie': `lw_pkce=${state}.${verifier}; Path=/auth; HttpOnly; Secure; SameSite=Lax; Max-Age=600`,
    },
  });
}

// GET /auth/callback?code=…&state=… → back in the app, signed in
async function callback(request: Request, env: Env) {
  const url = new URL(request.url);
  const [state, verifier] = cookie(request, 'lw_pkce')?.split('.') ?? [];
  if (!state || state !== url.searchParams.get('state'))
    return new Response('Bad state', { status: 400 });
  const tokens = await exchangeCode(credentials(env), {
    code: url.searchParams.get('code') ?? '',
    redirectUri: callbackUrl(request),
    codeVerifier: verifier!,
    resource: env.API_RESOURCE,
  });
  const headers = new Headers({ location: '/' });
  headers.append('set-cookie', 'lw_pkce=; Path=/auth; Max-Age=0');
  headers.append('set-cookie', refreshCookie(tokens.refreshToken!));
  return new Response(null, { status: 302, headers });
}

// POST /auth/token → { accessToken, expiresAt } for the browser to send as Bearer
async function token(request: Request, env: Env) {
  const refreshToken = cookie(request, 'lw_refresh');
  if (!refreshToken) return Response.json({ signedIn: false }, { status: 401 });
  const tokens = await refreshTokens(credentials(env), {
    refreshToken,
    resource: env.API_RESOURCE,
  });
  return Response.json(
    { accessToken: tokens.accessToken, expiresAt: tokens.expiresAt },
    { headers: { 'set-cookie': refreshCookie(tokens.refreshToken!), 'cache-control': 'no-store' } },
  );
}

const refreshCookie = (value: string) =>
  `lw_refresh=${value}; Path=/auth; HttpOnly; Secure; SameSite=Strict; Max-Age=${30 * 24 * 3600}`;
```

(`cookie(request, name)` is whatever cookie reader the app already has.)

For a "Create account" button, pass `prompt: 'create'` to `authorizeUrl`. The accounts site then
opens its registration page (first name, last name, email, code) instead of sign-in. Everything
after that is the same.

`prompt: 'none'` never shows a page: the accounts site answers at once with a code when there is a
liveworkspace session and with `error=login_required` when there isn't. That is how an app signs
someone in without a click; `@liveworkspace/auth-client/silent` holds the whole of it, the page's boot
script, the `/api/auth/silent` route and the callback's half
([accounts.md](../003-accounts/accounts.md#signing-in-without-a-click)).

Who signed in comes from the ID token: `sub`, `email`, `name`, `given_name` and `family_name`.

In the browser, keep the access token in memory. Call `POST /auth/token` on load and again a
minute before `expiresAt`, then send the token as `Authorization: Bearer …`.
Refresh tokens rotate, and two tabs refreshing at once is fine: the accounts Worker replays the
same answer for 30 seconds.

## Deleting an account

An app's Delete Account closes the person's liveworkspace account, for every app, not just
the app's own data. Being signed in is not enough: the account needs the 6-digit code emailed to
it ([sign-in.md](../003-accounts/sign-in.md#closing-an-account)). The app's Worker has two routes,
and `@liveworkspace/auth-client` makes their answers, so every app answers the same:

```ts
import { confirmDeletionCode, requestDeletionCode } from '@liveworkspace/auth-client';

// POST /api/account/deletion-code: the code is emailed to the account.
const sent = await requestDeletionCode(credentials, accessToken);
return Response.json(sent.body, { status: sent.status });

// DELETE /api/account { code }: checked before anything is deleted.
const confirmed = await confirmDeletionCode(credentials, accessToken, body.code);
if (!confirmed.ok) return Response.json(confirmed.answer.body, { status: confirmed.answer.status });
await deleteAppData(env, userId);
await confirmed.closeAccount(); // `closeAccount`, with the same code
// then clear the refresh cookie: the refresh token died with the account
```

`credentials` is `{ accountsUrl: env.ACCOUNTS_URL, clientId: env.ACCOUNTS_CLIENT_ID, clientSecret:
env.ACCOUNTS_CLIENT_SECRET }`, or null where sign-in isn't set up (both routes then refuse). In that
order, a failure on the last step leaves a signed-in person who can try again with the same code; the
other way round, the app's data would be left with no account to reach it. The accounts Worker
needs the app's client secret as well as the token, so it runs in the Worker.

## Checking the token in the API Worker

Build the verifier once at module scope so the key set
stays cached for the life of the isolate:

```ts
import { createVerifier } from '@liveworkspace/auth-client';

let verify: ReturnType<typeof createVerifier> | undefined;

export async function accountOf(request: Request, env: Env) {
  verify ??= createVerifier({ issuer: env.ACCOUNTS_ISSUER, audience: env.API_RESOURCE });
  const token = bearerTokenOf(request.headers.get('authorization'));
  return token ? verify(token) : null; // { userId, email, emailVerified, scopes } | null
}
```

`userId` is the account id (`user_…`; accounts imported from Clerk keep their Clerk id), so everything keyed on
it (owner ids, team members, API tokens) is one id across apps. `email` + `emailVerified` are what team
invitations match on.

## Installing the package

It is a workspace package, `@liveworkspace/auth-client` in `packages/auth-client`: add it to the app's
`package.json` as `"@liveworkspace/auth-client": "workspace:*"` (`corepack pnpm --filter <package> add
@liveworkspace/auth-client@workspace:*`).

## liveplanner

liveplanner is wired this way. Its routes live on its API Worker under `/api/auth/*`
(`liveplanner/apps/api/src/routes/auth.ts`), on the same origin as the app, and it uses the
workspace package directly (`"@liveworkspace/auth-client": "workspace:*"`). It derives the issuer
from `ACCOUNTS_URL` (`${ACCOUNTS_URL}/api/auth`) rather than taking `ACCOUNTS_ISSUER`. Register it
once per environment with its callback on each origin it serves:

```sh
ADMIN_TOKEN=… node apps/accounts/scripts/register-client.ts \
  --accounts https://www.liveworkspace.app \
  --name liveplanner \
  --app liveplanner.app \
  --redirect https://www.liveplanner.app/api/auth/callback \
  --redirect https://liveplanner.app/api/auth/callback \
  --resource https://liveplanner.app/api
```

Locally, against a development accounts Worker, the redirect is
`http://localhost:3200/api/auth/callback` (the router) and the resource `http://localhost/api`
(liveplanner/docs/development/local-development.md).

## Telemetry

An app's anonymous product events go to liveworkspace too, not to its own API. See
[telemetry.md](../008-telemetry/telemetry.md) for the batch format, the settings, and the steps for adding an app.
