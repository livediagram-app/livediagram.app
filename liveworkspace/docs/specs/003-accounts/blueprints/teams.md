# Teams: blueprint

Derived from [accounts.md "Teams"](../accounts.md#teams), ["Invitations"](../accounts.md#invitations), ["Reminders
and expiry"](../accounts.md#reminders-and-expiry), ["The join link"](../accounts.md#the-join-link), ["How an app keeps
up"](../accounts.md#how-an-app-keeps-up) and ["On the Timeline"](../accounts.md#on-the-timeline). The spec decides;
this file only adds engineering precision, read from the code. Defaults are cited as `ACCn`. Paths are relative to the
repository root.

Scope, by file:

| File                                                      | Role                                                                                                                                                    |
| --------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `liveworkspace/apps/accounts/src/teams.ts`                | Every team rule: create, update, delete, members, invitations, decline tokens, the join link, the sweep, the change feed, `teamsClaim`, `leaveAllTeams` |
| `liveworkspace/apps/accounts/src/account-api.ts`          | `teamRoutes` (session and bearer), `handleOpen` (join preview, email decline), the internal team routes, `/index/teams`                                 |
| `liveworkspace/apps/accounts/src/internal-invitations.ts` | `POST /api/account/internal/invitations`                                                                                                                |
| `liveworkspace/apps/accounts/src/notify.ts`               | `teamPeople` for `POST /api/account/internal/teams/members`                                                                                             |
| `liveworkspace/apps/accounts/src/index-timeline.ts`       | `timelineStatement`, `teamScopes`, the outbox to the index                                                                                              |
| `packages/auth-client/src/account.ts`, `invitations.ts`   | Each app's side: the change feed, `teams/of`, invitations (cached 30 s, 500 accounts)                                                                   |

## Domain and naming

| Term          | Identifier                                                                        | Meaning                                                     |
| ------------- | --------------------------------------------------------------------------------- | ----------------------------------------------------------- |
| Team          | `team` row, id a UUID                                                             | Name ≤ 80, organisation ≤ 80 or null; `deletedAt` once gone |
| Member row    | `team_member`, id a UUID                                                          | Doubles as the invitation; never deleted                    |
| Status        | `invited` → `joined` / `declined` (expired: `declined` + `expiredAt`) / `removed` | One row's life                                              |
| Role          | `admin`, `member`                                                                 |                                                             |
| Rev           | `team_seq.value`, bumped before every write                                       | The change feed's order                                     |
| Decline token | `<member id>.<32 random bytes base64url>`                                         | Only the secret's SHA-256 kept, up to 4 per row             |
| Join link     | `<BASE_URL>/join?token=<HMAC(team-join-link:<team>:<nonce>)>`                     | One per team, a week                                        |
| Claim         | `TeamClaim { id, name, role }`                                                    | Every joined team, in each access token                     |

## Behaviour and state

### A member row

| From              | Event                             | To            | Effect                                                                                                         |
| ----------------- | --------------------------------- | ------------- | -------------------------------------------------------------------------------------------------------------- |
| (none)            | `createTeam`                      | joined admin  | the maker; email the verified address or `<id>@account.invalid`                                                |
| (none)            | `inviteMember`                    | invited       | `clockStartedAt = now`, a decline token; a declined row for that address goes to `removed`; `team_invite_sent` |
| invited           | accept (verified address matches) | joined        | `userId` set; `team_joined`; already in under another address: this row `removed`                              |
| invited           | decline (site or email token)     | declined      | `team_declined`; admins told                                                                                   |
| invited           | 28 days unanswered (sweep)        | declined      | `expiredAt = now`                                                                                              |
| invited           | the join link, same address       | joined        | accepted in place                                                                                              |
| (none)            | the join link, a new address      | joined member | inserted                                                                                                       |
| joined            | `setMemberRole`                   | joined        | `team_role_changed`                                                                                            |
| joined            | `removeMember` (self or an admin) | removed       | `team_member_removed`; the last member leaving deletes the team                                                |
| invited, declined | `removeMember` by an admin        | removed       | withdrawn or cleared; no event                                                                                 |
| any open          | the team deleted                  | removed       | `team_deleted` to each joined member                                                                           |

Every write is `BUMP` (`UPDATE team_seq SET value = value + 1`) then the row with `rev = (SELECT value FROM team_seq)`,
in one batch, so the feed sees every change. A role change or removal carries `KEEPS_AN_ADMIN`, so two admins
demoting or removing each other at once can't leave none (`409 last_admin` when its update changed nothing).

### The routes (session on liveworkspace.app, or an account's bearer on an app's address)

| Route                                                   | Who                       | Effect                                                                                                                                                                              |
| ------------------------------------------------------- | ------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `GET /api/account/teams`                                | anyone                    | `{ teams: MyTeam[], invitations }`: one statement, each team with counts and its first 4 members (admins, then longest standing)                                                    |
| `POST /api/account/teams { name, organisation? }`       | anyone                    | `400 name_required`; `409 team_limit_reached` at 50; `201 MyTeam`                                                                                                                   |
| `PATCH /api/account/teams/:id { name?, organisation? }` | admin                     | `404`, `403 admin_only`, `400 name_required`; a rename writes `team_renamed { from }`                                                                                               |
| `DELETE /api/account/teams/:id`                         | admin                     | the team and open rows go                                                                                                                                                           |
| `POST /api/account/teams/:id/invite-link`               | admin                     | a new nonce: the old link ends; works 7 days; `{ url, expiresAt }`                                                                                                                  |
| `DELETE /api/account/teams/:id/invite-link`             | admin                     | the link off                                                                                                                                                                        |
| `GET /api/account/teams/:id/members`                    | a member                  | `{ team: { id, name, organisation, myRole, myMemberId }, members, inviteLink }` (the link only for admins); joined, then open, then declined, admins first                          |
| `POST /api/account/teams/:id/members { email, role }`   | admin                     | `400 email_invalid`; `409 already_invited` (an open row for the address, also by the unique index); `409 member_limit_reached` at 200 open; the invitation email sent; `201 Member` |
| `PATCH /api/account/teams/:id/members/:member { role }` | admin                     | `400 role_invalid`; `409 last_admin`                                                                                                                                                |
| `DELETE /api/account/teams/:id/members/:member`         | admin, or self            | `409 last_admin` for a sole admin leaving while others remain                                                                                                                       |
| `POST /api/account/invitations/:member/accept\|decline` | the invited address       | `403 email_unverified`; `404`; `409 team_limit_reached`; admins emailed                                                                                                             |
| `GET /api/account/join/:token`                          | open, `TEAM_LINK_LIMITER` | `{ …JoinPreview, signedIn }` or `404 invite_not_found`                                                                                                                              |
| `POST /api/account/join/:token`                         | session only              | limited; joins as member, or `{ alreadyMember: true }`                                                                                                                              |
| `GET`/`POST /api/account/invitations/decline/:token`    | open, limited             | read what became of it, or decline (`409 already_joined`; twice changes nothing; expired stays expired)                                                                             |

The limiter is keyed `team-link:<range>` (an IPv4 /24 or IPv6 /48).

### The apps' doors (client credentials)

| Route                                               | Body                                   | Answer                                                                                                |
| --------------------------------------------------- | -------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| `POST /api/account/internal/teams`                  | `{ accessToken, name, organisation? }` | a team for the person the token names (introspected, this client's): `201`                            |
| `POST /api/account/internal/teams/of`               | `{ userId }`                           | `{ teams: TeamClaim[] }`                                                                              |
| `POST /api/account/internal/teams/members`          | `{ teamId (1 to 100 chars) }`          | `{ team, members: TeamPerson[] }`: joined and invited, names from the profile then the account; `404` |
| `POST /api/account/internal/invitations`            | `{ userId }`                           | `{ invitations }` for the account's verified address (none without one)                               |
| `GET /api/account/internal/teams/changes?cursor=`   |                                        | `{ teams, members, cursor, more }`                                                                    |
| `POST /api/account/index/teams` (`INDEX_MERGE_KEY`) | `{ userId }`                           | `{ teams }`; `400 invalid_user`, `401`                                                                |

The change feed: two keyset reads in one batch, `rev > ? OR (rev = ? AND id > ?) ORDER BY rev, id LIMIT 500` on
`team_rev_idx` and `team_member_rev_idx`; the cursor is `"<rev>:<id>,<rev>:<id>"` (one position per table, start
`0:`); `more` when either page is full.

### The daily invitation sweep (`sweepInvitations`)

1. One batch: up to 500 open invitations whose clock started 28 days ago become `declined` with `expiredAt`.
2. Reminders, latest stage first (21, 7, then 1 day after the clock started, each up to the next stage's age), up to
   100 per stage, for invitations whose stage column is empty, whose team lives, with fewer than 3 failed sends.
   Each gets a fresh decline token; sent, the stage is stamped, earlier skipped stages stamped `0`, attempts reset,
   the new hash kept (last 4); failed, `reminderAttempts + 1`.
3. Logged `[teams] invitation sweep { expired, reminded, failed }`.

### On the Timeline

Each event is queued into `index_timeline_outbox` in the batch of its change (`INSERT OR IGNORE`, guarded by
`memberGuard` where the change might not land), then sent after the response and by the frequent cron. Ids:
`team_invite_sent:<member>`, `team_joined:<member>`, `team_declined:<member>`, `team_role_changed:<member>:<now>`,
`team_member_removed:<member>`, `team_renamed:<team>:<now>`, `team_deleted:<team>`. Scopes `t:<team>` and the
person's `p:<id>`; a deleted team's go to each former member's `p:`. Detail always carries `teamId`.

### Closing an account (`leaveAllTeams`)

For each joined row: a team where it is the only joined member closes (`deletedAt`, link cleared, open rows
`removed`); a sole admin's role passes to the longest-standing joined member; the row `removed`. Then every row with
its id, and declined or removed rows with its address, take the email `Deleted account`. Open invitations to its
address stay. Answers the teams that closed.

## Data and persistence

| Table         | Key            | Indexes                                                                                                                                                                                                                                                                 | Written by         | Read by                |
| ------------- | -------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------ | ---------------------- |
| `team`        | `id`           | `team_rev_idx (rev, id)`; `team_invite_link_uq` UNIQUE `(inviteLinkHash) WHERE inviteLinkHash IS NOT NULL`                                                                                                                                                              | team routes, sweep | lists, feed, join link |
| `team_member` | `id`           | `team_member_team_idx`; `team_member_clock_idx (clockStartedAt) WHERE status = 'invited'`; `team_member_user_idx`; `team_member_email_idx`; `team_member_rev_idx (rev, id)`; `team_member_open_email_uq` UNIQUE `(teamId, email) WHERE status IN ('invited', 'joined')` | every team write   | every read             |
| `team_seq`    | `id` (CHECK 1) |                                                                                                                                                                                                                                                                         | every team write   | every team write       |

`team_member.userId` references `user (id) ON DELETE SET NULL`; `role` and `status` CHECKed; `declineTokenHashes`
space-separated (default `''`); `reminder1SentAt`..`reminder3SentAt`, `reminderAttempts` (default 0), `expiredAt`.
`team_seq` is seeded `(1, 0)`.

## Errors and edge cases

| Case                                    | Answer                                              |
| --------------------------------------- | --------------------------------------------------- |
| Two invitations to one address at once  | the unique index lets one in: `409 already_invited` |
| Two admins removing each other          | one wins, the other `409 last_admin`                |
| A join by one person twice at once      | the unique index admits one; they are in            |
| A decline link opened by a mail scanner | `GET` reads only; declining needs the `POST`        |
| An invitation email that fails          | logged; the invitation stands                       |

## Security and trust

- Only an account whose verified address is the invited one may answer an invitation.
- A decline token declines one invitation and reads its state, nothing else; only its hash is kept.
- The join link's token is an HMAC under `BETTER_AUTH_SECRET`; the table keeps only its hash, so the link can be
  shown again but not rebuilt from the database.
- The open doors are limited per network range.

## Testing

| Test                                                               | Pins                                                                                                                                                                                  |
| ------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `liveworkspace/apps/accounts/src/teams.test.ts` (15)               | teams; `teamChanges`                                                                                                                                                                  |
| `liveworkspace/apps/accounts/src/team-invites.test.ts` (26)        | the join link; the organisation line; declining from the email; invitations turned down; reminders and expiry; telling the admins; the routes; counting team emails, teams and tokens |
| `liveworkspace/apps/accounts/src/internal-invitations.test.ts` (4) | `POST /api/account/internal/invitations`                                                                                                                                              |
| `liveworkspace/apps/accounts/src/notify.test.ts` (4)               | `readNotifySettings`; `teamPeople`                                                                                                                                                    |
| `liveworkspace/apps/accounts/src/index-timeline.test.ts` (16)      | team events and their outbox                                                                                                                                                          |
| `packages/auth-client/src/invitations.test.ts`                     | the app's cached invitations read                                                                                                                                                     |

## Constants and configuration

`TEAM_NAME_MAX_LENGTH` 80, `ORGANISATION_MAX_LENGTH` 80, `MAX_TEAMS_PER_ACCOUNT` 50, `MAX_MEMBERS_PER_TEAM` 200,
`INVITE_LINK_TTL_MS` 7 d, `REMINDER_AGES_MS` 1, 7, 21 d, `INVITATION_TTL_MS` 28 d, `EXPIRE_BATCH` 500,
`REMINDER_BATCH` 100, `MAX_REMINDER_ATTEMPTS` 3, `MAX_DECLINE_HASHES` 4, `LIST_PREVIEW_MEMBERS` 4,
`CHANGES_PAGE_SIZE` 500, `DELETED_MEMBER_EMAIL` `'Deleted account'` (`teams.ts`); `TIMELINE_BATCH` 100,
`TIMELINE_SCOPES_MAX` 250, `TIMELINE_CALLS_PER_RUN` 10, `TIMELINE_MAX_ATTEMPTS` 96, `TIMELINE_OUTBOX_MAX` 5,000,
`TIMELINE_TIMEOUT_MS` 5 s (`index-timeline.ts`); `INVITATIONS_TTL_MS` 30 s, `INVITATIONS_CACHE_MAX` 500
(`packages/auth-client/src/invitations.ts`). `TEAM_LINK_LIMITER` `1004` (`2004`), 20 per 60 s.

## Defaults ledger

- `ACC8`: the 50-team cap bounds the access token's `teams` claim.
- `ACC9`: a reminder that fails three sends in a row leaves the queue; the invitation still expires at 28 days.
- `ACC10`: a Timeline event the index refuses 96 times is dropped, and the outbox keeps at most 5,000 events.
