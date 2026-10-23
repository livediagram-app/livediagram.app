# Teams, API tokens, guests, settings and profiles

Teams and tokens belong to the liveworkspace account, not to an app, and so do a person's settings and
profile. A team made once is the same team in
livediagram, liveplanner and every app after them; one API token, or one AI tool connected over
MCP, works on every app. They are run on liveworkspace.app ([Your account](site.md#your-account-account))
and kept by the accounts Worker (`apps/accounts`), in its own D1 beside the accounts
(`migrations/0002_teams_and_tokens.sql`). An app keeps no team or token of its own.

## Teams

A team has a name, an optional organisation line (a company or department, up to 80 characters),
admins and members. Anyone signed in can make one (up to 50 per account) and becomes its admin, on
liveworkspace.app or from inside an app (`POST /api/account/internal/teams`, the app vouching for them
with their access token, as it does for a token; `createTeamFor` in `@liveworkspace/auth-client`).
Admins rename it, change its organisation, invite people by email, turn its join link on and off,
change roles (making someone else admin is how a team changes hands), remove people, clear
answered invitations and delete it; anyone can leave. A team always keeps an admin: the last one
can't step down or leave while others remain, and the last member leaving deletes the team.
Closing an account leaves every team first: a team it ran alone goes, and one where it was the only
admin passes to the longest-standing member.

| Who may                                                        | Admin                                      | Member |
| -------------------------------------------------------------- | ------------------------------------------ | ------ |
| See the team, its members and invitations                      | ✓                                          | ✓      |
| Invite by email, turn the join link on / off                   | ✓                                          |        |
| Change a role, remove someone, withdraw or clear an invitation | ✓                                          |        |
| Rename it, change its organisation, delete it                  | ✓                                          |        |
| Leave                                                          | ✓ (not the last admin while others remain) | ✓      |

### Invitations

An invitation is a member row with the invited address, `invited` until answered. Accepting it
takes a signed-in account whose **verified** address is the one invited (signing in by code, or
with Google, verifies it). The invitation email links to `/account/teams`, where it waits with the
team's name, organisation and member count. Accepting or declining tells the team's admins by
email, unless an admin has turned that off (the `notifyInviteResponse` setting, `false`, in the
`all` scope; [Settings](#settings)). That email links to the account's settings on liveworkspace.app,
where it is turned off, and sends it as `List-Unsubscribe`.

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
  same link. Someone already in the team is taken straight to it.
- **Joining**, `POST /join/:token`, signed in: adds them as a joined member. Already in: nothing
  changes. An invitation waiting for their address is accepted in place rather than doubled. An
  off, expired or unknown token is `404 invite_not_found`.

The two doors that need no session, the join preview and the Decline link, are limited per network
(`TEAM_LINK_LIMITER`, 20 a minute per IPv4 /24 or IPv6 /48).

Rows are never deleted. Leaving or being removed makes a row `removed`; deleting a team stamps
`deletedAt`. Every write takes the next number from one counter (`team_seq`) in the same batch, so
the apps can follow everything that changed after the last number they saw. The feed carries each
team's organisation too.

### How an app keeps up

An app's own tables still say which documents belong to which team, and its permission checks
still join on its own copy of each team and its joined members. liveworkspace is the source of
that copy, which reaches the app two ways:

- **The change feed.** `GET /api/account/internal/teams/changes?cursor=…` answers every team and
  member written after the cursor, oldest first, 500 a page, with the next cursor. The app applies
  them and keeps the cursor. It reads the feed on a five-minute cron, so a removal reaches every app
  within five minutes even if the person never opens it again.
- **The token's claim.** Every access token liveworkspace mints carries the account's teams
  (`teams: [{ id, name, role }]`, up to 50). When the app sees a claim that differs from its copy for
  that account, it reads the feed then and there, so a team made or joined a moment ago is there on
  the next request. The claim is only ever a nudge: tokens live an hour, so the app's copy, not
  the claim, decides access. An app remembers per isolate which claims it has already caught up
  with, so a steady state costs nothing per request.

## API tokens

A token (`lwt_…`, 32 random bytes) acts as its account on every app's API and MCP server, read
and write or read only, for six months. Only its SHA-256 hash is kept; the secret is shown once.
An account holds up to 20. They are made and revoked on `/account/tokens`.

Connecting an AI tool in an app (its MCP OAuth flow) makes one too: the app's consent page sends
the person's access token to liveworkspace (`POST /api/account/internal/tokens`), which makes the
token for whoever that access token belongs to and only for an access token minted for that app.
So the connection shows on `/account/tokens` and works on every app.

An app checks a presented token with `POST /api/account/internal/tokens/verify`, which answers
the account, its verified email, read-only and the account's teams. `createTokenChecker` in
`@liveworkspace/auth-client` remembers each answer per isolate for a minute (an unknown token for
ten seconds), so a burst of MCP calls costs one check; it is also how long a revoked token can go on
working in an isolate that had just checked it.

### Expiry warnings

A week before a token expires, its owner is emailed once about it, so a script or connected AI tool
doesn't stop without warning (`src/token-expiry.ts`, the email in `src/email.ts`). It is an account
message, so it can't be turned off.

- **The email**, "Your liveworkspace API token expires soon", names the token and the day it
  expires, says what stops working when it lapses, and gives the three steps: make a fresh token,
  update whatever uses the old one, revoke the old one. Its button, "Manage your tokens", goes to
  `<BASE_URL>/account/tokens`. Tokens last six months, and this is the only reminder sent for each.
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

## Guests

Someone using an app without an account is a guest, and the guest is the same person in every app
([one-explorer-contracts.md](one-explorer-contracts.md#guests)). The first time an app needs an
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

It is limited to 60 a minute per IP (`GUEST_LIMITER`).

**Signing in keeps a guest's things.** When a session is made for a request carrying a valid
`lw_guest` cookie (Better Auth's `session.create.after` hook), the Worker sends
`POST ${INDEX_URL}/internal/merge` `{ guestId, userId }` with `Bearer ${INDEX_MERGE_KEY}`, in the
background with a 5 second timeout, and clears the cookie, so the next guest visit starts a fresh
guest. A failed merge never fails the sign-in. Without `INDEX_URL` and `INDEX_MERGE_KEY` it does
nothing and the cookie stays.

## Settings

A person's settings live with the account, in the accounts Worker's D1
(`migrations/0003_settings.sql`, `src/settings.ts`), not in any app. A guest has settings too, under
their guest id. An app keeps no settings table of its own.

### Scopes

Each setting is stored in one scope:

- **`all`**: shown by every app that has the setting. Changing it in one app changes it everywhere.
  Which keys are shared is one list, `ALL_SETTING_KEYS` in `@liveworkspace/settings`
  (`packages/settings`): privacy and accessibility, notifications, the editors' chrome and your own
  colours. Its `splitSettings` and `joinSettings` turn an editor's flat preferences into the two
  scopes and back.
- **an app's site id** (`livediagram.app`, `liveplanner.app`, `livedocuments.app`, `livedesign.app`,
  as `APP_SITES` in `@liveworkspace/sites` spells them): shown by that app only.

An app reads its own scope and `all`, and shows only the settings that mean something to it. It
decides which scope a setting belongs in. liveworkspace.app shows and changes `all`.

A scope is one row, keyed by owner and scope, holding a JSON object of setting names to values.

### Writing is per key

A write is a patch per scope: each key it names takes the new value, whole (an object value
replaces the stored one rather than merging into it), and a key set to `null` is deleted. Keys it
doesn't name stay as they are. The merge runs inside SQLite (`json_remove` then `json_patch`, one
upsert per scope), against the row as it stands, so two apps writing different keys at once both
land. A write covering both scopes is one batch, so it applies whole or not at all, and it answers
the settings as they now are.

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
- **liveworkspace.app** reads and patches the signed-in person's `all` scope with their session
  cookie: `GET` and `PATCH /api/account/settings`, from its settings page
  ([Your account](site.md#your-account-account)), where the profile is set too.

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
- A name is trimmed, 1 to 120 characters, with no control characters; a colour at most 64, and refused
  when it could load something or break out of a CSS value (the apps' `isSafeColourValue`), since it is
  painted into every peer's page. Either may be null: no name of its own, or the app's own pick of colour.
- The colours offered are one palette, `PRESENCE_COLOURS` in `@liveworkspace/settings`
  (`packages/settings`): ten named colours, each with the deeper shade dark mode paints it in under
  white text. Every app and liveworkspace.app's Settings offer the same swatches from it.

An app reads up to 100 ids at once (a presence list, a page of comments): one query, each id found by
primary key in the profiles and the accounts, so an account that never set anything still answers with
its name. Ids that are neither are left out. Setting one's own name or colour is one upsert of the
fields named. An account id with no account behind it is refused (`404 unknown_owner`), so a closed
account can't be written back.

Closing an account deletes its profile. When a guest signs in, the account keeps its own colour and
display name and takes the guest's colour when it has none (and the guest's name only when the account
has no name at all); then the guest's profile goes. Both run beside the settings, in the same hook.

### Guests who never come back

Every guest hand-off stamps when that guest id was last seen (`guest_seen`, at most one write a day
per guest), and so does an app reading the guest's settings or writing its profile, so a guest an app
already knows is kept alive however it came by the id. A guest still using an app gets a fresh token before its year is up, so it is never
more than a year unseen. Once a guest id has gone 400 days unseen its token has lapsed and browsers have
dropped its cookie (Chrome keeps one at most 400 days), so no app can be handed it again, and the
daily cron (`17 9 * * *`, `src/guest-sweep.ts`) deletes its settings and profile: up to 500 guests a
run, the longest unseen first, checked again in the deletes so a guest seen meanwhile keeps everything.
Its items stay in the index, as every guest's do, until someone deletes them
([one-explorer-contracts.md](one-explorer-contracts.md#guests)). Signing in removes the guest's stamp
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

## Onboarding emails

A short series that introduces liveworkspace, one per account rather than one per app, so someone who
uses all four apps hears it once (`migrations/0008_email_lifecycle.sql`, `src/lifecycle.ts`, the
emails in `src/lifecycle-email.ts`). It is sent by this Worker, through Resend like every other email
it sends, with the same timings and tips each app's own series had:

| Stage      | When                                                                           | Can be turned off |
| ---------- | ------------------------------------------------------------------------------ | ----------------- |
| Welcome    | when the account is made, after the sign-up's response has gone                | no                |
| Activation | ~3 days in, to someone who hasn't made anything in any app, before week 1 goes | yes               |
| Week 1     | ~7 days in: the Explorer, across every app                                     | yes               |
| Week 2     | ~14 days in: teams, made on liveworkspace.app                                  | yes               |
| Win-back   | once, ~4 weeks after their last save in any app                                | yes               |

- **The row** is made with the account (Better Auth's `user.create.after` hook), and goes with it. The
  client registrar and accounts imported from Clerk (written as SQL) have none, so they are never sent
  the series.
- **Turning tips off** is the `notifyTips` setting, `false`, in the `all` scope
  ([Settings](#settings)), so it holds in every app. A stage someone has turned off is stamped and
  not sent. Each email that can be turned off links (and sends `List-Unsubscribe`) to the account's
  settings on liveworkspace.app (`<BASE_URL>/account/settings`), where someone signed out signs in
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
  ([telemetry.md](telemetry.md)), under the app the email speaks for (its links' app) with that app's
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
   the longest-standing member.
2. Its settings rows and its profile are deleted.
3. A purge request for the index is written to `pending_purges` (`migrations/0004_pending_purges.sql`),
   naming the teams deleted in step 1.
4. The user is deleted, and with it its sessions, linked sign-ins, OAuth tokens and consents, API
   tokens, its onboarding series and what each app recorded of it (sign-ups and milestones).
5. The request is sent to the index (`POST ${INDEX_URL}/internal/purge-person` `{ personId, teamIds }`,
   `Bearer ${INDEX_MERGE_KEY}`, the same key and binding as the guest merge; `src/index-purge.ts`), which
   purges every item the person owns, with its content in each app, and everything else it holds for
   them ([one-explorer-contracts.md](one-explorer-contracts.md#closing-an-account)). Once the index
   takes it, the row is cleared.

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

For the signed-in person, by their session cookie. Writes must come from the site's own origin.

| Route                                                   | Does                                                                                    |
| ------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| `GET /api/account/teams`                                | their teams (counts and first four members each, one query) and the invitations waiting |
| `POST /api/account/teams` `{ name, organisation? }`     | makes a team, with them as admin                                                        |
| `PATCH` / `DELETE /api/account/teams/:id`               | `{ name?, organisation? }` / deletes (admins)                                           |
| `GET /api/account/teams/:id/members`                    | the team, their role, members and invitations, and `inviteLink` (admins)                |
| `POST` / `DELETE /api/account/teams/:id/invite-link`    | makes the join link anew / turns it off (admins)                                        |
| `GET /api/account/join/:token`                          | no session needed: the team a join link names                                           |
| `POST /api/account/join/:token`                         | joins through the link, as a member                                                     |
| `GET` / `POST /api/account/invitations/decline/:token`  | no session needed: reads / declines the invitation an email's Decline link names        |
| `POST /api/account/teams/:id/members` `{ email, role }` | invites an address and emails it (admins)                                               |
| `PATCH /api/account/teams/:id/members/:member`          | changes a role (admins)                                                                 |
| `DELETE /api/account/teams/:id/members/:member`         | removes someone (admins), or leaves (oneself)                                           |
| `POST /api/account/invitations/:member/accept`          | joins (the invited, verified address only)                                              |
| `POST /api/account/invitations/:member/decline`         | declines                                                                                |
| `GET` / `POST /api/account/tokens`                      | lists / makes a token (the secret once)                                                 |
| `DELETE /api/account/tokens/:id`                        | revokes one                                                                             |
| `GET /api/account/profile`                              | their profile: `{ profile }`                                                            |
| `PATCH /api/account/profile` `{ name?, color? }`        | sets their display name or colour (null clears); answers `{ profile }`                  |
| `GET /api/account/settings`                             | their `all` settings: `{ all, updatedAt }`                                              |
| `PATCH /api/account/settings` `{ all }`                 | patches `all`; answers `{ all, updatedAt }`                                             |

For an app's server, by its OAuth client credentials (`Authorization: Basic`, checked by the OAuth
provider's own introspection and remembered per isolate for five minutes):

| Route                                         | Does                                                                                     |
| --------------------------------------------- | ---------------------------------------------------------------------------------------- |
| `POST /api/account/internal/tokens/verify`    | `{ token }` → the account and its teams, or 404                                          |
| `POST /api/account/internal/tokens`           | `{ accessToken, name, readOnly }` → a token, shown once                                  |
| `POST /api/account/internal/teams`            | `{ accessToken, name, organisation? }` → 201 the team made, the person its admin         |
| `GET /api/account/internal/teams/changes`     | `?cursor=` → the next page of the change feed                                            |
| `POST /api/account/internal/tokens/revoke`    | `{ token }` → revokes it (a CLI signing out), or 404                                     |
| `POST /api/account/internal/tokens/live`      | `{ ids }` (up to 100) → which still work, so an app can end what hangs off a revoked one |
| `POST /api/account/internal/settings/read`    | `{ owner, app }` → `{ all, app, updatedAt }`                                             |
| `POST /api/account/internal/settings/write`   | `{ owner, app, patch: { all?, app? } }` → `{ all, app, updatedAt }`                      |
| `POST /api/account/internal/profiles/read`    | `{ ids }` (up to 100) → `{ profiles: Profile[] }`, the ids found                         |
| `POST /api/account/internal/profiles/write`   | `{ owner, name?, color? }` → `{ profile }`; null clears a field                          |
| `POST /api/account/internal/sightings`        | `{ userId }` → `{ first }`, for the client's own app                                     |
| `POST /api/account/internal/milestones/claim` | `{ userId, milestone }` → `{ claimed }`, for the client's own app                        |
| `POST /api/account/internal/emails`           | `{ ids }` (up to 100 accounts) → `{ emails }`, verified addresses only                   |
| `POST /api/account/internal/activity`         | `{ userId, at? }` → `{ ok }`: they saved something they own (a guest's is ignored)       |

`Profile` is `{ id, name, color, createdAt, updatedAt }`: `name` and `color` may be null, and the two
times are null for an account that has never set either.

The app side of these is in `@liveworkspace/auth-client` (`src/account.ts`).
