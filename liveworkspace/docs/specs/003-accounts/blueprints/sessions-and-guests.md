# Sessions, guests and bearers: blueprint

Derived from [accounts.md "Guests"](../accounts.md#guests), ["Returning guests of the old
livediagram.app"](../accounts.md#returning-guests-of-the-old-livediagramapp), ["liveworkspace.app's own
token"](../accounts.md#liveworkspaceapps-own-token) and ["Guests who never come back"](../accounts.md#guests-who-never-come-back).
The spec decides; this file only adds engineering precision, read from the code. Defaults are cited as `ACCn`. Paths
are relative to the repository root.

Scope, by file:

| File                                                 | Role                                                                                      |
| ---------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| `liveworkspace/apps/accounts/src/guests.ts`          | The `lw_guest` cookie, `GET /api/auth/guest`, the guest merge on sign-in and on authorize |
| `liveworkspace/apps/accounts/src/workspace-token.ts` | `GET /api/auth/workspace-token`: liveworkspace.app's own token                            |
| `liveworkspace/apps/accounts/src/end-session.ts`     | `POST` and `GET /api/auth/end-session`; every app's tokens on a session, at any sign-out  |
| `liveworkspace/apps/accounts/src/bearer.ts`          | `bearerPerson`: an app API's access or guest token, checked against this Worker's keys    |
| `liveworkspace/apps/accounts/src/legacy-guests.ts`   | `POST /api/account/internal/legacy-guests/claim`                                          |
| `liveworkspace/apps/accounts/src/guest-sweep.ts`     | `noteGuestSeen`, `sweepIdleGuests`                                                        |
| `liveworkspace/apps/accounts/src/account-api.ts`     | `GET /api/account/people` on each door                                                    |
| `liveworkspace/apps/accounts/src/profiles.ts`        | `withSessionColour` on `GET /api/auth/get-session`                                        |
| `packages/auth-client/src/silent.ts`, `oauth.ts`     | Each app's side: the guest hand-off and `prompt=none`                                     |

## Domain and naming

| Term            | Identifier                                                            | Meaning                                                               |
| --------------- | --------------------------------------------------------------------- | --------------------------------------------------------------------- |
| Guest cookie    | `lw_guest=<guest id>.<HMAC>`                                          | HMAC-SHA-256 of `lw_guest:<id>` under `BETTER_AUTH_SECRET`, base64url |
| Guest token     | JWT `{ iss, aud: <resource>, sub: <guest>, kind: 'guest', iat, exp }` | Signed by the jwt plugin, a year                                      |
| Workspace token | JWT `{ iss, aud: RESOURCES, azp: 'liveworkspace.app', sub, … }`       | liveworkspace.app's Explorer, 15 minutes                              |
| Legacy guest    | `guest_<old uuid>`, `legacy_guest` row                                | Copied work of the old livediagram.app                                |
| Seen            | `guest_seen (guest_id, seen_at)`                                      | When an id was last handed out                                        |
| Sign-out ticket | `<base64url JSON { c: client, s: account, e: exp }>.<HMAC>`           | HMAC-SHA-256 of `end-session:<payload>`, base64url; five minutes      |

## Behaviour and state

### Sessions

Better Auth's own: a `session` row and its cookie on liveworkspace.app, made by a code or Google sign-in or the
hand-off. `GET /api/auth/get-session` answers Better Auth's body with `user.color` added (one primary-key read of
`profile.color`); any other answer passes unchanged. The session's lifetime is Better Auth's default (not set here).

### Ending a session (`end-session.ts`)

`endSessionTokens(db, sessionId)` is one D1 batch: delete `oauthAccessToken` rows whose `sessionId` is the session's
or whose `refreshId` is one of its refresh tokens, then its `oauthRefreshToken` rows, then the `session` row. Deleted,
never `revoked`: a revoked refresh token presented again makes the provider delete that client's whole family for the
account (`invalidateRefreshFamily`), on every device.

