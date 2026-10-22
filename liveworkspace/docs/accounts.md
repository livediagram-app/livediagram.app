# Teams and API tokens

Both belong to the liveworkspace account, not to an app. A team made once is the same team in
livediagram, liveplanner and every app after them; one API token, or one AI tool connected over
MCP, works on every app. They are run on liveworkspace.app ([Your account](site.md#your-account-account))
and kept by the accounts Worker (`apps/accounts`), in its own D1 beside the accounts
(`migrations/0002_teams_and_tokens.sql`). An app keeps no team or token of its own.

## Teams

A team has a name, admins and members. Anyone signed in can make one (up to 50 per account) and
becomes its admin. Admins rename it, invite people by email, change roles, remove people and
delete it; anyone can leave. A team always keeps an admin: the last one can't step down or leave
while others remain, and the last member leaving deletes the team. Closing an account leaves
every team first: a team it ran alone goes, and one where it was the only admin passes to the
longest-standing member.

An invitation is a member row with the invited address, `invited` until answered. Accepting it
takes a signed-in account whose **verified** address is the one invited (signing in by code, or
with Google, verifies it). The invitation email links to `/account/teams`, where it waits.

Rows are never deleted. Leaving or being removed makes a row `removed`; deleting a team stamps
`deletedAt`. Every write takes the next number from one counter (`team_seq`) in the same batch, so
the apps can follow everything that changed after the last number they saw.

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

## The API

On liveworkspace.app, routed to the accounts Worker (`/api/account/*`).

For the signed-in person, by their session cookie. Writes must come from the site's own origin.

| Route                                                   | Does                                          |
| ------------------------------------------------------- | --------------------------------------------- |
| `GET /api/account/teams`                                | their teams and the invitations waiting       |
| `POST /api/account/teams` `{ name }`                    | makes a team, with them as admin              |
| `PATCH` / `DELETE /api/account/teams/:id`               | renames / deletes it (admins)                 |
| `GET /api/account/teams/:id/members`                    | the team, their role, members and invitations |
| `POST /api/account/teams/:id/members` `{ email, role }` | invites an address and emails it (admins)     |
| `PATCH /api/account/teams/:id/members/:member`          | changes a role (admins)                       |
| `DELETE /api/account/teams/:id/members/:member`         | removes someone (admins), or leaves (oneself) |
| `POST /api/account/invitations/:member/accept`          | joins (the invited, verified address only)    |
| `POST /api/account/invitations/:member/decline`         | declines                                      |
| `GET` / `POST /api/account/tokens`                      | lists / makes a token (the secret once)       |
| `DELETE /api/account/tokens/:id`                        | revokes one                                   |

For an app's server, by its OAuth client credentials (`Authorization: Basic`, checked by the OAuth
provider's own introspection and remembered per isolate for five minutes):

| Route                                      | Does                                                                                     |
| ------------------------------------------ | ---------------------------------------------------------------------------------------- |
| `POST /api/account/internal/tokens/verify` | `{ token }` → the account and its teams, or 404                                          |
| `POST /api/account/internal/tokens`        | `{ accessToken, name, readOnly }` → a token, shown once                                  |
| `GET /api/account/internal/teams/changes`  | `?cursor=` → the next page of the change feed                                            |
| `POST /api/account/internal/tokens/revoke` | `{ token }` → revokes it (a CLI signing out), or 404                                     |
| `POST /api/account/internal/tokens/live`   | `{ ids }` (up to 100) → which still work, so an app can end what hangs off a revoked one |

The app side of these is in `@liveworkspace/auth-client` (`src/account.ts`).
