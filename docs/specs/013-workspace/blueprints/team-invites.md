# Team invites blueprint

Derived from [Teams](../teams.md) ("Invites, connect-on-sign-in, and accept/decline", "Declining from the email", "Reminders and expiry") and [Transactional & lifecycle email (Resend)](../../014-identity/transactional-email.md) (#4, #13). Implementation detail only; design lives in the specs.

## Domain and naming

| Term           | Identifier                                                             | Where                                               |
| -------------- | ---------------------------------------------------------------------- | --------------------------------------------------- |
| Invite state   | `TeamMemberStatus` `'invited' \| 'joined' \| 'declined' \| 'expired'`  | `packages/api-schema/src/index.ts`                  |
| Open row       | `isOpenTeamMember(m)` (client + routes), `openMemberSql()` (SQL)       | api-schema; `apps/api/src/db/teams.ts`              |
| Rejected       | `declined` or `expired`; UI pill "Rejected"; removal kind `'rejected'` | `team-pane-parts.tsx`, `team-removal.ts`            |
| Decline token  | `<member id>.<secret>`; `mintDeclineToken`, `resolveDeclineToken`      | `apps/api/src/db/team-invite-decline.ts`            |
| Decline        | `declineTeamInvite(env, memberId)`                                     | same                                                |
| Decline answer | `TeamInviteDecline` `{ teamName, status }`                             | api-schema                                          |
| Reminder stage | `InviteReminderStage` `1 \| 2 \| 3`; kinds `TeamInviteReminder1..3`    | `db/team-invite-reminders.ts`, `templates.ts`       |
| Sweep          | `runTeamInviteSweep(env, now)`                                         | `apps/api/src/email/team-invite-reminders.ts`       |
| Landing        | `/join/decline?token=`, `TeamInviteDecline` component, `useUrlToken`   | `apps/live/app/join/decline/`, `components/panels/` |

No synonyms: "rejected" is the UI word for both closed states; code always names the state (`declined`, `expired`). Never "revoked" or "cancelled" for these.

## Data and persistence

Migration `0095_team_invite_decline_and_reminders.sql` on `team_members`:

| Column                 | Type                       | Meaning                                                              |
| ---------------------- | -------------------------- | -------------------------------------------------------------------- |
| `decline_token_hashes` | TEXT NULL                  | SHA-256 hex of each email's secret, space-separated, at most 4       |
| `reminder1_sent_at`    | INTEGER NULL               | ms stamp; `0` = skipped (a later stage stood in, or a legacy invite) |
| `reminder2_sent_at`    | INTEGER NULL               | same                                                                 |
| `reminder3_sent_at`    | INTEGER NULL               | same                                                                 |
| `reminder_attempts`    | INTEGER NOT NULL DEFAULT 0 | failed reminder sends in a row; reset on success                     |

- Index `team_members_pending_idx ON team_members (created_at) WHERE status = 'invited'`.
- Backfill: every row `status = 'invited'` at migration time gets all three stamps `0`.
- `status` stays TEXT with no CHECK; `memberStatus` maps unknown / NULL to `'joined'` (the 0021 rule).
- Hashes are never cleared while the row lives; deleting the row (Admin remove, re-invite replacement, team delete) is the only revocation.
- Account deletion: `detachUserFromTeams` deletes every row keyed to the user, rejected ones included.

## Interfaces and contracts

| Route                                            | Auth          | Answers                                                                                        |
| ------------------------------------------------ | ------------- | ---------------------------------------------------------------------------------------------- |
| `GET /api/teams/invite-decline/:token`           | none          | 200 `TeamInviteDecline`; 404 `invite_not_found`                                                |
| `POST /api/teams/invite-decline/:token`          | none          | 200 `TeamInviteDecline` (`declined` / `expired`); 409 `already_joined`; 404 `invite_not_found` |
| other methods on that path                       | none          | 404 `not_found`                                                                                |
| `DELETE /api/teams/:id/members/:own invited`     | Clerk session | 204; marks `declined` (no delete)                                                              |
| `PUT /api/teams/:id/members/:rejected`           | admin         | 409 `invite_rejected`                                                                          |
| `POST /api/teams/:id/members` (rejected address) | admin         | 201; the rejected row is deleted and a fresh `invited` row inserted in one batch               |

- Token grammar: `^<uuid v4 lowercase>\.[A-Za-z0-9_-]{43}$`. Anything else is 404 before any read.
- `addTeamMember` returns `{ member, declineToken }`; the token goes only into `teamInviteEmail(env, name, token)`.
- Client: `apiReadTeamInviteDecline(token)` (null on 404), `apiDeclineTeamInvite(token)` (null on 404, `'already_joined'` on 409, throws otherwise). Neither sends identity headers.

## Behaviour and state

```
invited --accept--> joined
invited --decline (app or email)--> declined
invited --28 days--> expired
declined | expired --admin remove--> (row gone)
declined | expired --re-invite--> (row gone) + new invited row
```

- Guards: `declineTeamInvite` and `acceptTeamMember` both write `WHERE status = 'invited'`; one wins a race, and only the winner emits the Timeline card and the admins' email.
- `getMembership` reads open rows only, so a rejected row passes no team gate (detail, accept, library: all 404).
- `connectInvitesByEmail` claims `status = 'invited'` rows only.
- `joinTeamByInviteToken` deletes the caller's rejected rows (by user id or address) before its fresh insert.
- Reminder windows: stage 1 `[1d, 7d)`, stage 2 `[7d, 21d)`, stage 3 `[21d, 28d)`, by `created_at`. Disjoint, so at most one email per invite per run; `markInviteReminderSent` stamps earlier null stages `0`.
- Sweep order per run: expiry (always), then stages 3, 2, 1 (email only).

## Errors and edge cases

| Case                                        | Handling                                                                                           |
| ------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| Token malformed / unknown id / wrong secret | 404 `invite_not_found`, identical body                                                             |
| Row has no hashes (creator row, legacy row) | Same 404                                                                                           |
| Decline after accept                        | 409 `already_joined`; page "You're Already in <team>"                                              |
| Decline after decline                       | 200 `declined`, nothing emitted                                                                    |
| Decline after expiry                        | 200 `expired`, nothing emitted                                                                     |
| Decline races accept                        | Loser re-reads status; joined → 409                                                                |
| Reminder send fails                         | No stamp, no hash stored, `reminder_attempts + 1`; at 3 the invite leaves the queries, logged once |
| Invite answered mid-send                    | `markInviteReminderSent` guarded on `invited`: no stamp, no hash                                   |
| Email off                                   | Expiry still runs; no reminders; invite email never sent                                           |
| D1 failure in the sweep                     | Caught per step, logged, never thrown into `scheduled()`                                           |
| Team deleted                                | Rows go with it; tokens then 404                                                                   |

## Security and trust

- Trust boundary: the decline doors take no identity. The token is the only credential; it reads one team name and one status and flips one row from `invited` to `declined`. It cannot accept, join, read members, or reach any other route.
- Only hashes are stored; a D1 leak yields no working link. Secrets are 256 bits from `crypto.getRandomValues`.
- Compare: `timingSafeEqual` over every stored hash with no early exit; failures share one 404.
- Link scanners: GET never writes; only the page's button POSTs.
- Rate limit: `TEAM_INVITE_RATE_LIMITER` 20/60s keyed `invite-decline:<network>` (`communityNetwork`), outside `WRITE_RATE_LIMITER`. Absent binding allows.
- Rejected rows are excluded from mentions and assignees (`isOpenTeamMember`) on the server and in `teamMemberRows`.
- Share roles: not applicable (teams are managed outside document sessions; see the spec).

## Performance and limits

- Per decline request: one indexed primary-key read, at most `DECLINE_TOKEN_MAX_HASHES` (4) SHA-256 compares, one guarded UPDATE.
- Per daily run: expiry is one UPDATE over at most `INVITE_EXPIRY_BATCH` (500) ids through the partial index; each stage reads at most `INVITE_REMINDER_BATCH` (100) rows through it and does at most 100 sends, so at most 300 Resend calls a run (sequential, inside the cron's `waitUntil`).
- `team-invite-reminders.test.ts` asserts the expiry query plan uses `team_members_pending_idx`.

## Presentation and UX

- Member row: rejected → rose "Rejected" pill, dimmed avatar, secondary line `<email> · Declined` / `<email> · Expired`, no role control, Remove always visible for an Admin. Header "N invited" counts `invited` only.
- Remove confirm (`teamRemovalCopy('rejected')`): title "Remove from list?", message "<name> declined the invite to "<team>"." or "<name>'s invite to "<team>" expired with no reply." plus "Removing clears it from the list, and you can invite them again any time.", confirm "Remove".
- Landing card states and copy: Loading ("Loading the invite…"), Pending ("Decline the Invite to <team>?", button "Decline Invite", busy "Declining…", link "Accept Instead" → `/explorer/invites`), Declined ("Invite Declined"), Expired ("This Invite Has Expired"), Joined ("You're Already in <team>", "Open Explorer"), Invalid ("This Invite Link Isn't Valid", "Go to livediagram"), error line "Could not decline the invite. Try again."
- Emails: invite outro gains " Not for you? Decline the invite, no account needed."; reminders reuse the invite body with their own subject, heading and intro (`REMINDER_COPY`).

## Accessibility

- The landing is one `h1` per state inside `LandingCard`; the error line is `role="alert"`; the decline control is a real `<button>` disabled while busy.
- Rejected pill text meets AA (rose-700 on rose-50; rose-300 on rose-500/15 dark). Remove keeps its `aria-label` "Remove <name>".
- No motion added.

## Web Experience

- `/join/decline` is a static-export client page: a thin shell, one GET after hydration, no layout shift between states beyond the card's text (fixed-width card). No new dependencies.

## Observability

| Fingerprint                                                             | When                                  |
| ----------------------------------------------------------------------- | ------------------------------------- |
| `[team-invites] declined from the email`                                | an email decline flipped a row        |
| `[team-invites] sweep: expired N, reminded N, failed N`                 | every daily run                       |
| `[team-invites] giving up on an invite after 3 failed reminders`        | attempt cap reached                   |
| `[team-invites] expiry failed` / `reminder <n> failed` / `sweep failed` | a sweep step threw                    |
| `Email·Sent·TeamInviteReminder1..3`                                     | each reminder sent (server telemetry) |
| `Team·Declined·Email`                                                   | the landing's decline succeeded       |
| `Team·Removed·Rejected`                                                 | an Admin cleared a rejected row       |

## Testing

| Rule                                                                               | Test                                                     |
| ---------------------------------------------------------------------------------- | -------------------------------------------------------- |
| Token minted per invite, hash only stored, resolves, refuses                       | `apps/api/src/db/team-invite-decline.test.ts`            |
| Decline guarded; rejected rows grant nothing; re-invite replaces; link join clears | same                                                     |
| Legacy invites never reminded                                                      | same ("migration 0095")                                  |
| Windows, stamps, attempts, expiry, index                                           | `apps/api/src/db/team-invite-reminders.test.ts`          |
| Sweep end to end, links work, cap, email off                                       | `apps/api/src/email/team-invite-reminders.test.ts`       |
| Doors: GET never writes, POST idempotent, 409, 404s                                | `apps/api/src/routes/team-invite-decline-route.test.ts`  |
| In-app decline marks declined; rejected remove / role change                       | `apps/api/src/routes/teams.test.ts`                      |
| Rate limit keyed per network, apart from writes                                    | `apps/api/src/index.test.ts`                             |
| Email links and reminder copy                                                      | `apps/api/src/email/templates.test.ts`                   |
| Landing states, button-only decline                                                | `apps/live/components/panels/TeamInviteDecline.test.tsx` |
| Client calls                                                                       | `apps/live/lib/api/team-invite-decline.test.ts`          |
| Rejected row rendering                                                             | `apps/live/components/panels/TeamPane.test.tsx`          |
| Removal kind, copy, telemetry type                                                 | `apps/live/components/panels/team-removal.test.ts`       |
| Pickers leave rejected rows out                                                    | `apps/live/hooks/collab/team-member-rows.test.ts`        |

## Constants and configuration

| Constant                    | Value       | Provenance                           | Safe range                   |
| --------------------------- | ----------- | ------------------------------------ | ---------------------------- |
| `INVITE_REMINDER_DELAYS_MS` | 1d, 7d, 21d | spec "Reminders and expiry"          | increasing, all below expiry |
| `INVITE_EXPIRY_MS`          | 28d         | spec; a week after the last reminder | above the last delay         |
| `INVITE_REMINDER_BATCH`     | 100         | the lifecycle series' `SWEEP_LIMIT`  | 1..500                       |
| `INVITE_EXPIRY_BATCH`       | 500         | one indexed UPDATE, no sends         | 1..5000                      |
| `MAX_SEND_ATTEMPTS`         | 3           | shared with `email-lifecycle.ts`     | 1..10                        |
| `DECLINE_TOKEN_MAX_HASHES`  | 4           | the invite + three reminders         | = 1 + number of stages       |
| Secret length               | 32 bytes    | 256-bit, unguessable                 | at least 16                  |
| `TEAM_INVITE_RATE_LIMITER`  | 20 / 60s    | far above one person declining       | 5..120                       |

## Defaults ledger

D163 to D167 in [DEFAULTS.md](DEFAULTS.md).
