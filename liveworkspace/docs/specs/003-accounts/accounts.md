# Teams, API tokens, guests, settings and profiles

Teams and tokens belong to the liveworkspace account, not to an app, and so do a person's settings and
profile. A team made once is the same team in
livediagram, liveplanner and every app after them; one API token, or one AI tool connected over
MCP, works on every app. Teams are made and run in the Explorer, wherever it shows
([one-explorer.md](../004-index/one-explorer.md#teams-are-run-in-the-explorer)); tokens and settings on liveworkspace.app
([Your account](../010-site/site.md#your-account-account)). All of them are kept by the accounts Worker (`apps/accounts`), in its own D1 beside the accounts
(`migrations/0002_teams_and_tokens.sql`). An app keeps no team or token of its own.

## Teams

A team has a name, an optional organisation line (a company or department, up to 80 characters),
admins and members. Anyone signed in can make one (up to 50 per account) and becomes its admin: from the
Explorer (`POST /api/account/teams`, by the session on liveworkspace.app or by the app's access token on an app's
address and in its editor), or from an app's own API (`POST /api/account/internal/teams`, the app vouching for
them with their access token, as it does for a token; `createTeamFor` in `@liveworkspace/auth-client`).
Admins rename it, change its organisation, invite people by email, turn its join link on and off,
change roles (making someone else admin is how a team changes hands), remove people, clear
answered invitations and delete it; anyone can leave. A team always keeps an admin: the last one
can't step down or leave while others remain, and the last member leaving deletes the team.
Closing an account leaves every team first: a team it ran alone goes, and one where it was the only
admin passes to the longest-standing member. Its address then comes off every team row it had (joined, removed, left
or declined), which reads "Deleted account" instead, in the members lists and the change feed alike.

**How an app and the index know someone's teams.** Neither keeps a copy. Every access token carries the
person's teams (`teams`, up to an hour old), and so does every API token check. A team made or joined
since then is usable at once: when a request names a team the claim doesn't hold, the app asks
`POST /api/account/internal/teams/of {userId}`, and the index asks `POST /api/account/index/teams` (with
the key it shares with accounts). Each gets the list a token minted now would carry. Only a miss asks,
and the answer is remembered for a moment (`@liveworkspace/index-app` `createTeamAccess`). Leaving a
team takes effect when the person's token is next minted.

| Who may                                                        | Admin                                      | Member |
| -------------------------------------------------------------- | ------------------------------------------ | ------ |
| See the team, its members and invitations                      | ✓                                          | ✓      |
| Invite by email, turn the join link on / off                   | ✓                                          |        |
| Change a role, remove someone, withdraw or clear an invitation | ✓                                          |        |
| Rename it, change its organisation, delete it                  | ✓                                          |        |
| Leave                                                          | ✓ (not the last admin while others remain) | ✓      |

A team always keeps a joined admin: demoting or removing the last one answers `409 last_admin`. The check is part of
the write itself, so two admins demoting or removing each other at once can't both pass it.

### Invitations

An invitation is a member row with the invited address, `invited` until answered. Accepting it
takes a signed-in account whose **verified** address is the one invited (signing in by code, or
with Google, verifies it). The invitation email links to the Explorer's Invites (`/explorer/invites`),
where it waits with the team's name, organisation and member count, beside **Accept** and **Decline**. Accepting or declining tells the team's admins by
email, unless an admin has turned that off (the `notifyInviteResponse` setting, `false`, in the
`all` scope; [Settings](#settings)). That email links to the account's settings on liveworkspace.app,
where it is turned off, and sends it as `List-Unsubscribe`.

The Explorer shows the invitations waiting in its sidebar, read from `GET /api/account/teams`, and answers
them in place (`POST /api/account/invitations/:member/accept` or `/decline`). An app's API can ask too:
`POST /api/account/internal/invitations` `{ userId }` answers the same list the Explorer shows (team name, organisation, member count, role,
who invited them and when), for the account's verified address, in two indexed reads
(`src/internal-invitations.ts`). The app vouches for the account, as it does for settings, and
remembers the answer for 30 seconds (`pendingInvitationsFor` in `@liveworkspace/auth-client`).

An invitation turned down is `declined`. It grants nothing and counts toward nothing, but stays on
the team's list so the admins can see the answer, until an admin clears it or invites the address
again, which replaces it with a fresh invitation.

**Declining from the email.** Every invitation email (and every reminder) carries a Decline link,
`/join/decline?token=<member id>.<secret>`, which works without an account or signing in. The
secret is 32 random bytes; only its SHA-256 hash is kept, in the row's `declineTokenHashes` (at
most four: the invitation and its three reminders). The token can read that one invitation's team
name and state and decline it, nothing else. The page only reads (`GET`) until its button is
pressed (`POST`), so a mail scanner opening the link changes nothing. Declining twice changes
nothing; an expired invitation stays expired; a membership can't be undone this way (`409
already_joined`); any token that doesn't match a live row, including one an admin cleared or
replaced, is the same `404 invite_not_found`.

### Reminders and expiry

An invitation nobody answers is followed up three times, then closes on its own. The accounts
Worker's daily cron (`17 9 * * *`, `sweepInvitations` in `src/teams.ts`):

1. **Expires** every invitation still `invited` 28 days after its clock started (`clockStartedAt`,
   when it was sent): it becomes `declined` with `expiredAt` stamped, shown to the admins as
   expired. Nobody is emailed. At most 500 a run, oldest first, whether or not email is set up.
2. **Reminds** the rest at 1, 7 and 21 days. The windows don't overlap, so an invitation hears at
   most one email a run: the latest it is due, with any it skipped stamped `0`. Each reminder
   carries a fresh decline token. At most 100 per stage a run; a failed send is tried again the
   next day, three times at most (`reminderAttempts`).

Reminders stop the moment the row is no longer `invited`.

**Counting them.** Each invitation, reminder and answer email sent is counted on the telemetry
service as `Email·Sent·<kind>` (`TeamInvite`, `TeamInviteReminder1` to `3`, and `InviteResponse`
for each admin told of an answer, the kinds the apps' own team emails used), under the app the
invitation's sender [signed up through](#onboarding-emails), so that app's dashboard keeps its team
email charts. A sender who signed up on liveworkspace.app (or before the app was recorded) isn't
counted. They are reported the way the onboarding emails are: held until the request's response has
gone (or the cron's sweep ends), then one batch per app, each request given two seconds, never
holding up or failing a send.

### The join link

A second way in: one link per team that an admin turns on, good for **7 days**. Anyone signed in
who opens it sees the team's name and joins as a member with one click.

- **Stored as a hash.** The link's token is an HMAC-SHA-256, under the Worker's secret, of a random
  nonce kept on the team (`inviteLinkNonce`); the team keeps the token's SHA-256 hash
  (`inviteLinkHash`, unique) for the lookup and `inviteLinkExpiresAt`. An admin can see the link
  again (it is recomputed), but the table alone never yields one.
- **On, anew, off** (admins): `POST /teams/:id/invite-link` makes a new link, ending any old one,
  for a week from now; `DELETE` turns it off. Deleting the team turns it off too. The team detail
  carries `inviteLink: { url, expiresAt } | null`, for admins only (null for members, and once it
  has expired).
- **The page** is `/join?token=<token>` on liveworkspace.app. Its preview, `GET /join/:token`, needs
  no session, so someone signed out sees what they'd join, then signs in and comes back to the
  same link. Joining, or someone already in the team, opens the team in the Explorer.
- **Joining**, `POST /join/:token`, signed in: adds them as a joined member. Already in: nothing
  changes. An invitation waiting for their address is accepted in place rather than doubled. An
  off, expired or unknown token is `404 invite_not_found`.

The two doors that need no session, the join preview and the Decline link, are limited per network
(`TEAM_LINK_LIMITER`, 20 a minute per IPv4 /24 or IPv6 /48).

Rows are never deleted. Leaving or being removed makes a row `removed`; deleting a team stamps
`deletedAt`. Every write takes the next number from one counter (`team_seq`) in the same batch, and
`GET /api/account/internal/teams/changes?cursor=…` answers every team and member written after the
cursor, oldest first, 500 a page. No app reads that feed any more (see below); it stays for a
deployment that still might.

### How an app keeps up

An app keeps no copy of teams. Its items are on the index, which decides team access from the person's token
claim, asking accounts only when a request names a team the claim doesn't hold (see "How an app and the
index know someone's teams" above).

## API tokens

A token (`lwt_…`, 32 random bytes) acts as its account on every app's API and MCP server, read
and write or read only, for six months. Only its SHA-256 hash is kept; the secret is shown once.
An account holds up to 20. They are made and revoked in the Settings panel, Account › API Tokens
(`/explorer?settings=tokens` on liveworkspace.app, [site.md](../010-site/site.md#settings)).

Connecting an AI tool in an app (its MCP OAuth flow) makes one too: the app's consent page sends
the person's access token to liveworkspace (`POST /api/account/internal/tokens`), which makes the
token for whoever that access token belongs to and only for an access token minted for that app.
So the connection shows among the API tokens in Settings and works on every app.

An app checks a presented token with `POST /api/account/internal/tokens/verify`, which answers
the account, its verified email, read-only and the account's teams. `createTokenChecker` in
`@liveworkspace/auth-client` remembers each answer per isolate for a minute (an unknown token for
ten seconds), so a burst of MCP calls costs one check; it is also how long a revoked token can go on
working in an isolate that had just checked it.

**Tokens carried over from the old livediagram.app** ([docs/migration.md](../../../../docs/migration.md) step 1) keep
their `lvd_` prefix. The old site stored them exactly as `api_token` does (the lowercase SHA-256 hex of the whole
token), so the migrate tool copies their rows in as they are and the secret is never needed. Every check of a
token's shape takes `lvd_` beside `lwt_`: `isApiTokenFormat` here (`src/tokens.ts`, which the self-revoke and the
workbench's own token checks use too) and in `@liveworkspace/api-kit` (each app's api and CLI). Nothing mints
`lvd_`: `generateApiToken` makes `lwt_` only.

### Workbench pairings

A token can also be paired with a workbench (a developer tool that frames an app's editor), approved once by its
owner on `liveworkspace.app/workbench/pair`. The pairings, the tickets they mint and the sessions those open live in
this Worker, one Durable Object per person ([workbench.md](../011-workbench/workbench.md)), so revoking a token here, or the CLI
revoking its own, ends them in the same request.

A local stack has one more door, for the apps' MCP evaluation benches: `POST /api/auth/internal/bench-accounts`
`{count, name?}` makes `count` throwaway accounts (up to 200) with one API token each and answers
`{accounts: [{userId, token}]}`. It needs `ADMIN_TOKEN`, as registering a client does, and exists only where
`ENVIRONMENT` is `development` (`src/bench-accounts.ts`).

### Expiry warnings

A week before a token expires, its owner is emailed once about it, so a script or connected AI tool
doesn't stop without warning (`src/token-expiry.ts`, the email in `src/email.ts`). It is an account
message, so it can't be turned off.

- **The email**, "Your liveworkspace API token expires soon", names the token and the day it
  expires, says what stops working when it lapses, and gives the three steps: make a fresh token,
  update whatever uses the old one, revoke the old one. Its button, "Manage your tokens", goes to
  `<BASE_URL>/explorer?settings=tokens` (the Settings panel on API Tokens). Tokens last six months, and this is the only reminder sent for each.
- **Sending.** The daily cron (`17 9 * * *`) picks the live tokens (not revoked, not expired) that
  expire within seven days and haven't been warned, whose owner has a verified address: at most 100
  a run, the soonest to expire first, in one query on a partial index holding only those not yet
  warned, each joined by primary key to its owner. The emails go one at a time, then one write
  stamps every token whose email went (`api_token.expiryWarnedAt`), so none is warned twice. A failed
  send isn't stamped, and the next day's run tries it again while the token is still in its week.
- **Telemetry.** Each warning sent is counted as `Email·Sent·TokenExpiring`, the kind the apps used,
  under the app the token's owner signed up through, as the team emails are; an owner who signed up
  on liveworkspace.app, or before the sign-up app was recorded, isn't counted. The events go with the
  daily run's one batch per app.

## On the Timeline

Teams and API tokens are run here, but their news belongs on the one Timeline the index keeps for every
app (docs/one-explorer-contracts.md "Timeline"). Each event is shown under All apps and in every app's
own view, marked as liveworkspace's:

| Event                 | When                                                       | Who sees it                         |
| --------------------- | ---------------------------------------------------------- | ----------------------------------- |
| `team_invite_sent`    | An admin invites an address                                | The team, and the invitee if known  |
| `team_joined`         | An invitation is accepted, or someone joins by the link    | The team and the person joining     |
| `team_declined`       | An invitation is turned down, on the site or from email    | The team (and the person declining) |
| `team_role_changed`   | An admin makes a member an admin, or an admin a member     | The team and that member            |
| `team_member_removed` | An admin removes a member, or a member leaves              | The team and that member            |
| `team_renamed`        | The team's name changes                                    | The team                            |
| `team_deleted`        | An admin deletes the team, or its last member leaves       | Everyone who was in it              |
| `token_created`       | A token is made                                            | Its owner                           |
| `token_revoked`       | A token is revoked, from the account page or by its secret | Its owner                           |
| `token_expiring`      | Once, in the daily run, for a live token within its week   | Its owner, dated at the expiry      |

A withdrawn invitation, a cleared refusal, and an account closing take nothing onto the Timeline.

Each event is written to `index_timeline_outbox` in the same batch as its change, so a change is never
recorded without its event, and an event is never recorded for a change that didn't happen (a token
refused over the limit, a second answer to one invitation). After the response, a request's events go to
the index in one call (`POST /internal/timeline`, with the merge key, at most 100 a call). The
15-minute cron sends again whatever is still waiting, up to 10 calls a run. An event's id is stable, so
sending it twice changes nothing; one the index keeps refusing is dropped after 96 tries. At most 5,000
events wait: each cron run first drops the oldest beyond that, so with no index configured, or one down for
days, the outbox stays bounded (`trimTimelineOutbox`). An event carries
the name of the person who acted, and for a member's event their name or address, so the Timeline can
say who without asking accounts.

## Guests

Someone using an app without an account is a guest, and the guest is the same person in every app
([one-explorer-contracts.md](../004-index/one-explorer-contracts.md#guests)). The first time an app needs an
identity it sends the browser to `GET /api/auth/guest?client_id=&redirect_uri=&state=` (and
`resource=` when its client has more than one API). The Worker (`src/guests.ts`):

- refuses with a 400 `{ error }`, never a redirect, unless the client is registered and
  `redirect_uri` is exactly one of its registered URIs; `state` must be there, up to 200 characters;
- reads its `lw_guest` cookie, or makes one: `guest_<uuid>` with an HMAC under
  `BETTER_AUTH_SECRET`, so a guest id can't be made up. It is HttpOnly, SameSite=Lax, Secure outside
  development, and set again on every visit (browsers cap a cookie at about 400 days);
- redirects to `<redirect_uri>#guest_token=<jwt>&state=<state>`. The token is signed by the jwt
  plugin with the same keys as access tokens (`/api/auth/jwks`): `iss` the issuer, `aud` the client's
  API, `sub` the guest id, `kind: "guest"`, for a year.
- once the client and `redirect_uri` have checked out, never leaves the browser on an error page: if
  anything after that fails (reading or setting the cookie, the seen stamp's database, signing the
  token) it logs it and redirects to `<redirect_uri>#error=server_error&state=<state>`, with no cookie
  set, so the app records a failed hand-off (and doesn't start another for five minutes) and carries
  on without a guest identity; the Explorer then says it couldn't reach the account rather than
  staying blank.

It is limited to 60 a minute per IP (`GUEST_LIMITER`).

**Signing in keeps a guest's things.** When a session is made for a request carrying a valid
`lw_guest` cookie (Better Auth's `session.create.after` hook), the Worker sends
`POST ${INDEX_URL}/internal/merge` `{ guestId, userId }` with `Bearer ${INDEX_MERGE_KEY}`, in the
background with a 5 second timeout, and clears the cookie, so the next guest visit starts a fresh
guest. A failed merge never fails the sign-in. Without `INDEX_URL` and `INDEX_MERGE_KEY` it does
nothing and the cookie stays.

An app's sign-in that finds a liveworkspace session already there, by a click or
[without one](#signing-in-without-a-click), makes no new session, so it does the same from the
authorize step instead (`mergeGuestOnAuthorize`): when the authorize answer carries a code and the
request a valid `lw_guest` cookie, the session's account takes the guest's settings, profile and
index items, and the cookie is cleared. Without a guest cookie it costs nothing.

### Returning guests of the old livediagram.app

The migration ([docs/migration.md](../../../../docs/migration.md) step 6) copies each old guest's work under
`guest_<old uuid>`, an id no browser is ever handed. The migrate tool also writes one `legacy_guest` row per
migrated guest (migration `0011_legacy_guest.sql`): `id` (`guest_<old uuid>`, the key), `firstSeenAt` (when the
old site first saw it, epoch ms), and `claimedAt` and `claimedBy`, null until it is claimed. This Worker only reads
and stamps the rows; it never makes one.

When the new editor finds the old id in a browser, livediagram's api forwards it here with its client credentials:
`POST /api/account/internal/legacy-guests/claim` `{ legacyId, signature, into }` (`src/legacy-guests.ts`).

- **Only with the secret.** Without `LEGACY_GUEST_ID_HMAC_SECRET` (the old site's `GUEST_ID_HMAC_SECRET`) the
  route is a plain 404, like any unknown route. Only livediagram's client may call it (another app's is 403
  `wrong_app`), and it is limited to 10 a minute per `into` (`LEGACY_GUEST_LIMITER`; absent, as in tests, not
  limited): 429 `rate_limited`.
- **The body.** `legacyId` is the old bare id, a lowercase v4 UUID; `signature` is the old `self-sig` (a string)
  or null; `into` is the caller as livediagram's api verified it, an account (`user_…`) or a guest
  (`guest_<uuid>`), never `guest_<legacyId>` itself. Anything else is 400 (`invalid_legacy_id`,
  `invalid_signature`, `invalid_into`).
- **Possession.** With a signature: HMAC-SHA-256 of the UTF-8 bare `legacyId` under the secret (its UTF-8
  bytes), written as base64url without padding (43 characters), checked with `crypto.subtle.verify` (constant
  time) before anything is read. A wrong one is 403 `bad_signature`. Without one, the row's `firstSeenAt` must be
  before `LEGACY_GUEST_SIGNING_LIVE_AT` (`@liveworkspace/migration`, 2026-09-25 12:00 UTC), the old site's own
  rule for ids from before signing; a later one is 403 `signature_required`.
- **The answers** (`LegacyGuestClaimAnswer`). No row: `{ merged: false, reason: 'unknown' }`. A row already
  claimed by someone else: `{ merged: false, reason: 'claimed' }`; claimed by `into` itself: `{ merged: true }`,
  so a retry is harmless. Otherwise the guest is merged into `into` exactly as a guest signing in is (above):
  when `into` is an account its settings and profile move first, then the index is sent
  `POST ${INDEX_URL}/internal/merge` `{ guestId: 'guest_<legacyId>', userId: into, legacy: true }` with
  `INDEX_MERGE_KEY` (the `legacy` form lets the target be a guest, [one-explorer-contracts.md](../004-index/one-explorer-contracts.md#guests)).
  Before the merge the claim holds the row (`claimingBy`, `claimingUntil`, migration `0013_legacy_guest_claiming.sql`)
  in one conditional update that needs no stamp and no live hold but the caller's own, so of two claims at once only
  one merges; the other is 503 `claim_in_progress`, which livediagram's api passes on and its editor takes as "try on
  a later load", keeping the old keys (it then finds the id `claimed`). A hold lasts a minute
  (`LEGACY_CLAIM_HOLD_MS`, far past the merge's 5-second timeout), so a claim that died midway frees the id.
  Only once the index has answered is the row stamped (`claimedAt`, `claimedBy`, in an update that also requires
  `claimedAt IS NULL`) and the hold cleared, and the answer is `{ merged: true }`. A failed or unconfigured index is
  502 `merge_failed`, stamps nothing and lets the hold go, so the next try merges again.

The route costs one primary-key read of `legacy_guest`, the hold (one primary-key update), the merge, and one
primary-key update.

### liveworkspace.app's own token

The Explorer lives on liveworkspace.app itself ([site.md](../010-site/site.md#the-explorer-explorer)), which has the session
cookie rather than an OAuth client. It asks `GET /api/auth/workspace-token` (`src/workspace-token.ts`) for
`{ token, kind, sub, expiresAt }`: an access token for the signed-in account, with its teams, or else a guest
token for the browser's `lw_guest` guest (made here on a first visit), the same guest every app's hand-off names.
Its audiences are every app's API, so the index takes it, and so does an app's API when the Explorer asks it for
an item's preview. It lasts 15 minutes; the page asks again a minute before it runs out. It answers only this
origin: there is no CORS, and a cross-site request (by `Sec-Fetch-Site`) is refused.

On an app's own address the Explorer asks as that app, with a token addressed to that app's API alone, yet it
draws every app's items. So each app's API takes a token addressed to any of the four apps' APIs (in the same
environment) for the Explorer's read of an item's tabs, `GET /api/<items>/<id>/tabs`, and for nothing else (its previews
are liveworkspace's, [previews.md](../006-media/previews.md)) (`@liveworkspace/auth-client` `explorer-reads.ts`). The route still checks that the person may read
the item. Every app's API answers any origin (CORS `*`), so the browser lets that read through.

## Signing in without a click

Someone signed in to liveworkspace who opens an app they have no session in is signed in by the
page itself, with no click. Each app is its own site and liveworkspace.app another, so an app can't
see the liveworkspace session from script: a fetch or a hidden iframe would need a third-party
cookie, which Safari and Chrome withhold. What always works is a full-page visit, so the app takes one
quick bounce through the accounts site. The mechanism is shared, in `@liveworkspace/auth-client/silent`
(`packages/auth-client/src/silent.ts`); each app wires it to its own cookies.

1. **The page.** An inline script first in the app's `<head>` (`silentSignInBootScript`) runs before
   anything renders. With no session hint for this app, it marks the tab's `sessionStorage`, stops
   the page loading, so no signed-out page paints and no app code starts, lets the page follow the
   device's light or dark setting meanwhile, and goes to the app's
   `GET /api/auth/silent?return=<path?query#hash>`.
2. **The app's Worker** (`startSilentSignIn`) sends it to `/api/auth/oauth2/authorize` with
   `prompt=none`, keeping its PKCE verifier and the return address in its own HttpOnly cookie (so a
   clicked sign-in in another tab is untouched) and setting a two-minute guard cookie.
3. **The accounts Worker** answers at once and never shows a page: a code when there is a session
   (taking a guest's things along, [above](#guests)), `error=login_required` when there isn't.
   Better Auth's OAuth provider does this for `prompt=none`; the apps' clients skip consent, so a
   session is all it needs.
4. **The app's callback** (`finishSilentSignIn`) knows the bounce by its cookie's `state`: with a
   code it signs in exactly as a clicked sign-in does; with an error, or a code swap that fails, it
   does nothing. Either way the browser goes back to the same path, query and hash.

`return` is followed only when it is a path on the app: another origin, `//host`, `/\host`, or a path with a
space, tab, newline or other control character (which the browser drops, so `/<tab>/host` would land on `//host`)
goes to the app's fallback page instead (`safeReturnPath`).

It never bounces:

- more than once per tab (`sessionStorage`), nor again in any tab of the app within two minutes (the
  guard cookie, `<prefix>silent`, which the route also refuses to bounce past, so it can't loop);
- with a session in the app already (its hint cookie, `<prefix>signed_in=1`);
- after the person signed out of that app. Signing out sets `<prefix>signed_out=1` (readable, the
  whole site, 400 days), which the page and the route both respect, and the next sign-in to the app
  clears it. Signing out also ends the liveworkspace session and every app's session in that browser
  ([Signing out](#signing-out)), so a bounce from any app finds no session, and the next sign-in asks
  for an email code or Google;
- inside a frame (embeds, the workbench), for a crawler (by user agent), or for an automated browser
  (`navigator.webdriver`), which also keeps the apps' own end-to-end suites unbounced;
- on the sign-in pages, the guest hand-off's way back, embeds, a share link (`?s=`) or liveplanner's
  form links, so their own flows are never interrupted. The AI-tool consent and device pages (`/oauth/*`)
  do bounce: they only work signed in, and the bounce keeps their address, so someone arriving from an AI
  tool with a liveworkspace session but none in the app is signed in rather than shown a Sign in step;
- when the app's API isn't on the page's own site, or the address is too long to carry (1,500
  characters), or the browser has no `sessionStorage` or cookies to guard it.

Whatever goes wrong on the way (no sign-in configured, rate limited, the accounts site down), the
route and the callback go back to the page rather than to an error.

**The cost.** One bounce per new tab for a person with no session in the app: four extra requests (the
stopped page, the app's route, the accounts site, the callback, which for a signed-in person also
swaps the code). Measured locally against the dev stacks (median of seven cold loads), it adds about
85 ms to a signed-in person's first load and about 50 ms to a guest's; on the deployed apps each hop is
a round trip to the edge, so it costs more. Later loads in the same tab add nothing, and a person
already signed in to the app never bounces. FedCM and the Storage Access API could make this a
background request one day, but neither works in every browser, so the bounce stays.

### An app's signed-in cookies

Beside its HttpOnly refresh cookie (on `/api/auth`), each app's API keeps four readable cookies on its
whole site, so its public pages can tell who is signed in without loading the session:

- `<prefix>signed_in`: `1` with a session, `0` once it ends. It says whether.
- `<prefix>account`: the account's name as a header shows it (given name, else full name, else email;
  at most 64 characters, URI-encoded). It says who. Set beside the hint at every sign-in and token
  refresh, cleared beside it at sign-out, a refused refresh and closing the account
  (`@liveworkspace/auth-client/account-name`).
- `<prefix>account_full`: the account's full name, when it has one that differs from `<prefix>account`
  (the same limits), so the avatar can show the first letters of the first and last names. Set and
  cleared with the name cookie; absent, the avatar reads the name cookie instead. A cookie of its own,
  not a second field in the name cookie, so a page built before it existed never shows a joined value.
- `<prefix>account_colour`: the account's presence colour, when its [profile](#profiles) has one
  (URI-encoded), so the avatar is painted in it. It comes from the ID token's `presence_color` claim,
  which the accounts Worker adds beside the name claims (one primary-key read of the profile per token
  it issues), so the app's API learns it from the token answer it already gets. Set and cleared with the
  name cookie, and dropped when it fails the safe-colour check (`isSafeColourValue`); the page checks it
  again when it reads it, since it is painted into CSS. Absent (Automatic, or a session from before it
  existed), the avatar falls back to the colour picked from the name. A colour changed in Settings ›
  Profile reaches an app's cookies at its next token refresh (the next page load of the app, or within
  the access token's lifetime on an open one), never with a request of its own.
- `<prefix>account_picture`: the account's own [profile picture](#profile-pictures) URL, when it has one
  (URI-encoded), so the avatar shows it. It comes from the ID token's `picture` claim, set and cleared with the name
  cookie, and dropped when it fails `isProfilePictureUrl`; the page checks it again when it reads it.

None holds a secret or authenticates anything. The marketing header's account menu reads them, so a
signed-in visitor sees their menu with no request, and a visitor makes none at all: they see the Guest button
([site.md](../010-site/site.md#the-header)), whose menu code is fetched only once the pointer or focus reaches it. Only a session from
before the name cookie existed (the hint without the name) asks `POST /api/auth/token` once, which sets it.

## Signing out

Signing out anywhere signs the person out everywhere in that browser. Sign out in livediagram, liveplanner,
livedocuments, livedesign or on liveworkspace.app itself ends the liveworkspace session on the accounts site and every
app's session that came from it, so the next Sign in, in any app, asks for an email code or Google and the person can
pick another account. Other browsers and devices stay signed in, and so do API tokens and AI tools' connections, which
belong to the account rather than to a browser. The accounts side is `src/end-session.ts`; an app's side is
`endAccountsSession` and `endSessionUrl` in `@liveworkspace/auth-client`.

**In an app.** The page asks its app's API, `POST /api/auth/sign-out?return=<path>`, which:

1. Asks the accounts Worker to end the session its refresh token came from: `POST /api/auth/end-session` from the
   app's Worker, with its client credentials (Basic, as for the token endpoint) and `{ token: <refresh token> }`. The
   accounts Worker checks both through the provider's introspection, so a token alone ends nothing. It deletes every
   access and refresh token issued on that session, every app's, then the session, and answers a **ticket**: the
   client and the account, signed with the Worker's secret, good for five minutes.
2. Clears its own cookies and sets the signed-out mark, as it always has, and answers `{ signedIn: false, next }`.
   `next` is the accounts site's
   `GET /api/auth/end-session?client_id=…&post_logout_redirect_uri=<app origin><path>&ticket=…`, or null when there
   was no refresh token to send or the accounts site didn't answer.
3. The page goes to `next` (a full-page visit: the only way an app on another site reaches liveworkspace.app's
   cookie), else straight to `<path>`.

At `GET /api/auth/end-session` the accounts Worker:

- refuses with a `400` that goes nowhere when the client is unknown or disabled, or `post_logout_redirect_uri` is not
  an `http` or `https` address, with no user name or password, at most 2,000 characters, on the origin of one of the
  client's registered redirect URIs. It never sends the browser anywhere else.
- with a ticket that is valid, unexpired and this client's: ends the browser's own session when it belongs to the
  ticket's account (its tokens for every app, then the session) and clears the session cookie. That catches a browser
  whose liveworkspace session is newer than the one the app signed in with (the old one ran out and the person signed
  in again elsewhere). A session already ended by step 1 just has its cookie cleared.
- leaves a session alone without a valid ticket, or when it belongs to another account, so a link from another site
  can't sign anyone out.
- then answers `302` to `post_logout_redirect_uri`, `no-store`, `no-referrer`.

The page lands back on the app with the signed-out mark set, so it never bounces, and is a guest. Should the hop
fail (the accounts site down), step 1 has already ended the session in every app.

**On liveworkspace.app.** Its Sign out (Better Auth's `POST /api/auth/sign-out`, same site) first deletes every app's
tokens issued on the session, then Better Auth deletes the session and its cookie. Settings › Security's Sign Out of
another device and Sign Out Others (Better Auth's `revoke-session`, `revoke-other-sessions`, and `revoke-sessions`)
do the same for the sessions they end, so that device's apps are signed out with it.

**Deleted, not revoked.** The tokens are deleted rather than marked revoked: the provider takes a revoked refresh
token shown again as a stolen one and deletes every refresh token that app holds for the account, on every device. A
deleted one is only unknown (`invalid_grant`).

**Another app's open tab.** It keeps the access token it holds, which lasts an hour from its last refresh, so it goes
on working until then; its next refresh is refused, and the app clears its cookies and shows the person signed out. A
reload of that tab asks for a refresh at once, so it loads signed out, as a guest: its silent bounce finds no
liveworkspace session. A second tab of the app signed out from shares its cookies, so it is the same, and the
Explorer on liveworkspace.app gets a guest's token at its next ask (within 15 minutes, or at once on a reload).

**Guests.** Signing out leaves the browser's guest (`lw_guest`) and each app's stored guest token as they are, so
afterwards the browser is the guest it was before signing in.

**What it costs.** Only a sign-out pays: one request from the app's Worker to the accounts Worker (an introspection,
one read and one batch of deletes in D1) and one extra full-page hop through liveworkspace.app (a read of the
client, the session lookup, one batch). No other request changes.

**What it can't reach.** An app with no refresh token to send (it had already lapsed) gets no ticket, so only its
own cookies go; and a browser whose liveworkspace session is another account's than the app's keeps that session.

## Signing in on the app's own address

Someone signing in to livediagram, liveplanner, livedocuments or livedesign stays on that app's
address the whole way: `livediagram.app/sign-in`, `/sign-up` and `/consent`, never a
liveworkspace.app page. The pages are the accounts site's own ([site.md](../010-site/site.md#accounts-sign-in-sign-up-consent)),
served by the app's router (`@liveworkspace/sites/workspace-proxy`, `workspaceRoutes`), and the
liveworkspace session still ends up on liveworkspace.app, so every other app
[signs in without a click](#signing-in-without-a-click) as before. On liveworkspace.app itself
nothing changes.

1. **The app** sends the browser to `/api/auth/oauth2/authorize` as always (its own sign-in link,
   the header's button, the Explorer's prompts, the guest banner, `/join`: every sign-in link on an
   app's address starts at the app's `/api/auth/sign-in`).
2. **The accounts Worker**, finding no session, would answer with its sign-in page. Instead
   (`src/handoff.ts` `signInOnAppAddress`) it answers with the same page on the app's address,
   when the client is one of the apps (`oauth_client_app`), its `redirect_uri` is one of its
   registered URIs and that URI's origin is one of the app's ([`appOrigins`](../../../../packages/sites/src/app-origins.ts):
   bare and `www.` in production, `staging.` on staging, the router's port locally). It adds
   `handoff=<sha256(nonce)>` to the page's query and sets the nonce in `lw_handoff` (HttpOnly,
   SameSite=Lax, Secure outside development, path `/api/auth/handoff`, 15 minutes), binding the
   sign-in to this browser.
3. **The app's router** serves `/sign-in`, `/sign-up` and `/consent` from liveworkspace.app when
   the query carries a signed OAuth request (`sig`), its build assets under `/_liveworkspace`, and
   the accounts API under `/api/workspace/auth` (beside the app's own `/api/auth`). On that route
   the app's own cookies never leave: only the sign-in's cookies go to the Worker, and the
   Worker's cookies land on the app's address renamed `lw_flow.<name>`, on that path alone,
   HttpOnly, Secure, SameSite=Lax and for at most 15 minutes (`flowCookieOut`). The router names
   the visitor's address in `X-Liveworkspace-Client-IP`, which the code limits count
   ([Limits](#limits)) instead of the router's.
4. **The page** signs in exactly as on liveworkspace.app (email code, name for a new account,
   Turnstile). Then it asks `POST /api/auth/handoff/start` `{ return, bind }` for a hand-off. The
   Worker refuses unless the request's `Origin` is one of the app origins (403), there is a
   session (401), `bind` is a nonce hash, and `return` is one of that same app's registered
   redirect URIs (400 `invalid_return`). It stores only the SHA-256 of a fresh 32-byte token, with
   the session, the bind and the address, for 60 seconds, clears the session cookie on the app's
   address in the same answer, and gives back `{ url }`: `https://www.liveworkspace.app/api/auth/handoff?token=…`.
5. **The hop.** One top-level visit to that URL (`GET /api/auth/handoff`) spends the token
   (single use, by one `UPDATE … WHERE usedAt IS NULL`), checks it hasn't expired, that the
   browser's `lw_handoff` nonce hashes to the stored bind, and the return address again; then sets
   the liveworkspace session cookie for that same session (access tokens already given out stay
   valid), clears the nonce, takes a guest's things over ([Guests](#guests)) and redirects to the
   app's callback with the authorize answer (a code). It sends no Referer and is never cached.
   Anything wrong answers a short page with a 400 and a link back to the app, never a redirect.

What this leaves on the app's address is the app's own cookies: the sign-in's `lw_flow.` cookies are
cleared by the hand-off and expire within 15 minutes in any case. A sign-in started on
liveworkspace.app, by an app that isn't one of the four, or with `SIGN_IN_ON_APP_ORIGINS` anything
but `"true"`, uses liveworkspace.app's pages as before.

**Google.** Google sends the browser back to a registered redirect URI, so on an app's address it
needs each app origin's `/api/workspace/auth/callback/google` registered with the Google client.
With `GOOGLE_ON_APP_ORIGINS="true"` the Worker uses that address for a request that came through an
app's router (a Better Auth instance per app origin, built on first use). Until then "Continue
with Google" on an app's address goes to liveworkspace.app's own sign-in page with the same signed
request and starts Google there; the person comes back to the app signed in, as everywhere else.

**Tests.** `src/handoff.test.ts` runs the real Better Auth over D1: the rewrite and when it doesn't
happen, a successful hop (same session, nonce cleared, only the hash stored, a guest merged), a
replayed token, an expired one, the wrong browser (which also burns the token), a made-up token,
eleven foreign or open-redirect return addresses, and each refusal of `/handoff/start`.

**The cost.** One extra top-level hop per sign-in, never per page. Measured locally against the dev
stacks (seven runs), the hop from the page to the app's callback took 19 to 33 ms, median 22 ms; on
the deployed apps it is one round trip to the edge plus two D1 writes (one at start, one spent),
roughly 100 to 300 ms once per sign-in. The sign-in page's own calls go through the app's router,
one subrequest each. `sign_in_handoff` rows older than a minute are deleted whenever a new one is
made, so the table stays small.

### Before deploy

`SIGN_IN_ON_APP_ORIGINS` is `"true"` in `wrangler.toml` (both environments): the routers serve the sign-in routes
and the site its assets under `/_liveworkspace`, and CI's deploy applies `migrations/0010_sign_in_handoff.sql` before
the accounts Worker's code. Outside the deploy, set once:

1. The Turnstile widget holds the app hostnames: `livediagram.app`, `www.livediagram.app`,
   `liveplanner.app`, `www.liveplanner.app`, `livedocuments.app`, `www.livedocuments.app`,
   `livedesign.app`, `www.livedesign.app`, and their `staging.` hosts for staging.
2. Google on the app's address is off (`GOOGLE_ON_APP_ORIGINS = "false"`, so Continue with Google goes through
   liveworkspace.app's own page). Turning it on adds these authorised redirect URIs to the Google OAuth client and
   sets the var to `"true"`:
   - `https://livediagram.app/api/workspace/auth/callback/google`
   - `https://www.livediagram.app/api/workspace/auth/callback/google`
   - `https://liveplanner.app/api/workspace/auth/callback/google`
   - `https://www.liveplanner.app/api/workspace/auth/callback/google`
   - `https://livedocuments.app/api/workspace/auth/callback/google`
   - `https://www.livedocuments.app/api/workspace/auth/callback/google`
   - `https://livedesign.app/api/workspace/auth/callback/google`
   - `https://www.livedesign.app/api/workspace/auth/callback/google`
   - staging: `https://staging.<app>/api/workspace/auth/callback/google` for each app
   - local: `http://localhost:3100`, `3200`, `3300` and `3400`, each with
     `/api/workspace/auth/callback/google`

Locally, an app client registered before the guest hand-off also needs its `/auth/guest` redirect
URI to sign a guest in.

## The move to www.

liveworkspace.app's address is `https://www.liveworkspace.app` ([site.md](../010-site/site.md) "www. is the address"), so the accounts
Worker's `BASE_URL` is that, and with it the OAuth issuer (`https://www.liveworkspace.app/api/auth`), the discovery
documents, the key set and every link in an email. Moving must sign nobody out and break no client, so for a
transition window the old bare names keep working beside the new ones.

**Both hosts answer.** Every API Worker (accounts, the index, media, the Community, telemetry, status, Drive) has the
same routes on `www.liveworkspace.app` as on `liveworkspace.app`. The bare routes stay for old clients.

**Tokens.** A token minted before the move names the bare issuer: access tokens for an hour, guest tokens for a year.
Every check of a liveworkspace token (`@liveworkspace/auth-client` `createVerifier` and `createPersonVerifier`, in
each app's API, the index, Drive and this Worker's own bearer check) accepts the issuer it is configured with and its
twin on the other host, and the same for each audience. The twins are one named constant,
`BARE_WWW_TRANSITION` in `@liveworkspace/sites/www`, with the date before which they must not be dropped. The key
set is the same on both hosts, so a check fetches it from wherever its `ACCOUNTS_URL` points. Two places check tokens
inside Better Auth, which only knows its own issuer: the account API's `vouchedPerson` and closing an account both
introspect an app's access token, and an inactive answer for a token on the bare issuer is checked again here,
against this Worker's own keys, the bare issuer, an app audience, the asking client (`azp`) and a live session
(`legacy-issuer.ts`). Refresh tokens and API tokens (`lwt_`, `lvd_` and the like) are opaque rows, so they never
named a host; CLI logins and MCP connectors, which hold those, keep working untouched.

**Audiences stay as registered.** An audience is a name, not an address: each app's client is bound to its resource
(`https://liveplanner.app/api`, `https://livediagram.app/api`), and every refresh token to the resources it was
granted for. Asking for a `www.` resource with one of those refresh tokens is refused, which would sign everyone
out, so `RESOURCES` and each app's `API_RESOURCE` stay as they are. Verification already accepts the `www.` twin, so
a later move needs only the clients' resources re-bound.

**The session.** In production every cookie this Worker sets (Better Auth's session and `dont_remember`, the
`lw_guest` guest cookie and the hand-off nonce) is scoped to `Domain=liveworkspace.app`, so one session is valid on
both hosts. A session made before the move is a host-only cookie on the bare domain: the bare domain's redirect
moves it to the domain in the same hop it sends the page to `www.` ([site.md](../010-site/site.md) "www. is the address"). Better Auth
trusts both origins (`trustedOrigins`), and the account API's and the workbench's same-origin checks take either.
Staging and local development keep host-only cookies.

A production cookie on `Domain=liveworkspace.app` also reaches `staging.liveworkspace.app`, under the same name as
staging's own, and Better Auth reads the first of two cookies with one name. So before Better Auth reads a request,
this Worker drops any copy of its signed cookies whose signature isn't its own (`own-cookies.ts`), only when a
name comes more than once; and a guest cookie is read from whichever copy is signed with this Worker's secret.

**Redirect URIs.** Every app's client already has its `www.` callbacks registered beside the bare ones
(`/api/auth/callback` and `/auth/guest` on both hosts; checked read-only on production on 2026-10-26).
`scripts/register-client.ts` takes both, and new clients are registered with both. Google's callback moves with
`BASE_URL`, so `https://www.liveworkspace.app/api/auth/callback/google` must be an authorised redirect URI of the
Google client before the accounts Worker deploys (the bare one stays).

**Deploy order.** The Workers that check tokens deploy before accounts starts minting them on the new issuer, and
the bare domain's redirect last, once `www.` answers every API (`.github/scripts/ci-plan.mjs`: accounts deploys with
the sites, the redirect with the routers).

**When the twins go.** Not before `BARE_WWW_TRANSITION.keepUntil`: a guest token minted on the last day before the
move lives a year. Then drop the bare twins from the constant and the bare API routes, and leave the bare domain's
redirect.

## Settings

A person's settings live with the account, in the accounts Worker's D1
(`migrations/0003_settings.sql`, `src/settings.ts`), not in any app. A guest has settings too, under
their guest id. An app keeps no settings table of its own.

### Scopes

Each setting is stored in one scope:

- **`all`**: shown by every app that has the setting. Changing it in one app changes it everywhere.
  Which keys are shared is one list, `ALL_SETTING_KEYS` in `@liveworkspace/settings`
  (`packages/settings`): privacy and accessibility, notifications, the editors' chrome, your own
  colours, and every editor setting two or more apps have (`COMMON_SETTING_KEYS`, below). Its
  `splitSettings` and `joinSettings` turn an editor's flat preferences into the two scopes and back.
- **an app's site id** (`livediagram.app`, `liveplanner.app`, `livedocuments.app`, `livedesign.app`,
  as `APP_SITES` in `@liveworkspace/sites` spells them): shown by that app only.

An app reads its own scope and `all`, and shows only the settings that mean something to it. It
decides which scope a setting belongs in. liveworkspace.app shows and changes `all` on its settings
page, and each app's own scope in that app's dialog there.

Which of an app's settings the site can show is plain data, `@liveworkspace/settings/catalogues/<app>`:
for each setting the app's own row key (its `id`), label, description, search keywords, section, parent row and
order, the stored key (or the field of an object kept under a key) and the value for each of its
states; for each category its parent category, its icon tile and its section notes and collapsed
sections. That is the shape of the shared Settings view's model (`@liveworkspace/settings-ui`), so the
site shows it in the same view as the app, with only each row's value and change to supply. `deriveCatalogue`
(`packages/settings/src/catalogue.ts`) works it out from the app's Settings catalogue by running each
row's read and write against probe values, and a test beside each app's catalogue
(`settings-site-catalogue.test.ts`) fails when the copy drifts; `UPDATE_SITE_CATALOGUE=1` writes it
again. A row that isn't one stored value (a list, several keys at once) or isn't a preference at all
(appearance, tokens, shortcuts) stays in the app's own Settings, and so does a shared key the panel shows elsewhere
(the Account section's switches, the editors' chrome); a common setting's rows stay in each app's catalogue, so the
app's own side shows them. Which shared switches the panel's Account section shows, and how they are worded, is
plain data too, `@liveworkspace/settings/account`; the common settings are built from the catalogues
(`commonCatalogue` in `@liveworkspace/settings/common`).

A scope is one row, keyed by owner and scope, holding a JSON object of setting names to values.

### Common settings

A setting two or more apps have is one setting, kept in `all`: `COMMON_SETTING_KEYS` in
`@liveworkspace/settings`, part of `ALL_SETTING_KEYS`. Changing it in any app, or in the Settings panel's All
view, where it shows once in its merged category ([site.md](../010-site/site.md#settings)), changes it in every app that has it. That is the
Home banner (`homeBanner`), the Collaborate, Quick Style, Layers and Map panels (`collaboratePanelEnabled`,
`quickStylePanelEnabled`, `layersPanelEnabled`, `layersShowPreview`, `layersShowCount`, `layerHoverPreview`,
`showMinimap`, `mapSize`, `mapDimOutside`), the canvas's `alignmentGuides`, `autoRebindArrows`,
`elementIndicatorStyle` and `quickAddOnHover`, Pages' `contentsPlacement`, and Presenting (`presentation`, one
object). Each has the same type, values and default in every app that has it. A key is shared only when it does
mean the same everywhere: `notifyDocumentJoin` stays livediagram's and livedocuments' own, one of each app's
"someone joins my …" emails beside liveplanner's `notifyProjectJoin` and livedesign's `notifyDesignJoin`, which
someone may well want from one app and not another.

These keys were each app's own until October 2026, so a person's values for them may still sit in an app's scope.
Nothing is lost: `joinSettings` takes a shared key from `all` when `all` has it, and otherwise from the app's own
scope, so each app keeps showing what it showed. The first change anywhere writes `all`, which then wins in
every app; `splitSettings` also deletes the writing app's old copy (a `null` in its app patch), so a reset
(deleting the key) can't bring an old value back there. Where the apps' old copies differ, the All view's row
shows the one from the app the panel was opened for, else the first app in the apps' order that has one. No
migration job runs: the accounts Worker stores keys without knowing what they mean, and the copies left in app
scopes are a few bytes each.

### Writing is per key

A write is a patch per scope: each key it names takes the new value, whole (an object value
replaces the stored one rather than merging into it), and a key set to `null` is deleted. Keys it
doesn't name stay as they are. The merge runs inside SQLite (`json_remove` then `json_patch`, one
upsert per scope), against the row as it stands, so two apps writing different keys at once both
land. A write covering both scopes is one batch, so it applies whole or not at all, and it answers
the settings as they now are.
An account id with no account behind it writes nothing and is refused (`404 unknown_owner`), as profiles are, so an
app access token that outlives a closed account (it lasts its hour) can't write the account's settings back. A
guest's id has no account row and writes as before.

### Limits

- A setting's name is 1 to 64 letters, digits, `_`, `.` or `-`.
- A patch must be a plain JSON object; anything else is refused (`settings_not_object`,
  `invalid_setting_key`).
- A scope holds at most 16 KB of JSON. A patch over that is refused at once with a 400; one that
  would take the stored row over it fails the whole write with a 413 (`settings_too_large`), enforced
  by a check on the table, so concurrent writes can't slip past it.

### Who calls what

- **An app's server** reads and writes someone's settings for itself with its client credentials:
  `POST /api/account/internal/settings/read` and `.../settings/write` (`readSettings` and
  `writeSettings` in `@liveworkspace/auth-client`). It names the owner: an id it has already verified,
  an access token's `sub` or a guest token's, the same trust as the teams feed. The owner must look
  like an account id (`user_…`) or a guest id (`guest_<uuid>`). An app reads and writes its own
  scope and `all`, and no other app's: naming another app is `403 wrong_app`
  ([Which app a client is](#which-app-a-client-is)).
- **The Settings panel** (`@liveworkspace/settings-ui`, [site.md](../010-site/site.md#settings)) reads and patches the
  signed-in person's settings from the browser. On liveworkspace.app it uses their session cookie; on an app's
  address (the Explorer there) and in each editor, the app's access token through the app's router
  (`/api/workspace/account/…`, the bearer door, `apps/accounts/src/bearer.ts`). Either door answers the same
  routes: `GET` and `PATCH /api/account/settings` for the `all` scope (the Account section's switches), and
  `GET /api/account/settings/:app` for both of the person's scopes for one app (the app's rows can depend on a
  shared switch), with `PATCH /api/account/settings/:app` `{ app }` patching the app's scope alone. A body's `all`
  is ignored there, and only the four apps' site ids are scopes. The profile is set in place through either door
  too: `GET` and `PATCH /api/account/profile`, the same handler on both (`profileRoute` in `src/account-api.ts`).
- **A guest's Settings panel** (the Explorer on an app's address, [site.md](../010-site/site.md#settings) "A guest") calls
  nothing. It reads and writes the guest's copy in the app's own storage on that address, the editor's
  `<app>:user-preferences:v1`, and marks it unsynced for the guest, so the editor sends it on through its own
  `/api/preferences` (as the guest's `guest_<uuid>` owner) the next time it opens.

Reading is one query on the primary key; writing is one upsert per scope plus that read, in one
batch.

### Closing an account, and a guest signing in

Closing an account deletes its settings rows with it ([Closing an account](#closing-an-account)). Settings have no foreign key to the account
(a guest isn't a user row), so this is done explicitly, beside leaving its teams.

When a guest signs in (the same hook that tells the index, above), their settings move to the
account, scope by scope. A key the account already has keeps the account's value; the guest's
other keys fill the gaps, as many as fit under the limit. Then the guest's rows are deleted. This
runs whether or not the index is set up, is safe to run twice, and a failure is logged without
failing the sign-in: the guest's rows stay for the next sign-in.

## Profiles

A person's display name and presence colour, what collaborators see on their cursor, their comments
and the presence list, kept with the account (`migrations/0006_profiles.sql`, `src/profiles.ts`), one
for every app. An app keeps no participants table of its own.

- **An account** shows its account name (the first and last name it registered with) until it sets a
  display name of its own; clearing that shows the account name again. Its colour is its own to set.
- **A guest** has whatever it sets, under its guest id.
- **Setting it from Settings.** The Settings panel's Profile sets an account's name and colour in place wherever
  it opens: over the session on liveworkspace.app, and over the app's bearer (`/api/workspace/account/profile`) on
  an app's address and in each editor. Both doors answer `GET` (`{ profile }`) and `PATCH { name?, color? }` with
  one handler; a guest's bearer is refused (`401 signed_out`), since a guest sets its name in the app itself.
- **An editor never overwrites a stored name.** On opening, an editor uses the profile as it is; only a first
  visit with none seeds one (the account name, or a guest's placeholder), so a display name set anywhere stays.
- A name is trimmed, 1 to 120 characters, with no control characters; a colour at most 64, and refused
  when it could load something or break out of a CSS value (the apps' `isSafeColourValue`), since it is
  painted into every peer's page. Either may be null: no name of its own, or the app's own pick of colour.
- The colours offered are one palette, `PRESENCE_COLOURS` in `@liveworkspace/settings`
  (`packages/settings`): ten named colours, each with the deeper shade dark mode paints it in under
  white text. Every app and liveworkspace.app's Settings offer the same swatches from it.
- The account menu's avatar, in every header, shows the account's [picture](#profile-pictures) when it has one, and is otherwise painted in the account's own colour
  ([site.md](../010-site/site.md#the-header)). It rides where the user already does, so it costs no request: the
  ID token's `presence_color` claim for the apps (kept in [`<prefix>account_colour`](#an-apps-signed-in-cookies)),
  and `user.color` in the answer to `GET /api/auth/get-session` for liveworkspace.app (one
  primary-key read of the profile per call; the Worker adds it to that endpoint's answer only, not to
  every session lookup).

An app reads up to 100 ids at once (a presence list, a page of comments): one query, each id found by
primary key in the profiles and the accounts, so an account that never set anything still answers with
its name. Ids that are neither are left out. Setting one's own name or colour is one upsert of the
fields named. An account id with no account behind it is refused (`404 unknown_owner`), so a closed
account can't be written back.

Closing an account deletes its profile. When a guest signs in, the account keeps its own colour and
display name and takes the guest's colour when it has none (and the guest's name only when the account
has no name at all); then the guest's profile goes. Both run beside the settings, in the same hook.

### Profile pictures

Someone who signs in with Google shows their Google profile picture on their avatar, in every app and on
liveworkspace.app: the account menu, Settings › Profile, presence avatars, cursors, comments, the Explorer's Inbox,
Timeline and history, team lists and the Share dialog. Everyone else, and anyone whose picture can't be shown,
shows the initials on their colour, exactly as before. This brings back what livediagram, liveplanner,
livedocuments and livedesign showed under Clerk (`315dcc55b`), which went when they moved onto liveworkspace
accounts (`b964b391d`, `46ae449b1`, `ff9a2d834`, `ff2ef0123`), since the accounts Worker kept no picture then.

- **Where it comes from.** Google's `picture` claim, the one Google hands over at sign-in, kept on the account
  (`"user".image`, Better Auth's own column, in `0001`). It is set when an account is made with Google, when Google
  is connected to an account made with an emailed code, and again at every Google sign-in, so a new Google picture
  shows after the next one (Google sends no change notice, so nothing can learn of it sooner). A sign-in reads the
  claim from the ID token Google has just handed over (the `account` row's hook, `auth-options.ts`), and writes the
  account only when the picture changed: one conditional `UPDATE`. Only an `https:` URL on
  `lh3.googleusercontent.com`, at most 512 characters, is kept; anything else is no picture
  (`isProfilePictureUrl`, `@liveworkspace/sites/picture`, which every app and the shared avatar check again). An
  account that only ever signed in with an emailed code has none. Nothing fetches, stores or proxies the image: only
  the URL travels, and each browser loads it from Google.
- **The switch.** **Show My Google Picture** in Settings › Profile, for an account with a picture, on unless turned
  off (`profile.show_picture`, `migrations/0012_profile_picture.sql`; null is on), saved at once; a refused write
  puts back what the server last took, newest wins. Off, everyone else sees the
  initials everywhere; your own chrome still shows it to you, since it is your screen. It is not a choice between
  pictures: the accounts Worker has no upload, so the picture is Google's or none, and the colour stays your own
  either way (it rings the picture in presence, and paints the initials where there is no picture).
- **Who sees it.** You, always. Others who are signed in, while your switch is on. A guest, an anonymous share-link
  visitor or anyone signed out never receives anyone's picture URL: the doors below leave it out for them.
- **How it travels**, always with the person data a surface already reads, never a request of its own:
  - **Your own**: the ID token's standard `picture` claim beside the names and `presence_color` (the same one
    primary-key read of the profile, which now also gives `picture_hidden: true` when the switch is off); the app's
    readable `<prefix>account_picture` cookie beside `<prefix>account_colour`, for the marketing header; and
    `user.image` in `/get-session`'s answer on liveworkspace.app (Better Auth's own field), beside `user.color`.
  - **Anyone's, by id**: `picture` on each `Profile` (the published one: null when there is none or the switch is
    off), from `POST /api/account/internal/profiles/read` (an app's server, which passes it on only to signed-in
    viewers) and on each of `GET /api/account/people`'s answers, for an account's session or bearer only (a guest's
    answer has names alone). Both read the account's row by primary key in the same query as the name.
  - **Team members**: `picture` on each joined member of a team's members list, read in the same query.
  - **Realtime rooms**: each app's room carries `picture` in a participant's presence, as it did before: the editor
    sends its own (when not hidden) in `hello`, the room keeps it only from a session a signed-in account holds and
    only when it passes `isProfilePictureUrl`, and sends it only to sessions that are themselves accounts.
- **How it is drawn.** One avatar, `PictureDisc` in `@liveworkspace/ui` (`packages/ui/src/optical/PictureDisc.tsx`):
  the initials on their disc always render, and the picture is an `<img>` over them with fixed `width` and
  `height`, `loading="lazy"`, `decoding="async"`, `referrerpolicy="no-referrer"` (Google's image host refuses some
  requests that carry a referrer, and it never learns which page is open) and the person's name as its `alt`. It
  asks Google for the size it paints (`=s<px>-c`, a 1x and a 2x source, 16 to 1024 px, 96 when the size is no number), shows only once loaded, and on an error
  falls back to the initials for the rest of that URL's life on the page. So a picture never moves anything.
- **The Content-Security-Policy.** Every app's and liveworkspace.app's pages send Trusted Types only, with no
  `img-src` or `default-src`, so Google's image host is allowed. A test keeps it that way: should an `img-src`
  arrive, it must name `https://lh3.googleusercontent.com`
  (`packages/sites/src/picture-csp.test.ts`).
- **Existing accounts.** An account made with Google before this has no picture until its next Google sign-in; one
  that signs in with an emailed code keeps none.
- **Closing an account** deletes the row and the URL with it.

### Guests who never come back

Every guest hand-off stamps when that guest id was last seen (`guest_seen`, at most one write a day
per guest), and so does an app reading the guest's settings or writing its profile, so a guest an app
already knows is kept alive however it came by the id. A guest still using an app gets a fresh token before its year is up, so it is never
more than a year unseen. Once a guest id has gone 400 days unseen its token has lapsed and browsers have
dropped its cookie (Chrome keeps one at most 400 days), so no app can be handed it again, and the
daily cron (`17 9 * * *`, `src/guest-sweep.ts`) deletes its settings and profile: up to 500 guests a
run, the longest unseen first, checked again in the deletes so a guest seen meanwhile keeps everything.
Its items stay in the index, as every guest's do, until someone deletes them
([one-explorer-contracts.md](../004-index/one-explorer-contracts.md#guests)). Signing in removes the guest's stamp
with the rest of the guest.

## Sign-ups and milestones per app

Each app counts a sign-up the first time it sees an account, and some send a one-time milestone email
(the tenth item someone makes there, their first share link). Both are kept per account and app in
`account_app` (`migrations/0007_account_apps.sql`, `src/account-apps.ts`), which goes with the account.
The app is always the calling client's own ([Which app a client is](#which-app-a-client-is)).

- **A sighting** (`POST /api/account/internal/sightings` `{ userId }`) answers `{ first }`: true only
  the first time this app sees the account. One statement, an insert whose `RETURNING` row says it was
  new, so two requests racing still count one sign-up. An unknown account is never first.
- **A milestone** (`POST /api/account/internal/milestones/claim` `{ userId, milestone }`, `milestone`
  or `firstShare`) answers `{ claimed }`: true for the first claim only, so a burst of saves at the
  milestone sends one email. The app claims before it sends. One conditional update; false when this
  app has never recorded a sighting of the account.
- **Emails** (`POST /api/account/internal/emails` `{ ids }`, up to 100 account ids) answers
  `{ emails: { [id]: address } }`, verified addresses only, in one query: where an app sends its
  notifications (a comment on what someone owns, a form response). An app keeps no addresses of its own.

## Emails

Every email accounts sends is drawn in one frame (`src/email-layout.ts`), the same as the apps' own: a card on
the brand's palest tint, its prism's colours in a band across the top, the logo mark beside the wordmark, and a
sign-off. The marks are transparent 64px PNGs at `/email/<name>-mark-64.png` on each site (liveworkspace's in
`apps/site/public/email/`), because Gmail and Outlook drop SVG.

- **The sign-in code** wears the brand of the app it was asked for through: a send that comes through an app's
  address (its router's proxy, [Signing in on the app's own address](#signing-in-on-the-apps-own-address)) is in that app's colours and logo, and
  its subject names the app (`123456 is your liveplanner sign-in code`). One on liveworkspace.app's own page is
  liveworkspace's. The code sits alone in a tinted panel.
  Only `POST /api/auth/sign-in/email-otp` takes a code, and spends it. Better Auth's other code routes
  (`check-verification-otp`, which checks a code without spending it and counts attempts in two steps, so guesses
  sent at once count as one; and the password, email-verification and email-change flows, which nothing here uses)
  are off (`UNUSED_CODE_PATHS` in `src/auth-options.ts`) and answer `404`.
- **The onboarding series** is liveworkspace's, whichever app it speaks for.

## Notification emails

An app's notification emails (someone commented on, joined or filled in something you own; a teammate
mentioned you or assigned you an action; your tenth item and your first share link) are the app's to send,
and accounts holds what they need: addresses, the switches, teams' people and the milestone claims. The
rules every app keeps, and the two questions it asks before it writes, are shared in
`@liveworkspace/auth-client` (`src/notify.ts`), so the apps send them the same way.

- **Who gets one.** `notificationRecipients(credentials, { app, ids, setting, scope })` answers the
  verified addresses of those accounts who have not turned `setting` off, in two requests at once
  whatever the count: the emails above, and
  `POST /api/account/internal/settings/notify` `{ owners, app, keys }` (up to 100 owners, 1 to 8 keys,
  each a `notify…` key), which answers just those keys for each owner, in the `all` scope and the
  calling app's (`{ settings: { [owner]: { all, app } } }`, an owner with nothing stored left out). One
  query over the settings' primary key and their JSON, so a mention of twenty people costs what one
  does. A switch read that fails counts as on; an address read that fails reaches nobody. Guests are
  dropped first: they have no address.
- **A team's people.** `POST /api/account/internal/teams/members` `{ teamId }` (`readTeamPeople`)
  answers the team's name and its joined and invited people (`{ id, userId, email, name, role, status }`,
  `id` the membership row, `name` the profile's, else the account's, null for someone invited), or 404
  for no such team. One query. The app shows it only to someone its token says is in the team, and an
  app sends a mention or an assignment only to these people (`teamTargets`), never to anyone a request
  names.
- **Once only.** The milestone and the first share go once per account and app, claimed here
  (`milestones/claim`, above) before the email goes. The rest are the app's to keep once only, where its
  item lives (liveplanner keeps them in each plan's own store): at most one "someone joined" email per
  item per 15 minutes (`JOIN_NOTIFY_THROTTLE_MS`), and the same assignment or mention once a day
  (`NOTIFY_EMAIL_DEDUPE_MS`), with at most 60 a sender an hour (`NOTIFY_EMAILS_PER_SENDER_PER_HOUR`), taken
  from the sender's allowance here (`POST /api/account/internal/allowance`, kept per app in the sender's
  Durable Object, [workbench.md](../011-workbench/workbench.md)).
  Claim keys for text an email carries are SHA-256 hashes (`notifyClaimKey`), so no store holds the
  words.
- **What happened.** The index tells an item's app that someone made a share link on it or opened it
  through one for the first time, and counts the items a person has made in it
  ([one-explorer-contracts.md](../004-index/one-explorer-contracts.md) "Notices").

## Onboarding emails

A short series that introduces liveworkspace, one per account rather than one per app, so someone who
uses all four apps hears it once (`migrations/0008_email_lifecycle.sql`, `src/lifecycle.ts`, the
emails in `src/lifecycle-email.ts`). It is sent by this Worker, through Cloudflare Email Service ([email.md](email.md)) like
every other email it sends, with the same timings and tips each app's own series had:

| Stage      | When                                                                           | Can be turned off |
| ---------- | ------------------------------------------------------------------------------ | ----------------- |
| Welcome    | when the account is made, after the sign-up's response has gone                | no                |
| Activation | ~3 days in, to someone who hasn't made anything in any app, before week 1 goes | yes               |
| Week 1     | ~7 days in: the Explorer, across every app                                     | yes               |
| Week 2     | ~14 days in: teams, made in the Explorer                                       | yes               |
| Win-back   | once, ~4 weeks after their last save in any app                                | yes               |

- **The row** is made with the account (Better Auth's `user.create.after` hook), and goes with it. The
  client registrar and accounts imported from Clerk (written as SQL) have none, so they are never sent
  the series.
- **Turning tips off** is the `notifyTips` setting, `false`, in the `all` scope
  ([Settings](#settings)), so it holds in every app. A stage someone has turned off is stamped and
  not sent. Each email that can be turned off links (and sends `List-Unsubscribe`) to the account's
  notification settings on liveworkspace.app (`<BASE_URL>/explorer?settings=notifications`, the Settings panel on
  Notifications), where someone signed out signs in
  and comes back. Its other links go to the app the email speaks for (below).
- **The app a sign-up came through** is kept on the row (`signup_app`,
  `migrations/0009_signup_app.sql`) when the account is made: the app of the OAuth client whose
  authorize request it was made in ([Which app a client is](#which-app-a-client-is)), read from the
  signed `oauth_query` the sign-in page sends back (carried across the trip to Google in the
  provider's server context), or `liveworkspace.app` for a sign-up on the site itself. A client with
  no app, and an account made before this was recorded, leave it empty. Each email speaks for that
  app, else the first app they used; someone who signed up on liveworkspace.app and hasn't opened an
  app yet is sent to the apps on liveworkspace.app (`/#apps`) to pick one.
- **Activity.** The apps report when someone saves something they own
  (`POST /api/account/internal/activity` `{ userId, at? }`, at most once a minute an item, as the
  item's summary push does). It only moves forward, never past now, and writes nothing when it
  wouldn't move. A guest's is accepted and ignored. Until the first one the account counts as having
  made nothing.
- **Sending.** The welcome goes from the request that made the account, in `waitUntil`; the
  15-minute cron catches up one that failed, and the daily cron (`17 9 * * *`) runs every stage, up
  to 100 accounts a stage, the longest-waiting first, one email at a time. Each stage is claimed
  (stamped) before it is sent, so two runs can't both send it; a failed send takes the stamp back
  and counts against the row, and after three in a row the account leaves every list (a dead
  address). A success resets the count. Only a verified address is ever sent to.
- **Each due list** is one query on a partial index holding only the accounts still owed that stage,
  joined by primary key to the account, its `all` settings and its first app.
- **Telemetry.** Each email sent is counted as `Email·Sent·<kind>` (`Welcome`, `Activation`,
  `Week1`, `Week2`, `WinBack`, the kinds the apps' own series used) on the telemetry service
  ([telemetry.md](../008-telemetry/telemetry.md)), under the app the email speaks for (its links' app) with that app's
  Worker key, so each app's dashboard keeps its Emails Sent charts (`src/telemetry.ts`). An email that
  speaks for liveworkspace itself isn't counted: the service and its dashboards chart the four apps,
  and counting it under one of them would credit that app with a sign-up it never had. The kind and
  the app only, never a recipient. The events wait until the run that sent them ends and go as one
  batch per app, through the `TELEMETRY` service binding, each request given two seconds. A failure, a
  missing key or a slow service is logged at most: it never holds up or fails a send. An app with no
  `TELEMETRY_KEY_<APP>` secret set isn't counted.

An app's own one-time milestones (its tenth item, its first share link) stay that app's to send:
[Sign-ups and milestones per app](#sign-ups-and-milestones-per-app).

## Closing an account

An app's server asks (`POST /api/auth/delete-account`, with its client credentials and the person's
access token, `src/delete-account.ts`), and the account closes for every app at once:

1. It leaves every team: a team it ran alone is deleted, and one where it was the only admin passes to
   the longest-standing member. Then every `team_member` row it had (its own by `userId`, and those addressed to it that
   were declined or removed) has its `email` replaced by "Deleted account" (`DELETED_MEMBER_EMAIL`), in one update
   that moves them on in the change feed (`rev`), so the apps' copies lose the address too. An invitation still
   waiting is the inviter's, to an address, and keeps it.
2. Its settings rows and its profile are deleted, and its workbench store is emptied: every pairing ends and the
   rooms its sessions had open are closed ([workbench.md](../011-workbench/workbench.md)).
3. A purge request for the index is written to `pending_purges` (`migrations/0004_pending_purges.sql`),
   naming the teams deleted in step 1.
4. The user is deleted, and with it its sessions, linked sign-ins, OAuth tokens and consents, API
   tokens, its onboarding series and what each app recorded of it (sign-ups and milestones).
5. The request is sent to the index (`POST ${INDEX_URL}/internal/purge-person` `{ personId, teamIds }`,
   `Bearer ${INDEX_MERGE_KEY}`, the same key and binding as the guest merge; `src/index-purge.ts`), which
   purges every item the person owns, with its content in each app, and everything else it holds for
   them ([one-explorer-contracts.md](../004-index/one-explorer-contracts.md#closing-an-account)). Once the index
   takes it, the row is cleared.
6. After the answer, the Google Drive mirror is told (`DELETE /app/people/<id>` on the `DRIVE` service binding,
   `Bearer ${DRIVE_KEY_ACCOUNTS}`; `src/drive-disconnect.ts`): it revokes the grant and forgets the token and every
   mirror row, and leaves the files in Drive ([drive.md](../005-drive/drive.md#disconnecting-and-account-deletion)). Best
   effort and never retried: a failure is logged, and without the binding or the key nothing is sent.

The account is closed whatever the index answers. A request it doesn't take (an error, a timeout, or
`INDEX_URL` or `INDEX_MERGE_KEY` unset) stays in `pending_purges` with its attempts and last error, and
the Worker's cron sends it again every 15 minutes (`*/15 * * * *`, 25 a run, the longest-waiting first)
until it lands. Each failure is logged, as an error from the third on. The index's purge is idempotent,
so a request sent twice does no harm.

## Which app a client is

Each app's OAuth client is registered as that app (`--app livediagram.app` to
`scripts/register-client.ts`; the `oauth_client_app` table, `migrations/0005_client_apps.sql`). What
belongs to one app is reached only by that app's client: its settings scope (beside `all`), and its own
sign-up sightings and milestones. Every other internal route (tokens, the teams feed, profiles, emails)
serves any of our clients. A client with no app is refused the per-app routes with
`403 client_has_no_app`. The app is looked up with the client's credentials and remembered with them per
isolate for five minutes, so it costs one primary-key read per five minutes per client.

`scripts/map-clients.ts` sets the app for a client registered without one. Run with `--local` (or
`--remote`, with `--env staging` for staging), it gives every client named after an app
(`livediagram`, or `livediagram-dev` as the local setup registers it) that app; with
`--client <id> --app <site id>` it sets one. After pulling this change, run it once against your local
database so the local dev clients keep working:

```sh
cd liveworkspace/apps/accounts
corepack pnpm db:migrate:local
node scripts/map-clients.ts --local
```

## The API

On liveworkspace.app, routed to the accounts Worker (`/api/account/*`).

For the signed-in person, by their session cookie. Writes must come from the site's own origin. The team
rows below (making, running, inviting, the join link, roles, removing, leaving, answering an invitation), the
reads of names and teams, and the settings routes (reads, and patches of `all` and of an app's scope, for the
Settings panel) are also answered for an **app's bearer**: the access token the accounts Worker
minted for one of the app APIs, sent by the Explorer on the app's address and by the app's editor through the app's
router (`/api/workspace/account/…`; `src/bearer.ts`). A bearer is no ambient credential, so its writes need no
same-origin check. A guest's bearer reads names alone; an API token (`lwt_…`) is not a bearer here, so no tool or
script runs a team. An account's bearer also reads and sets its own profile (`GET` and `PATCH /api/account/profile`,
the session door's own handler), which grants nothing new: the app's API already sets the same name and colour with
the same token (`PUT /api/participants/:id`). Joining by link and tokens stay the session's.

| Route                                                          | Does                                                                                                                 |
| -------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| `GET /api/account/teams`                                       | their teams (counts and first four members each, one query) and the invitations waiting                              |
| `POST /api/account/teams` `{ name, organisation? }`            | makes a team, with them as admin                                                                                     |
| `PATCH` / `DELETE /api/account/teams/:id`                      | `{ name?, organisation? }` / deletes (admins)                                                                        |
| `GET /api/account/teams/:id/members`                           | the team, their role, members and invitations, and `inviteLink` (admins)                                             |
| `POST` / `DELETE /api/account/teams/:id/invite-link`           | makes the join link anew / turns it off (admins)                                                                     |
| `GET /api/account/join/:token`                                 | no session needed: the team a join link names                                                                        |
| `POST /api/account/join/:token`                                | joins through the link, as a member                                                                                  |
| `GET` / `POST /api/account/invitations/decline/:token`         | no session needed: reads / declines the invitation an email's Decline link names                                     |
| `POST /api/account/teams/:id/members` `{ email, role }`        | invites an address and emails it (admins)                                                                            |
| `PATCH /api/account/teams/:id/members/:member`                 | changes a role (admins)                                                                                              |
| `DELETE /api/account/teams/:id/members/:member`                | removes someone (admins), or leaves (oneself)                                                                        |
| `POST /api/account/invitations/:member/accept`                 | joins (the invited, verified address only)                                                                           |
| `POST /api/account/invitations/:member/decline`                | declines                                                                                                             |
| `GET` / `POST /api/account/tokens`                             | lists / makes a token (the secret once)                                                                              |
| `DELETE /api/account/tokens/:id`                               | revokes one                                                                                                          |
| `GET /api/account/profile`                                     | their profile: `{ profile }`                                                                                         |
| `GET /api/account/people?ids=a,b`                              | names (up to 100): `{ people: [{ id, name, picture }] }`, found ids only; a guest may ask too, and gets no `picture` |
| `PATCH /api/account/profile` `{ name?, color?, showPicture? }` | sets their display name or colour (null clears) or the picture switch; answers `{ profile }`                         |
| `GET /api/account/settings`                                    | their `all` settings: `{ all, updatedAt }`                                                                           |
| `PATCH /api/account/settings` `{ all }`                        | patches `all`; answers `{ all, updatedAt }`                                                                          |
| `GET /api/account/settings/:app`                               | `all` and that app's own scope: `{ all, app, updatedAt }`                                                            |
| `PATCH /api/account/settings/:app` `{ app }`                   | patches the app's own scope; answers `{ all, app, updatedAt }`                                                       |

For an app's server, by its OAuth client credentials (`Authorization: Basic`, checked by the OAuth
provider's own introspection and remembered per isolate for five minutes):

| Route                                            | Does                                                                                                                             |
| ------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------- |
| `POST /api/account/internal/tokens/verify`       | `{ token }` → the account and its teams, or 404                                                                                  |
| `POST /api/account/internal/tokens`              | `{ accessToken, name, readOnly }` → a token, shown once                                                                          |
| `POST /api/account/internal/teams`               | `{ accessToken, name, organisation? }` → 201 the team made, the person its admin                                                 |
| `POST /api/account/internal/invitations`         | `{ userId }` → `{ invitations }`: those waiting for the account's verified address                                               |
| `POST /api/account/internal/teams/of`            | `{ userId }` → `{ teams }`: the claim a token minted now would carry                                                             |
| `GET /api/account/internal/teams/changes`        | `?cursor=` → the next page of the change feed (no app reads it now)                                                              |
| `POST /api/account/internal/tokens/revoke`       | `{ token }` → revokes it (a CLI signing out), or 404                                                                             |
| `POST /api/account/internal/tokens/live`         | `{ ids }` (up to 100) → which still work, so an app can end what hangs off a revoked one                                         |
| `POST /api/account/internal/settings/read`       | `{ owner, app }` → `{ all, app, updatedAt }`                                                                                     |
| `POST /api/account/internal/settings/write`      | `{ owner, app, patch: { all?, app? } }` → `{ all, app, updatedAt }`                                                              |
| `POST /api/account/internal/settings/notify`     | `{ owners, app, keys }` (up to 100 accounts, 8 `notify…` keys) → `{ settings }`                                                  |
| `POST /api/account/internal/teams/members`       | `{ teamId }` → `{ team, members }`, joined and invited, or 404                                                                   |
| `POST /api/account/internal/profiles/read`       | `{ ids }` (up to 100) → `{ profiles: Profile[] }`, the ids found                                                                 |
| `POST /api/account/internal/profiles/write`      | `{ owner, name?, color? }` → `{ profile }`; null clears a field                                                                  |
| `POST /api/account/internal/sightings`           | `{ userId }` → `{ first }`, for the client's own app                                                                             |
| `POST /api/account/internal/milestones/claim`    | `{ userId, milestone }` → `{ claimed }`, for the client's own app                                                                |
| `POST /api/account/internal/emails`              | `{ ids }` (up to 100 accounts) → `{ emails }`, verified addresses only                                                           |
| `POST /api/account/internal/activity`            | `{ userId, at? }` → `{ ok }`: they saved something they own (a guest's is ignored)                                               |
| `POST /api/account/internal/workbench/session`   | `{ session }` → the workbench session for the client's app, or 404 `{ reason }`                                                  |
| `POST /api/account/internal/workbench/rooms`     | `{ ownerId, sessionId, itemId }` → 204: a workspace session joined that item's room                                              |
| `POST /api/account/internal/allowance`           | `{ personId, kind, max, windowMs, count }` → `{ taken }`, per the client's app                                                   |
| `POST /api/account/internal/legacy-guests/claim` | `{ legacyId, signature, into }` → `{ merged }` ([above](#returning-guests-of-the-old-livediagramapp)); livediagram's client only |

The workbench routes (`/api/account/workbench/*`: tickets, sessions, pairing requests and pairings, for API tokens,
workbench sessions and the signed-in person) are in [workbench.md](../011-workbench/workbench.md).

`Profile` is `{ id, name, color, picture, createdAt, updatedAt }`: `name`, `color` and `picture` may be null
(`picture` is the published [profile picture](#profile-pictures): null with none or with the switch off), and the
two times are null for an account that has never set either. The person's own `GET` and `PATCH
/api/account/profile` add `googlePicture` (their own picture, whatever the switch says) and `showPicture`.

The app side of these is in `@liveworkspace/auth-client` (`src/account.ts`).
