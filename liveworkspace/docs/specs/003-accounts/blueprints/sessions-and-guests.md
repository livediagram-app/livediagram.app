# Sessions, guests and bearers: blueprint

Derived from [accounts.md "Guests"](../accounts.md#guests), ["Returning guests of the old
livediagram.app"](../accounts.md#returning-guests-of-the-old-livediagramapp), ["liveworkspace.app's own
token"](../accounts.md#liveworkspaceapps-own-token), ["Guests who never come back"](../accounts.md#guests-who-never-come-back) and
["Every account setting in every app"](../accounts.md#every-account-setting-in-every-app).
The spec decides; this file only adds engineering precision, read from the code. Defaults are cited as `ACCn`. Paths
are relative to the repository root.

Scope, by file:

| File                                                                                                                     | Role                                                                                      |
| ------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------- |
| `liveworkspace/apps/accounts/src/guests.ts`                                                                              | The `lw_guest` cookie, `GET /api/auth/guest`, the guest merge on sign-in and on authorize |
| `liveworkspace/apps/accounts/src/guest-proof.ts`                                                                         | `readGuestProof` and the `lw_guest_proof` cookie: a renewal's guest token as proof        |
| `packages/auth-client/src/guest-renewal.ts`                                                                              | The app's side of a renewal: the `lw_guest_renewal` cookie and the page posting the token |
| `liveworkspace/apps/accounts/src/workspace-token.ts`                                                                     | `GET /api/auth/workspace-token`: liveworkspace.app's own token                            |
| `liveworkspace/apps/accounts/src/end-session.ts`                                                                         | `POST` and `GET /api/auth/end-session`; every app's tokens on a session, at any sign-out  |
| `liveworkspace/apps/accounts/src/bearer.ts`                                                                              | `bearerPerson`: an app API's access or guest token, checked against this Worker's keys    |
| `liveworkspace/apps/accounts/src/own-sessions.ts`                                                                        | The bearer's Where You're Signed In: list, end one, end the others                        |
| `liveworkspace/apps/accounts/src/link-google.ts`                                                                         | The bearer's Sign-in Methods, and `GET /api/auth/link-google`, the hop to Google          |
| `liveworkspace/apps/accounts/src/legacy-guests.ts`                                                                       | `POST /api/account/internal/legacy-guests/claim`                                          |
| `liveworkspace/apps/accounts/src/legacy-guest-rekey.ts`                                                                  | `POST /api/auth/internal/legacy-guests/rekey`                                             |
| `liveworkspace/apps/accounts/src/guest-sweep.ts`                                                                         | `noteGuestSeen`, `sweepIdleGuests`                                                        |
| `liveworkspace/apps/accounts/src/account-api/signed-in.ts`, `liveworkspace/apps/accounts/src/account-api/bearer-door.ts` | `GET /api/account/people` on each door                                                    |
| `liveworkspace/apps/accounts/src/profiles.ts`                                                                            | `withSessionColour` on `GET /api/auth/get-session`                                        |
| `packages/auth-client/src/silent.ts`, `oauth.ts`                                                                         | Each app's side: the guest hand-off and `prompt=none`                                     |

## Domain and naming

| Term            | Identifier                                                                                             | Meaning                                                                |
| --------------- | ------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------- |
| Guest cookie    | `lw_guest=<guest id>.<HMAC>`                                                                           | HMAC-SHA-256 of `lw_guest:<id>` under `BETTER_AUTH_SECRET`, base64url  |
| Guest token     | JWT `{ iss, aud: <resource>, sub: <guest>, kind: 'guest', iat, exp, oiat }`                            | Signed by the jwt plugin, 45 days; `oiat` when the cookie last vouched |
| Guest proof     | `lw_guest_proof=<guest token>`, `Path=/api/auth/guest`, 120 s                                          | Set only by an Origin-checked `POST /api/auth/guest`                   |
| Workspace token | JWT `{ iss, aud: RESOURCES, azp: 'liveworkspace.app', sub, … }`                                        | liveworkspace.app's Explorer, 15 minutes                               |
| Legacy guest    | `guest_<old uuid>` (from before signing, once re-keyed: `rekeyedLegacyGuestOwner`), `legacy_guest` row | Copied work of the old livediagram.app                                 |
| Seen            | `guest_seen (guest_id, seen_at)`                                                                       | When an id was last handed out                                         |
| Sign-out ticket | `<base64url JSON { c: client, s: account, e: exp }>.<HMAC>`                                            | HMAC-SHA-256 of `end-session:<payload>`, base64url; five minutes       |

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

### Signed out of this app only (the page's side, Work Tracker 1283)

`askSignOut(returnTo, { noteHereOnly })` (`@liveworkspace/auth-client/sign-out`) writes `noteSignedOutHere()` when the
app signed out (`ok`) with no hop (`next` null) and the caller asked for it. The note is `{ at: <ms> }` under
`lw:signed-out-here` in the tab's sessionStorage (`@liveworkspace/auth-client/signed-out-here`, no imports, so a
visitor's header can read it); a blocked sessionStorage drops it silently. `takeSignedOutHere()` reads it, removes it,
and answers true only for a note under `SIGNED_OUT_HERE_FRESH_MS` (60 s) old.

Who asks for the note: the account menu's `appSignOut` (`@liveworkspace/account-menu`, so a marketing page's menu and
the Explorer on an app's address, its header and Settings' Sign Out row), unless passed `{ noteHereOnly: false }`
(the Explorer's `endAppSession` after Delete Account); and each editor's `AccountsBridge` `signOut`, unless passed
`{ accountClosed: true }` (its Delete Account row's `onDeleted`, whose second sign-out has no refresh cookie left).

Who shows it: `SignedOutHereNotice({ app })` (`@liveworkspace/account-menu/signed-out-notice`) takes the note in an
effect after hydration and renders a `role="status"` card under the account control, in the control's palette, with
the app's name and a Dismiss button. `createSiteAccount({ app, … })` draws it beside every product's marketing
header control (where an editor's Sign Out lands, `/`), and the site's `AppAccountControl` beside the Explorer's on an
app's address, with `pageApp()`'s name.

| Case                                          | Result                                    |
| --------------------------------------------- | ----------------------------------------- |
| Sign Out, accounts site answered (`next` set) | no note; the hop, then no notice          |
| Sign Out, accounts site silent or no token    | note; the page lands and shows the notice |
| Sign Out after Delete Account                 | no note                                   |
| A note over a minute old, or unreadable       | dropped; no notice                        |
| sessionStorage blocked                        | no note, no notice; sign-out unchanged    |

### The guest hand-off (`GET /api/auth/guest?client_id=&redirect_uri=&state=[&resource=]`)

1. `GUEST_LIMITER` keyed `ip:<network>` (60 a minute): `429 rate_limited`.
2. The client read from `oauthClient` (not disabled) and its resources: none is `400 invalid_client`; the redirect URI
   must be one of its registered ones exactly (`400 invalid_redirect_uri`); `state` 1 to 200 characters (`400
invalid_state`); `resource` the client's only one, or named and one of its own (`400 invalid_resource`). Every
   `400` is `no-store`.
3. From here the browser always goes back: the cookie's guest (`oiat = now`), else the `lw_guest_proof` cookie's guest
   when `readGuestProof` passes (`oiat` carried from the proof), else a new `guest_<uuid>` (`oiat = now`);
   `noteGuestSeen`; a guest token signed with `exp = iat + GUEST_TOKEN_TTL_SECONDS` (45 days) and `oiat`; `302` to
   `<redirect_uri>#guest_token=…&state=…` with the cookie set again (`Max-Age` ten years, `Path=/; HttpOnly;
SameSite=Lax`, `Secure` outside development) and, when a proof cookie came, `lw_guest_proof` cleared (`Max-Age=0`),
   `no-store`, `no-referrer`.
4. A failure past step 2: `302` to `<redirect_uri>#error=server_error&state=…`.

### Renewing with a guest token (`POST /api/auth/guest?client_id=&redirect_uri=&state=[&resource=]`, `guestRenewal`)

1. `GUEST_LIMITER` and step 2 of the hand-off (`checkHandoff`), with the same `400`s.
2. The proof is the `application/x-www-form-urlencoded` body's `guest_token` alone; a `guest_token` in the query is
   never read. It is taken only when `Origin` equals `redirect_uri`'s origin and `readGuestProof` passes:
   `jwtVerify` against this Worker's own key set (`auth.api.getJwks()`), issuer `${BASE_URL}/api/auth` and its www
   twin, audience the hand-off's `resource` and its twin; `kind === 'guest'`; `sub` matches `GUEST_ID`; `exp` in the
   future (jose); `oiat` (else `iat`) a number, no more than 60 s ahead, and at most `GUEST_PROOF_MAX_AGE_SECONDS`
   (180 days) ago.
3. `303` to the request's own URL (the `GET`), `no-store`, `no-referrer`; with a proof that passed, `lw_guest_proof`
   set to the token (`Max-Age` 120, `Path=/api/auth/guest; HttpOnly; SameSite=Lax`, `Secure` outside development,
   host-only); otherwise no cookie, and the `GET` finds the cookie's guest or makes one. Logged `[guests] proof
refused { reason }` (`origin`, `token`) when a token came and was not taken.

The app's side. The page (`@liveworkspace/index-client/browser` `startGuestHandoff`), holding an unexpired token and
an api on its own origin (`apiBase` a path), sets `document.cookie = guestRenewalCookie(token, apiBase +
'/auth/guest')` (`lw_guest_renewal`, `Max-Age` 60, `Secure; SameSite=Strict`; blocked cookies are ignored) on the
next task, then `location.replace` as before. Its api's `GET /api/auth/guest?state=` (`createAppAuth`), configured
and with a renewal cookie shaped like a JWT (`renewalToken`: three base64url parts, each at most 2,000 characters),
answers `guestRenewalPage(guestHandoffUrl(…), token)` instead of its `302`: `200 text/html`, a form (`method=post`,
`action` the same address, one hidden `guest_token`) submitted by a nonced inline script as it loads (a Continue
button under `noscript`), attribute values escaped; `Content-Security-Policy: default-src 'none'; script-src
'nonce-…'; base-uri 'none'; frame-ancestors 'none'`, `X-Frame-Options: DENY`, `no-store`, `Referrer-Policy:
strict-origin` (never `no-referrer`, under which the POST's `Origin` would be `null`), and the renewal cookie cleared.
Anything else keeps the `302`.

### liveworkspace.app's own token (`GET /api/auth/workspace-token`)

`Sec-Fetch-Site: cross-site` is `403 cross_site`. A session: an access token `{ sub, email, email_verified, teams }`.
Otherwise a guest: a new one first passes `GUEST_LIMITER`; the guest stamped seen, the cookie set again. Either way
`exp = iat + 900`, `aud` every resource of the environment, `azp 'liveworkspace.app'`; answer `{ token, kind, sub,
expiresAt (ms) }`, `no-store`.

### Bearers on the account API (`bearer.ts`)

`Authorization: Bearer <token>` (not a merge key) is verified offline with `createPersonVerifier` against this
Worker's own key set (read in-process with `auth.api.getJwks()`, kept 5 minutes), issuer `${BASE_URL}/api/auth`,
audience the environment's resources. An API token (`lwt_`, `lvd_`) is not a JWT, so `jwtVerify` refuses it and it is
`401 signed_out` on every route. A guest reaches `GET /api/account/people` only (limited by `TEAM_LINK_LIMITER`
keyed `people:<range>`, names without pictures); an account also teams, invitations, settings, its profile, phone
devices, API tokens (`tokenRoutes`, the session door's handler, `waitUntil` threaded for the workbench cleanup),
Download Your Data (`handleDataExport` with `{ id, name: accountName(), email: verified or null }`), sessions and
sign-in methods. Anything else `401 signed_out` or `404 not_found`. `bearerSessionId` reads the verified token's
`sid` claim (the provider's own: the session the token was minted under), with `jose`'s `decodeJwt`, only after
`bearerPerson` has checked the signature.

### Sessions over the bearer (`own-sessions.ts`)

- `GET /api/account/sessions`: `SELECT id, userAgent, createdAt, updatedAt, expiresAt FROM session WHERE userId = ?`
  (`session_userId_idx`), expired rows left out, sorted by `updatedAt` newest first; dates answered as ISO strings;
  `{ sessions: [{ id, current, userAgent: string | null, createdAt, updatedAt }] }`, `current` = `id === sid`. The
  `token` column is never read.
- `DELETE /api/account/sessions/:id`: `SELECT id FROM session WHERE id = ? AND userId = ?`, else `404 not_found`;
  then `endSessionTokens(db, id)` (`end-session.ts`: the access and refresh tokens on it, then the row) and `{ id }`.
- `POST /api/account/sessions/revoke-others`: no `sid` is `409 no_current_session`; otherwise every session id of the
  account but `sid`, through `endSessionTokens` (40 a statement, one batch); `{ ended: <count> }`.

### Sign-in methods over the bearer (`link-google.ts`)

- `GET /api/account/sign-in-methods`: one `SELECT 1 FROM account WHERE userId = ? AND providerId = 'google'`
  (`account_userId_idx`); `{ google: 'connected' | 'available' | 'off' }`, `available` when `GOOGLE_CLIENT_ID` and
  `GOOGLE_CLIENT_SECRET` are set.
- `POST /api/account/sign-in-methods/google { callbackURL }`, in order: `409 google_off`, `409 already_connected`,
  `400 invalid_callback` (`linkCallback`: absolute `http(s)`, no credentials, at most `REDIRECT_MAX_LENGTH`, origin in
  `allAppOrigins(ENVIRONMENT)` or `BASE_URL`'s origin and its www twin), `409 session_ended` (no `sid`, or its row
  gone, expired or another account's). Answers `{ url: "${BASE_URL}/api/auth/link-google?ticket=<ticket>" }`.
- The ticket is `<payload>.<sig>`: payload base64url JSON `{ u: userId, s: sessionId, c: callbackURL, e: exp seconds }`,
  `sig` Better Auth's `makeSignature` (HMAC-SHA-256, base64) of `link-google:<payload>` under `BETTER_AUTH_SECRET`,
  compared in constant time; `e` is `LINK_TICKET_TTL_SECONDS` (300) from minting.
- `GET /api/auth/link-google?ticket=`: a bad or expired ticket, or a return address no longer allowed, is
  `400 { error: 'invalid_ticket' }` and goes nowhere. A session that is gone, expired or another account's is `302`
  to the return address with `?error=session_ended`. Otherwise the session's token is read by id and user and signed
  as Better Auth's session cookie in the request headers alone, and `auth.api.linkSocialAccount({ provider: 'google',
callbackURL, errorCallbackURL: callbackURL, disableRedirect: true })` runs with `returnHeaders`; a throw is `302` to
  the return address with `?error=link_failed`. The answer is `302` to Google's URL, `no-store`, `no-referrer`,
  carrying only the `state` and `oauth_state` Set-Cookies Better Auth made (any other, a refreshed session cookie
  above all, is dropped). Google comes back to `${BASE_URL}/api/auth/callback/google`, Better Auth's own callback
  (`getAuth`, never the app-address instance, since the request isn't proxied).

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
invalid_signature`); `into` an account or guest id other than `guest_<legacyId>` and its re-keyed id (`400
invalid_into`).
2. A signature (43 base64url characters) is checked first: HMAC-SHA-256 of the bare id (`403 bad_signature`).
3. One read: `legacy_guest WHERE id IN (guest_<legacyId>, rekeyedLegacyGuestOwner(legacyId))` (the second only with
   `LEGACY_GUEST_REKEY_SECRET`). The row is the re-keyed one with `rekeyedAt` set, else the plain one with it null.
4. No row: `200 { merged: false, reason: 'unknown' }`. Unsigned and first seen after `LEGACY_GUEST_SIGNING_LIVE_AT`:
   `403 signature_required`. Claimed: `{ merged: true }` for the same `into`, else `{ merged: false, reason: 'claimed' }`.
   Unsigned, unclaimed, first seen before it and not re-keyed: `503 unsigned_claims_paused`, nothing held or merged.
5. Held in one conditional update (`claimingBy`, `claimingUntil = now + 60 s`), taking over a lapsed or own hold;
   none: claimed answers as above, else `503 claim_in_progress`.
6. `mergeGuestInto(<the row's id>, …, { legacy: true })`; a plain row from before signing, with the re-key secret set,
   then merges its re-keyed id too. Failing releases the hold, `502 merge_failed`.
7. Stamped `claimedAt`, `claimedBy`; a race lost answers `claimed`. Logged `[accounts] legacy guest claimed { into }`.

### Re-keying the guests from before signing (`POST /api/auth/internal/legacy-guests/rekey`)

`404` without `LEGACY_GUEST_REKEY_SECRET`; `401` without `Bearer ADMIN_TOKEN` (`sameSecret`). Body `{ dryRun?, limit? }`
(`limit` 1 to `REKEY_BATCH_MAX` 50, default 25; else `400 invalid_limit`). Candidates: `claimedAt IS NULL AND rekeyedAt
IS NULL AND firstSeenAt < LEGACY_GUEST_SIGNING_LIVE_AT`, by `id`.

- Dry run: one read of every row's `firstSeenAt`, `claimedAt`, `claimingUntil`, `rekeyedAt`; answers `{ rows, claimed,
unclaimed, signedOnly, rekeyed, toRekey, held, sample }` (`sample`: up to 5 `{ from: 'guest_<8 chars>…', to }`).
- A run, per candidate up to `limit`, one at a time: hold (`claimingBy = 'rekey:<run uuid>'`, a minute, only with no
  live hold and still unclaimed and unmarked; none: `skipped`); `mergeGuestInto(old, re-keyed, { legacy: true })`
  (false: the hold released, `failed`); one batch: `settings` and `profile` `owner_id` to the re-keyed id, then the
  row's `id`, `rekeyedAt = now`, the hold cleared, `WHERE id = old AND claimingBy = <run> AND claimedAt IS NULL`.
  Answer `{ rekeyed, skipped, failed, remaining }` (`remaining`: candidates left after the run). Logged
  `[accounts] legacy guests re-keyed { rekeyed, skipped, failed }`.

Closing the account that claimed (`legacyGuestCloseStatements`, in `leaveAllTeams`' batch): `claimedBy` naming it
becomes `deleted`; a hold it has (`claimingBy`) goes, `claimingUntil` with it.

### Guests who never come back

`noteGuestSeen` upserts `seen_at` at most once a day per guest (the hand-off, the workspace token, and an app reading
or writing a guest's settings or profile). The daily `idle guests` step reads up to 500 ids unseen for 400 days,
oldest first, then one batch writes a `pending_purges` row for each (`teamIds` `[]`, an existing row left as it is)
and deletes their `settings`, `profile` and `guest_seen` rows, rechecking the cutoff in each statement. The
15-minute `index purges` step sends those rows to the index (`retryPendingPurges`: a guest has no `user` row, so it
is never dropped as unfinished), which deletes every item the guest owns. At 25 a run that step sends 2,400 a day,
well above the sweep's 500.

## Data and persistence

| Table          | Key        | Indexes                   | Written by                                      | Read by           |
| -------------- | ---------- | ------------------------- | ----------------------------------------------- | ----------------- |
| `guest_seen`   | `guest_id` | `guest_seen_at (seen_at)` | `noteGuestSeen`; profile merge deletes          | `sweepIdleGuests` |
| `legacy_guest` | `id`       |                           | the migration's copy (`firstSeenAt`); the claim | the claim         |

`legacy_guest` columns: `firstSeenAt`, `claimedAt`, `claimedBy`, `claimingBy`, `claimingUntil` (0013), `rekeyedAt`
(0024: when its id was re-keyed, null for an id still `guest_<old uuid>`).

## Errors and edge cases

| Case                                                                  | Answer                                                   |
| --------------------------------------------------------------------- | -------------------------------------------------------- |
| A forged or another site's guest cookie                               | a new guest                                              |
| A guest proof with the cookie there too                               | the cookie's guest                                       |
| A guest proof from another origin                                     | no proof cookie; the cookie's guest or a new one         |
| A forged, expired, another app's, an account's or a 180-day-old proof | no proof cookie; the cookie's guest or a new one         |
| A redirect URI not registered                                         | `400`, never a redirect                                  |
| The index down at sign-in                                             | signed in; the guest cookie kept for next time           |
| A cross-site workspace token request                                  | `403 cross_site`                                         |
| A sign-out hop to an unregistered origin                              | `400 invalid_redirect_uri`, never a redirect             |
| A sign-out hop with no or a bad ticket                                | back to the app; no session ended                        |
| A sign-out hop for another account                                    | back to the app; that session kept                       |
| Two legacy claims at once                                             | one merges; the other `503` or `claimed`                 |
| A re-key stopped between the index and accounts                       | the next run finishes it; a signed claim merges both ids |
| A share link's visitor sends the re-keyed owner id as a `legacyId`    | `unknown`, nothing merged                                |

## Security and trust

- A guest id is only ever believed from the HMAC-signed cookie, so nobody claims another guest's items at sign-up.
  The renewal's proof names a guest for one hand-off only: a guest token signed here, addressed to the app presenting
  it, from that app's own origin, never from a query string, and never over a cookie's guest. A chain of renewals by
  token alone carries `oiat` forward and ends 180 days after the cookie last vouched, so a stolen token can't live for
  ever; the sign-in merge still reads only the signed cookie.
- Guest tokens are signed by the same keys as access tokens and addressed to one app's API.
- The legacy claim checks possession before it reads the row, so a forged signature learns nothing. An unsigned
  claim merges only a re-keyed row, reached by deriving its id from the bare id: the stored owner id no longer reveals
  the bare id, and a stored id sent back is refused (`unknown`). Ids someone noted before the re-key still lead to the
  work: the re-key ends the exposure, it does not undo it.
- Ending a session needs the app's client secret and a live refresh token of that client; the browser's hop ends a
  session only with a ticket from that call, for the same account, so a link from another site signs nobody out and
  can only send the browser to an origin the client registered.

## Testing

| Test                                                                                                 | Pins                                                                                                                                 |
| ---------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| `liveworkspace/apps/accounts/src/guests.test.ts` (20)                                                | the guest hand-off; signing in as a guest; signing in to an app with a session already there; `prompt=none`                          |
| `liveworkspace/apps/accounts/src/guests.test.ts` "renewing without the cookie" (8)                   | same id without the cookie, the cookie wins, Origin, never the query, every refused proof, `oiat`, the 180-day chain                 |
| `packages/auth-client/src/app-auth.test.ts`, `packages/index-client/src/browser/guest-token.test.ts` | the renewal cookie, the api's posting page, its headers and escaping, and the plain hand-off otherwise                               |
| `liveworkspace/apps/accounts/src/workspace-token.test.ts` (4)                                        | the workspace token for an account, a guest, cross-site, the limit                                                                   |
| `liveworkspace/apps/accounts/src/end-session.test.ts` (20)                                           | ending a session from an app, the browser's hop, liveworkspace.app and Security: every app's tokens gone, tickets, redirects refused |
| `liveworkspace/apps/accounts/src/legacy-guests.test.ts` (24)                                         | claiming a returning guest of the old livediagram.app, re-keyed ids among them                                                       |
| `liveworkspace/apps/accounts/src/legacy-guest-rekey.test.ts` (9)                                     | re-keying the guests from before signing: the dry run, a run, holds, failures, resuming                                              |
| `liveworkspace/apps/accounts/src/guest-sweep.test.ts` (6)                                            | noting a guest seen; sweeping guests who can never come back, and queueing their items' purge                                        |
| `liveworkspace/apps/accounts/src/account-api.test.ts` (43)                                           | the people door and bearers among the rest, sessions, tokens                                                                         |
| `liveworkspace/apps/accounts/src/link-google.test.ts` (10)                                           | connecting Google from an app: the hop, the state cookie alone, Better Auth's callback, tickets, return addresses                    |

## Constants and configuration

`GUEST_PATH` `/guest`, `GUEST_COOKIE` `lw_guest`, `GUEST_TOKEN_TTL_SECONDS` 45 d, `COOKIE_MAX_AGE_SECONDS` 10 years,
`STATE_MAX_LENGTH` 200, `MERGE_TIMEOUT_MS` 5 s, `AUTHORIZE_PATH` `/oauth2/authorize` (`guests.ts`);
`GUEST_PROOF_COOKIE` `lw_guest_proof`, `GUEST_PROOF_COOKIE_MAX_AGE_SECONDS` 120, `GUEST_PROOF_MAX_AGE_SECONDS` 180 d,
`GUEST_PROOF_CLOCK_SKEW_SECONDS` 60 (`guest-proof.ts`); `GUEST_RENEWAL_COOKIE` `lw_guest_renewal`,
`GUEST_RENEWAL_COOKIE_PATH` `/api/auth/guest`, `GUEST_RENEWAL_COOKIE_MAX_AGE_SECONDS` 60 (`@liveworkspace/auth-client`
`guest-renewal.ts`);
`WORKSPACE_TOKEN_TTL_SECONDS` 900 (`workspace-token.ts`); `END_SESSION_PATH` `/end-session`, `TICKET_TTL_SECONDS` 300,
`REDIRECT_MAX_LENGTH` 2,000, `SESSIONS_PER_STATEMENT` 40 (`end-session.ts`); `KEYS_TTL_MS` 5 min (`bearer.ts`);
`LINK_GOOGLE_PATH` `/link-google`, `LINK_TICKET_TTL_SECONDS` 300 (`link-google.ts`); `LEGACY_CLAIM_HOLD_MS`
60 s (`legacy-guests.ts`); `REKEY_BATCH_MAX` 50, `REKEY_BATCH_DEFAULT` 25 (`legacy-guest-rekey.ts`); `GUEST_IDLE_MS` 400 d, `GUEST_SWEEP_LIMIT` 500 (`guest-sweep.ts`); `MAX_PROFILE_IDS` 100.
Rate limiters: `GUEST_LIMITER` `1003` (`2003`), 60 per 60 s; `TEAM_LINK_LIMITER` `1004` (`2004`), 20 per 60 s;
`LEGACY_GUEST_LIMITER` `1105` (`2105`), 10 per 60 s.

## Defaults ledger

- `ACC6`: a guest id unseen for 400 days (past the token's year and a browser's cookie cap) has its settings and
  profile swept.
- `ACC7`: a merge that fails keeps the guest cookie, so the next sign-in tries again; the sign-in itself never fails.