`POST /api/auth/end-session` (an app's Worker):

1. `Authorization: Basic` and a JSON `{ token }` (the refresh token): else `400 invalid_request`.
2. The provider's `/oauth2/introspect` with `token_type_hint=refresh_token` and that header: `401` there is
   `401 invalid_client`; not `active`, no `sub`, or another client's is `401 invalid_token`.
3. The row by its stored form (`base64url(SHA-256(token))`, the provider's `hashed`): its `sessionId` gets
   `endSessionTokens`; a row with no session left has itself and its access tokens deleted.
4. `200 { ended, ticket }`, `no-store`: `ended` whether a session went; `ticket` signed for the client and `sub`,
   `exp = now + 300 s`.

`GET /api/auth/end-session?client_id=&post_logout_redirect_uri=[&ticket=]` (the browser):

1. The client read from `oauthClient` (not disabled): none is `400 invalid_client`.
2. `post_logout_redirect_uri` must parse, be `http:` or `https:`, carry no user info, be at most 2,000 characters, and
   share its origin with one of the client's registered redirect URIs: else `400 invalid_redirect_uri`. Every `400`
   is `no-store` and redirects nowhere.
3. A ticket that verifies, is unexpired and names this client: the browser's session (`getSession`) is ended when it
   is the ticket's account (`endSessionTokens` on its id: its tokens and the row), then Better Auth's `signOut` clears
   the session cookie on the domain it was set on; with no session left, only the cookie is cleared. A session of
   another account is left alone. A `signOut` that throws is logged (`[end-session] sign-out failed`) and the hop
   still goes back.
4. `302` to `post_logout_redirect_uri` as parsed (`URL.href`), `no-store`, `no-referrer`, with the cleared cookies.

Better Auth's session-ending routes (`SESSION_ENDING_ROUTES`: `POST /sign-out`, `/revoke-session`,
`/revoke-other-sessions`, `/revoke-sessions`): before the handler runs, `endSessionTokensOf(request, route, auth, db)`
reads the caller's session (none: nothing) and deletes every app's tokens on the sessions the route ends: the
caller's for `sign-out`; for `revoke-session`, the one whose `token` the body names, only when it is the caller's
account's; every other session of the account, or every one, for the last two. Better Auth then deletes the sessions
(and, for `sign-out`, the cookie). The deletes run `SESSIONS_PER_STATEMENT` (40) sessions to a statement, in one batch.

### The guest hand-off (`GET /api/auth/guest?client_id=&redirect_uri=&state=[&resource=]`)

1. `GUEST_LIMITER` keyed `ip:<network>` (60 a minute): `429 rate_limited`.
2. The client read from `oauthClient` (not disabled) and its resources: none is `400 invalid_client`; the redirect URI
   must be one of its registered ones exactly (`400 invalid_redirect_uri`); `state` 1 to 200 characters (`400
invalid_state`); `resource` the client's only one, or named and one of its own (`400 invalid_resource`). Every
   `400` is `no-store`.
3. From here the browser always goes back: the cookie's guest, or a new `guest_<uuid>`; `noteGuestSeen`; a guest
   token signed with `exp = iat + 365 days`; `302` to `<redirect_uri>#guest_token=…&state=…` with the cookie set again
   (`Max-Age` ten years, `Path=/; HttpOnly; SameSite=Lax`, `Secure` outside development), `no-store`, `no-referrer`.
4. A failure past step 2: `302` to `<redirect_uri>#error=server_error&state=…`.

### liveworkspace.app's own token (`GET /api/auth/workspace-token`)

`Sec-Fetch-Site: cross-site` is `403 cross_site`. A session: an access token `{ sub, email, email_verified, teams }`.
Otherwise a guest: a new one first passes `GUEST_LIMITER`; the guest stamped seen, the cookie set again. Either way
`exp = iat + 900`, `aud` every resource of the environment, `azp 'liveworkspace.app'`; answer `{ token, kind, sub,
expiresAt (ms) }`, `no-store`.

### Bearers on the account API (`bearer.ts`)

`Authorization: Bearer <token>` (not a merge key) is verified offline with `createPersonVerifier` against this
Worker's own key set (read in-process with `auth.api.getJwks()`, kept 5 minutes), issuer `${BASE_URL}/api/auth`,
audience the environment's resources. A guest reaches `GET /api/account/people` only (limited by `TEAM_LINK_LIMITER`
keyed `people:<range>`, names without pictures); an account also teams, invitations, settings and its profile.
Anything else `401 signed_out` or `404 not_found`.

