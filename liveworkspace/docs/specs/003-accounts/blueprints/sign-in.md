# Signing in: blueprint

Derived from [sign-in.md "How signing in works"](../sign-in.md#how-signing-in-works), ["The sign-in and
registration pages"](../sign-in.md#the-sign-in-and-registration-pages) and [accounts.md "Signing in on the app's own
address"](../accounts.md#signing-in-on-the-apps-own-address). The spec decides; this file only adds engineering
precision, read from the code. The Worker as a whole is in [accounts.md](accounts.md); defaults are cited as `ACCn`.
Paths are relative to the repository root.

Scope, by file:

| File                                                 | Role                                                                                                             |
| ---------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| `liveworkspace/apps/accounts/src/auth-options.ts`    | Every Better Auth option: paths, plugins, hooks, Google, the ID token claims                                     |
| `liveworkspace/apps/accounts/src/auth.ts`            | `getAuth`, `getGoogleAuthFor`, `allAppOrigins`: the instances and what they are wired to                         |
| `liveworkspace/apps/accounts/src/rate-limit.ts`      | `overCodeLimit`, `networkOf`, `rangeOf`                                                                          |
| `liveworkspace/apps/accounts/src/sign-in-options.ts` | `GET /api/auth/sign-in-options`                                                                                  |
| `liveworkspace/apps/accounts/src/handoff.ts`         | Signing in on an app's own address: `signInOnAppAddress`, `appOfReturn`, `appOriginOfProxy`, the hand-off plugin |
| `liveworkspace/apps/accounts/src/ids.ts`             | `newUserId`, `USER_ID`, `GUEST_ID`                                                                               |
| `liveworkspace/apps/site` (sign-in pages)            | The static `/sign-in`, `/sign-up`, `/consent` pages that call these routes                                       |

## Domain and naming

| Term     | Identifier                                                        | Meaning                                                          |
| -------- | ----------------------------------------------------------------- | ---------------------------------------------------------------- |
| Code     | email OTP, 6 digits, stored hashed                                | The only password there is                                       |
| Network  | `networkOf`: the address, `via:<address>` through an app's router | What per-visitor limits count                                    |
| Range    | `rangeOf`: an IPv4 /24 or IPv6 /48                                | For doors a person could dodge by changing address               |
| Hand-off | `sign_in_handoff` row, cookie `lw_handoff`                        | Bringing a session made on an app's address to liveworkspace.app |
| Bind     | `handoff=<sha256(nonce)>` on the sign-in page                     | Ties the hand-off to the browser that started it                 |

## Behaviour and state

### Better Auth's setup (`authOptions`)

- `appName 'liveworkspace'`, `basePath '/api/auth'`, `baseURL BASE_URL`; `trustedOrigins` every app origin in the
  environment (`allAppOrigins`).
- `disabledPaths`: `/token` (the jwt plugin's own session token) and the unused code routes
  (`check-verification-otp`, `verify-email`, `request-password-reset`, `forget-password/email-otp`,
  `reset-password`, `request-email-change`, `change-email`).
- Better Auth's own rate limit is off; the Worker's bindings do it.
- User fields `givenName`, `familyName` (input); on create and update `withNames` trims each to 80 and rebuilds `name`
  from both halves when both are given.
- Ids: a user `user_` + 32 hex (a UUID without dashes); everything else a UUID.
- Client IP from `cf-connecting-ip`.
- Plugins: `emailOTP` (6 digits, 600 s, 3 attempts, stored hashed; only `type 'sign-in'` sends), `captcha`
  (Cloudflare Turnstile with `TURNSTILE_SECRET_KEY`, on the send route only), `jwt`, the hand-off plugin (below),
  `oauthProvider` ([oauth.md](oauth.md)).
- Hooks: a new user starts the onboarding series ([email.md](email.md)); a new session merges a guest cookie
  ([sessions-and-guests.md](sessions-and-guests.md)); a Google account row written stores its `picture`
  ([settings-and-profiles.md](settings-and-profiles.md)).

### An email code

1. `POST /api/auth/email-otp/send-verification-otp { email }` with a Turnstile token: `CODE_IP_LIMITER` keyed
   `ip:<network>` (10 a minute), then `CODE_EMAIL_LIMITER` keyed `email:<trimmed lower-case>` (3 a minute). Over:
   `429 { code: 'RATE_LIMITED', message: 'Too many requests' }`. A body without an email is left to Better Auth.
2. The code is mailed in the brand of the app the request came through (an app's router proxy), else
   liveworkspace's ([email.md](email.md)).
3. `POST /api/auth/sign-in/email-otp { email, otp }`: `CODE_IP_LIMITER` only. Three wrong tries kill the code. A new
   address makes the account (signing in verifies it).

### Google

On when `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` are both set. `prompt: 'select_account'`; the profile fills
`givenName`, `familyName` and `image` (only a picture the apps draw, `profilePictureOf`). Account linking is on: Google
joins an account made with a code when Google says the address is verified (Google is not a trusted provider).
`GOOGLE_ON_APP_ORIGINS === 'true'` sends `/sign-in/social` and `/callback/google` through an instance whose
`redirectURI` is `<app origin>/api/workspace/auth/callback/google`; otherwise the button on an app's address goes to
this site's page.

### `GET /api/auth/sign-in-options`

`{ turnstileSiteKey, google, nameMaxLength: 80, accountsUrl: BASE_URL, googleOnApps }`, `cache-control: public,
max-age=300`, `x-content-type-options: nosniff`.

### Signing in on the app's own address (`SIGN_IN_ON_APP_ORIGINS === 'true'`)

1. `GET /api/auth/oauth2/authorize` with no session answers `302` to `/sign-in` or `/sign-up`. When `client_id` and
   `redirect_uri` are sent and `appOfReturn` matches (the redirect URI's origin is one of that app's origins in this
   environment, and its origin and path exactly a registered redirect URI of that client, which must be that app's;
   no credentials, no fragment), the redirect goes to `<app origin><page><query>&handoff=<sha256(nonce)>` and the
   browser gets `lw_handoff=<nonce>; Path=/api/auth/handoff; Max-Age=900; HttpOnly; SameSite=Lax; Secure`.
2. The page signs in through the app's router, then `POST /api/auth/handoff/start { return, bind }`: the `Origin`
   must be an app's (`403 not_an_app`); a session (`401 no_session`); the session cookie on the app's address is
   cleared whatever follows; `bind` 43 base64url characters (`400 invalid_bind`); `return` an app's registered
   redirect URI on the same app as the origin (`400 invalid_return`). One batch deletes rows expired over a minute
   ago and inserts `{ tokenHash, sessionId, userId, bindHash, returnUrl, expiresAt: now + 60 s }`. Answer `{ url:
<BASE_URL>/api/auth/handoff?token=<32 random bytes, base64url> }`, `no-store`.
3. `GET /api/auth/handoff?token=` top level here: the token spent in one `UPDATE … SET usedAt … WHERE usedAt IS NULL
RETURNING`; then expiry, the nonce cookie's hash against `bindHash` (`sameSecret`), the return address checked
   again, and the session still live. Each refusal is a small `400` HTML page ("not valid", "already used",
   "expired", "started in another browser", "cannot go back", "has ended"), with a link back where one is safe.
4. Success: the session cookie set here, `lw_handoff` cleared, a guest cookie merged and cleared, `302` to the return
   address (`no-store`, `no-referrer`).

`/consent` is never moved: asked at authorize it is for someone already signed in here.

## Data and persistence

| Table             | Key         | Indexes                               | Written by                                                | Read by                          |
| ----------------- | ----------- | ------------------------------------- | --------------------------------------------------------- | -------------------------------- |
| `user`            | `id`        | `email` unique                        | Better Auth; `withNames`; picture store; bench accounts   | everything                       |
| `session`         | `id`        | `token` unique; `session_userId_idx`  | Better Auth                                               | every session door; the hand-off |
| `account`         | `id`        | `account_userId_idx`                  | Better Auth (Google)                                      | the picture hook                 |
| `verification`    | `id`        | `verification_identifier_idx`         | the email OTP plugin                                      | the email OTP plugin             |
| `jwks`            | `id`        |                                       | the jwt plugin (keys encrypted with `BETTER_AUTH_SECRET`) | signing; `/api/auth/jwks`        |
| `sign_in_handoff` | `tokenHash` | `sign_in_handoff_expires (expiresAt)` | `handoff/start`                                           | `handoff`                        |

`sign_in_handoff.sessionId` references `session (id) ON DELETE CASCADE`; `usedAt` set once. Deleting a user cascades
its sessions and accounts.

## Errors and edge cases

| Case                                   | Answer                                                                   |
| -------------------------------------- | ------------------------------------------------------------------------ |
| Too many code sends or checks          | `429 RATE_LIMITED`                                                       |
| A wrong code three times               | the code is dead; a new one must be sent                                 |
| A hand-off token used twice            | the second is "already used"                                             |
| The hand-off opened in another browser | refused: no matching nonce                                               |
| A return address not registered        | the sign-in stays on liveworkspace.app (step 1), or `400 invalid_return` |

## Security and trust

- Codes are stored hashed and live ten minutes; sending needs Turnstile and is limited per network and per address.
- A request through an app's router is counted by the address the router names (`via:`), apart from direct visitors.
- The hand-off token is 256 random bits, kept only as its SHA-256, spent once, good for 60 s, and bound to an
  HttpOnly nonce on one path.
- Only exactly registered redirect URIs of the app's own client pass `appOfReturn`.

## Testing

| Test                                                          | Pins                                                                                                                        |
| ------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| `liveworkspace/apps/accounts/src/otp-routes.test.ts` (2)      | the emailed sign-in code: only sign-in sends, unused routes are off                                                         |
| `liveworkspace/apps/accounts/src/rate-limit.test.ts` (7)      | `overCodeLimit`; the network a code request comes from                                                                      |
| `liveworkspace/apps/accounts/src/sign-in-options.test.ts` (3) | sign-in options                                                                                                             |
| `liveworkspace/apps/accounts/src/handoff.test.ts` (14)        | the sign-in pages on the app's address; the hand-off; where a sign-in may go back to; the app origin a request came through |
| `liveworkspace/apps/accounts/src/auth-options.test.ts` (11)   | `withNames`; `idTokenClaims`; Google sign-in pictures                                                                       |
| `liveworkspace/apps/accounts/src/signup-app.test.ts` (4)      | the app a sign-up came through                                                                                              |

## Constants and configuration

`AUTH_BASE_PATH` `/api/auth`, `SEND_CODE_PATH`, `SIGN_IN_CODE_PATH`, `UNUSED_CODE_PATHS`, `NAME_MAX_LENGTH` 80
(`auth-options.ts`); `HANDOFF_PATH` `/handoff`, `HANDOFF_START_PATH`, `HANDOFF_NONCE_COOKIE` `lw_handoff`,
`HANDOFF_BIND_PARAM` `handoff`, `HANDOFF_TTL_SECONDS` 60, `HANDOFF_NONCE_MAX_AGE_SECONDS` 900 (`handoff.ts`).
Rate limiters: `CODE_IP_LIMITER` namespace `1001` (staging `2001`), 10 per 60 s; `CODE_EMAIL_LIMITER` `1002`
(`2002`), 3 per 60 s. Vars: `SIGN_IN_ON_APP_ORIGINS` `"true"`, `GOOGLE_ON_APP_ORIGINS` `"false"` in both environments;
`TURNSTILE_SITE_KEY`. Secrets: `BETTER_AUTH_SECRET` (at least 32 characters), `TURNSTILE_SECRET_KEY`,
`GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`.

## Defaults ledger

- `ACC4`: the spec names no per-address limit; sending a code is held to 3 a minute per address and 10 a minute per
  network, checking to 10 a minute per network.
- `ACC5`: a hand-off token lives 60 seconds and its nonce 15 minutes (the code's ten and some).
