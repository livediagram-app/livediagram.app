# Teams, API tokens, guests and settings

Teams and tokens belong to the liveworkspace account, not to an app, and so do a person's settings. A team made once is the same team in
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
`all` scope; [Settings](#settings)).

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

- **`all`**: shown by every app (a theme, say). Changing it in one app changes it everywhere.
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
  like an account id (`user_…`) or a guest id (`guest_<uuid>`). Any app may read or write any app's
  scope, and `all`.
- **liveworkspace.app** reads and patches the signed-in person's `all` scope with their session
  cookie: `GET` and `PATCH /api/account/settings`.

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

## Closing an account

An app's server asks (`POST /api/auth/delete-account`, with its client credentials and the person's
access token, `src/delete-account.ts`), and the account closes for every app at once:

1. It leaves every team: a team it ran alone is deleted, and one where it was the only admin passes to
   the longest-standing member.
2. Its settings rows are deleted.
3. A purge request for the index is written to `pending_purges` (`migrations/0004_pending_purges.sql`),
   naming the teams deleted in step 1.
4. The user is deleted, and with it its sessions, linked sign-ins, OAuth tokens and consents, and API
   tokens.
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
| `GET /api/account/settings`                             | their `all` settings: `{ all, updatedAt }`                                              |
| `PATCH /api/account/settings` `{ all }`                 | patches `all`; answers `{ all, updatedAt }`                                             |

For an app's server, by its OAuth client credentials (`Authorization: Basic`, checked by the OAuth
provider's own introspection and remembered per isolate for five minutes):

| Route                                       | Does                                                                                     |
| ------------------------------------------- | ---------------------------------------------------------------------------------------- |
| `POST /api/account/internal/tokens/verify`  | `{ token }` → the account and its teams, or 404                                          |
| `POST /api/account/internal/tokens`         | `{ accessToken, name, readOnly }` → a token, shown once                                  |
| `POST /api/account/internal/teams`          | `{ accessToken, name, organisation? }` → 201 the team made, the person its admin         |
| `GET /api/account/internal/teams/changes`   | `?cursor=` → the next page of the change feed                                            |
| `POST /api/account/internal/tokens/revoke`  | `{ token }` → revokes it (a CLI signing out), or 404                                     |
| `POST /api/account/internal/tokens/live`    | `{ ids }` (up to 100) → which still work, so an app can end what hangs off a revoked one |
| `POST /api/account/internal/settings/read`  | `{ owner, app }` → `{ all, app, updatedAt }`                                             |
| `POST /api/account/internal/settings/write` | `{ owner, app, patch: { all?, app? } }` → `{ all, app, updatedAt }`                      |

The app side of these is in `@liveworkspace/auth-client` (`src/account.ts`).