### People's names (`GET /api/account/people?ids=a,b`)

Ids filtered to account or guest ids, at most 100 (`400 too_many_ids`); `{ people: [{ id, name, picture? }] }`.
Pictures only for an account asking. The session door with no session reads for the browser's own signed guest cookie
(`401 signed_out` without one), limited as above.

### The guest merge (`mergeGuestInto`)

Triggered by Better Auth's `session.create.after` (a request with a valid guest cookie), by `GET
/oauth2/authorize` answering a code to a browser with a guest cookie and a session already there, and by the
hand-off.

1. Not into a guest: the guest's settings, then profile, merged here ([settings-and-profiles.md](settings-and-profiles.md));
   failures only logged.
2. `INDEX_URL` and `INDEX_MERGE_KEY` set (else logged once, `false`): `POST ${INDEX_URL}/internal/merge { guestId,
userId[, legacy: true] }` with the merge key, 5 s, through the `INDEX` binding.
3. `true` only when the index answered `2xx`: then the guest cookie is cleared (`Max-Age=0`) beside the session's.
   Otherwise the cookie stays and the next sign-in tries again.

### A returning guest of the old livediagram.app (`POST /api/account/internal/legacy-guests/claim`)

Off (`404`) without `LEGACY_GUEST_ID_HMAC_SECRET`; only livediagram.app's client (`403 wrong_app`);
`LEGACY_GUEST_LIMITER` keyed `claim:<into, ≤ 100 chars>` (10 a minute, `429`). Body `{ legacyId, signature?, into }`:

1. `legacyId` a lower-case v4 UUID (`400 invalid_legacy_id`); `signature` a string or null (`400
invalid_signature`); `into` an account or guest id other than the legacy owner `guest_<legacyId>` (`400
invalid_into`).
2. A signature (43 base64url characters) is checked first: HMAC-SHA-256 of the bare id (`403 bad_signature`).
3. No row: `200 { merged: false, reason: 'unknown' }`. Unsigned and first seen after `LEGACY_GUEST_SIGNING_LIVE_AT`:
   `403 signature_required`. Claimed: `{ merged: true }` for the same `into`, else `{ merged: false, reason: 'claimed' }`.
4. Held in one conditional update (`claimingBy`, `claimingUntil = now + 60 s`), taking over a lapsed or own hold;
   none: claimed answers as above, else `503 claim_in_progress`.
5. `mergeGuestInto(…, { legacy: true })`; failing releases the hold, `502 merge_failed`.
6. Stamped `claimedAt`, `claimedBy`; a race lost answers `claimed`. Logged `[accounts] legacy guest claimed { into }`.

### Guests who never come back

`noteGuestSeen` upserts `seen_at` at most once a day per guest (the hand-off, the workspace token, and an app reading
or writing a guest's settings or profile). The daily `idle guests` step reads up to 500 ids unseen for 400 days,
oldest first, then one batch deletes their `settings`, `profile` and `guest_seen` rows, rechecking the cutoff in each
delete. Their items stay in the index.

## Data and persistence

| Table          | Key        | Indexes                   | Written by                                      | Read by           |
| -------------- | ---------- | ------------------------- | ----------------------------------------------- | ----------------- |
| `guest_seen`   | `guest_id` | `guest_seen_at (seen_at)` | `noteGuestSeen`; profile merge deletes          | `sweepIdleGuests` |
| `legacy_guest` | `id`       |                           | the migration's copy (`firstSeenAt`); the claim | the claim         |

`legacy_guest` columns: `firstSeenAt`, `claimedAt`, `claimedBy`, `claimingBy`, `claimingUntil` (0013).

## Errors and edge cases

| Case                                     | Answer                                         |
| ---------------------------------------- | ---------------------------------------------- |
| A forged or another site's guest cookie  | a new guest                                    |
| A redirect URI not registered            | `400`, never a redirect                        |
| The index down at sign-in                | signed in; the guest cookie kept for next time |
| A cross-site workspace token request     | `403 cross_site`                               |
| A sign-out hop to an unregistered origin | `400 invalid_redirect_uri`, never a redirect   |
| A sign-out hop with no or a bad ticket   | back to the app; no session ended              |
| A sign-out hop for another account       | back to the app; that session kept             |
| Two legacy claims at once                | one merges; the other `503` or `claimed`       |

## Security and trust

- A guest id is only ever believed from the HMAC-signed cookie, so nobody claims another guest's items at sign-up.
- Guest tokens are signed by the same keys as access tokens and addressed to one app's API.
- The legacy claim checks possession before it reads the row, so a forged signature learns nothing.
- Ending a session needs the app's client secret and a live refresh token of that client; the browser's hop ends a
  session only with a ticket from that call, for the same account, so a link from another site signs nobody out and
  can only send the browser to an origin the client registered.

## Testing

| Test                                                          | Pins                                                                                                                                 |
| ------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| `liveworkspace/apps/accounts/src/guests.test.ts` (20)         | the guest hand-off; signing in as a guest; signing in to an app with a session already there; `prompt=none`                          |
| `liveworkspace/apps/accounts/src/workspace-token.test.ts` (4) | the workspace token for an account, a guest, cross-site, the limit                                                                   |
| `liveworkspace/apps/accounts/src/end-session.test.ts` (17)    | ending a session from an app, the browser's hop, liveworkspace.app and Security: every app's tokens gone, tickets, redirects refused |
| `liveworkspace/apps/accounts/src/legacy-guests.test.ts` (14)  | claiming a returning guest of the old livediagram.app                                                                                |
| `liveworkspace/apps/accounts/src/guest-sweep.test.ts` (4)     | noting a guest seen; sweeping guests who can never come back                                                                         |
| `liveworkspace/apps/accounts/src/account-api.test.ts` (33)    | the people door and bearers among the rest                                                                                           |

## Constants and configuration

`GUEST_PATH` `/guest`, `GUEST_COOKIE` `lw_guest`, `GUEST_TOKEN_TTL_SECONDS` 365 d, `COOKIE_MAX_AGE_SECONDS` 10 years,
`STATE_MAX_LENGTH` 200, `MERGE_TIMEOUT_MS` 5 s, `AUTHORIZE_PATH` `/oauth2/authorize` (`guests.ts`);
`WORKSPACE_TOKEN_TTL_SECONDS` 900 (`workspace-token.ts`); `END_SESSION_PATH` `/end-session`, `TICKET_TTL_SECONDS` 300,
`REDIRECT_MAX_LENGTH` 2,000, `SESSIONS_PER_STATEMENT` 40 (`end-session.ts`); `KEYS_TTL_MS` 5 min (`bearer.ts`); `LEGACY_CLAIM_HOLD_MS`
60 s (`legacy-guests.ts`); `GUEST_IDLE_MS` 400 d, `GUEST_SWEEP_LIMIT` 500 (`guest-sweep.ts`); `MAX_PROFILE_IDS` 100.
Rate limiters: `GUEST_LIMITER` `1003` (`2003`), 60 per 60 s; `TEAM_LINK_LIMITER` `1004` (`2004`), 20 per 60 s;
`LEGACY_GUEST_LIMITER` `1105` (`2105`), 10 per 60 s.

## Defaults ledger

- `ACC6`: a guest id unseen for 400 days (past the token's year and a browser's cookie cap) has its settings and
  profile swept.
- `ACC7`: a merge that fails keeps the guest cookie, so the next sign-in tries again; the sign-in itself never fails.
