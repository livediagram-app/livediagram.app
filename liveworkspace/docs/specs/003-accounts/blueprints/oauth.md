# OAuth, clients and the device grant: blueprint

Derived from [sign-in.md "How signing in works"](../sign-in.md#how-signing-in-works), ["Registering an
app"](../sign-in.md#registering-an-app), [accounts.md "Signing in without a click"](../accounts.md#signing-in-without-a-click),
["Which app a client is"](../accounts.md#which-app-a-client-is) and ["The API"](../accounts.md#the-api). The spec
decides; this file only adds engineering precision, read from the code. Defaults are cited as `ACCn`. Paths are
relative to the repository root.

Scope, by file:

| File                                                                            | Role                                                                                     |
| ------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| `liveworkspace/apps/accounts/src/auth-options.ts`                               | `oauthProvider` options, `customAccessTokenClaims`, `idTokenClaims`, `signUpClientId`    |
| `liveworkspace/apps/accounts/src/resources.ts`                                  | `RESOURCES`: the app APIs a token may be addressed to, per environment                   |
| `liveworkspace/apps/accounts/src/clients.ts`                                    | `POST /api/auth/internal/clients`, `clientApp`                                           |
| `liveworkspace/apps/accounts/src/account-api.ts`                                | `verifiedClient`, `vouchedPerson`: client credentials and access tokens by introspection |
| `liveworkspace/apps/accounts/scripts/register-client.ts`, `map-clients.ts`      | Registering a client; mapping existing ones to apps                                      |
| `packages/auth-client/src/oauth.ts`, `silent.ts`, `verify.ts`, `return-path.ts` | Each app's side: PKCE code flow, `prompt=none`, offline verification, safe returns       |
| `packages/mcp-kit/src/oauth-device.ts`, `packages/api-kit/src/oauth.ts`         | The device grant each app's MCP server runs for CLIs                                     |

## Domain and naming

| Term      | Identifier                                         | Meaning                                                         |
| --------- | -------------------------------------------------- | --------------------------------------------------------------- |
| Client    | `oauthClient` + `oauth_client_app (clientId, app)` | One confidential web client per app and environment             |
| Resource  | an entry of `RESOURCES[ENVIRONMENT]`               | The `aud` of an access token; each app's `/api`                 |
| Scopes    | `openid profile email offline_access`              | All a client asks for                                           |
| Registrar | `client-registrar@liveworkspace.invalid`           | The account clients are created under; nobody can sign in as it |

## Behaviour and state

### The provider (`oauthProvider`)

- Pages: `loginPage '/sign-in'`, `signup.page '/sign-up'` (an app's `prompt=create`), `consentPage '/consent'`.
- `resources`: the environment's `RESOURCES`. `refreshTokenReuseInterval` 30 s: refresh tokens rotate, and a rotated
  one replays the same response within 30 s, so two tabs refreshing at once both stay signed in.
- `clientPrivileges` and `resourcePrivileges`: only a request whose `x-liveworkspace-admin` header equals
  `ADMIN_TOKEN` (`sameSecret`); open dynamic registration is closed. `clientReference` is always `'liveworkspace'`, so
  deleting an account never takes a client with it.
- Access token claims beyond the standard: `email`, `email_verified`, `teams` (`teamsClaim`: every joined team, `{
id, name, role }`).
- ID token claims (`idTokenClaims`): with `profile`, `name`, `given_name`, `family_name`, `presence_color` (one
  profile read, left out if it fails), `picture` (only one the apps draw) and `picture_hidden: true` when Show My
  Google Picture is off; with `email`, `email` and `email_verified`.
- The jwt plugin signs every token; its keys are at `GET /api/auth/jwks` and stored in `jwks` encrypted under
  `BETTER_AUTH_SECRET`. Token lifetimes are Better Auth's defaults (not set here).
- Discovery: `GET /.well-known/openid-configuration` and `/.well-known/oauth-authorization-server` at the root (and
  Better Auth's own under the issuer path).

### Registering a client (`POST /api/auth/internal/clients`)

1. `Authorization: Bearer ADMIN_TOKEN` (`401 Unauthorized` otherwise).
2. Body `{ name, redirectUris (≥ 1), resource (one of RESOURCES), app (a SettingsApp) }`: else `400 invalid_request`
   naming what it needs.
3. The registrar account found or made, a session made for it, and `adminCreateOAuthClient`: `application_type`
   `native` when every redirect URI is loopback (`http://localhost|127.0.0.1|[::1]`), else `web`;
   `client_secret_basic`; grants `authorization_code`, `refresh_token`; response `code`; the four scopes; the one
   resource; `require_pkce: true`; `skip_consent: true`.
4. A failure: `400 registration_failed { status, detail }` (only an admin sees it).
5. `INSERT INTO oauth_client_app (clientId, app)`; answer `{ client_id, client_secret, redirect_uris, resource, app }`.
6. The registrar's session is deleted whatever happened.

### Client credentials on the account API (`verifiedClient`)

`Authorization: Basic base64(<client id>:<secret>)` (each part URL-encoded). Checked by posting a dummy token to
Better Auth's `/oauth2/introspect` with those credentials: `401` there means a wrong secret. A pass is remembered for
5 minutes by a SHA-256 of the header, with the client's app (the map is cleared past 100 entries). `vouchedPerson`
introspects a person's access token the same way and takes its `sub` only when `active`, and `client_id` is this
client (`401 invalid_token` otherwise; `400 access_token_required` without one).

### An app's side (`@liveworkspace/auth-client`)

- `authorizeUrl`: `response_type=code`, `scope` the four, `code_challenge` S256, `state`, optional `prompt` `create`,
  `login` or `none`; `exchangeCode` and `refreshTokens` send the client secret, so they run in the app's Worker;
  the refresh token returned replaces the one sent.
- Silent sign-in: once per browser session, never in a frame, for a crawler, on sign-in pages, embeds or share links,
  or after an explicit sign-out (remembered 400 days); a 120 s guard cookie stops loops; the PKCE verifier and return
  path ride in cookies for 600 s; a return longer than 1,500 characters is not bounced. `prompt=none` answers a code or
  `login_required` at once.
- `safeReturnPath` passes only a path on the same site (no `//`, scheme, backslash or control character).
- `verify.ts` checks access tokens offline against the published key set.

### The device grant (each app's MCP server, `mcp-kit`)

For a CLI without a browser (RFC 8628), built-in clients only, state in the app's `OAUTH_KV`:

1. `POST /oauth/device_authorization`: `400 invalid_client`; limited 20 an hour per IP (`429 rate_limited`); writes
   `device:<device code>` and `usercode:<user code>` for 600 s; answers the codes, `expires_in` 600, `interval` 5.
2. `GET /oauth/device/session/:userCode` (30 per 10 minutes, shared with complete and deny): which client asks, or
   `404 invalid_code`.
3. The signed-in page posts `POST /oauth/device/complete` with the token it minted, or `/oauth/device/deny`; the user
   code key goes.
4. `POST /oauth/token` with `urn:ietf:params:oauth:grant-type:device_code`: `authorization_pending`, `slow_down` (the
   interval grows by 5 s; only `devicepoll:` is written by polls), `access_denied`, `expired_token`, or the token.

User codes are 8 characters of `BCDFGHJKLMNPQRSTVWXZ`.

## Data and persistence

| Table                  | Key        | Indexes                                                            | Written by                             | Read by                                       |
| ---------------------- | ---------- | ------------------------------------------------------------------ | -------------------------------------- | --------------------------------------------- |
| `oauthClient`          | `id`       | `clientId` unique; `oauthClient_userId_idx`                        | registration                           | the provider; guest hand-off; `appOfReturn`   |
| `oauthClientResource`  | `id`       | `…_clientId_idx`, `…_resourceId_idx`, `…_clientId_resourceId_uidx` | registration                           | the provider; guest hand-off                  |
| `oauthResource`        | `id`       | `identifier` unique                                                | the provider (seeded from `RESOURCES`) | the provider                                  |
| `oauthAccessToken`     | `id`       | `token` unique; by client, session, user, code, refresh            | the provider                           | introspection                                 |
| `oauthRefreshToken`    | `id`       | `token` unique; by client, session, user, code                     | the provider (rotation, replay)        | the provider                                  |
| `oauthConsent`         | `id`       | by client, user                                                    | the provider                           | the provider                                  |
| `oauthClientAssertion` | `id`       |                                                                    | the provider                           | the provider                                  |
| `oauth_client_app`     | `clientId` | (WITHOUT ROWID)                                                    | registration; `map-clients.ts`         | `clientApp`; `appOfReturn`; the welcome's app |

`oauth_client_app.app` CHECKs the four site ids and cascades from `oauthClient`. Tokens and consents cascade from
`user`.

## Errors and edge cases

| Case                                | Answer                                     |
| ----------------------------------- | ------------------------------------------ |
| An account registering a client     | refused by `clientPrivileges`              |
| A client with no app row            | `403 client_has_no_app` on per-app routes  |
| An access token from another client | `401 invalid_token`                        |
| Two tabs refreshing at once         | both get the same rotated pair within 30 s |

## Security and trust

- A token addressed to one app's API is refused by every other (`aud`).
- PKCE is required of every client; consent is skipped for first-party apps only because signing in is the consent.
- The client secret never leaves an app's Worker.

## Testing

| Test                                                                                                | Pins                            |
| --------------------------------------------------------------------------------------------------- | ------------------------------- |
| `liveworkspace/apps/accounts/src/clients.test.ts` (5)                                               | registering a client            |
| `liveworkspace/apps/accounts/src/auth-options.test.ts` (11)                                         | `idTokenClaims`, among the rest |
| `liveworkspace/apps/accounts/src/account-api.test.ts` (33)                                          | client credentials and vouching |
| `packages/auth-client/src/oauth.test.ts`, `silent.test.ts`, `verify.test.ts`, `return-path.test.ts` | the app side                    |
| `packages/mcp-kit/src/oauth-device.test.ts`                                                         | the device grant                |

## Constants and configuration

`CLIENTS_PATH` `/api/auth/internal/clients`, `REGISTRAR_EMAIL` (`clients.ts`); `ADMIN_HEADER`
`x-liveworkspace-admin` (`secrets.ts`); `CLIENT_CHECK_TTL_MS` 5 min (`account-api.ts`); `RESOURCES`
(`resources.ts`): production `https://livediagram.app/api`, `https://liveplanner.app/api`,
`https://livedocuments.app/api`, `https://livedesign.app/api`; staging their `staging.` twins;
development `http://localhost/api`. `SILENT_SESSION_KEY`, `SILENT_GUARD_MAX_AGE_SECONDS` 120,
`SIGNED_OUT_MAX_AGE_SECONDS` 400 d, `SILENT_RETURN_MAX_LENGTH` 1,500, `GUEST_STATE_PATTERN`
(`packages/auth-client`); `DEVICE_CODE_TTL_S` 600, `DEVICE_POLL_INTERVAL_S` 5, `DEVICE_SLOW_DOWN_S` 5,
`USER_CODE_LENGTH` 8 (`packages/api-kit/src/oauth.ts`). Secret: `ADMIN_TOKEN`.

## Defaults ledger

- `ACC13`: token lifetimes are left at Better Auth's defaults; the code sets only the 30-second refresh replay window.
