# Teams

Groups of signed-in users, managed from the Explorer page. v1 is membership only: a team is a named group with roles. Sharing designs with a team (the payoff) is a follow-up spec built on top of this one.

## Why

Multi-user team permissions have been "still ahead" since [Build phase](../005-project-roadmap/prototype-scope.md). This is the foundational slice: who is in a team, and who may manage it.

## Data model

Two D1 tables, owned by the api worker (the baseline migration, `0001_livedesign_baseline.sql`):

- **`teams`**: `id`, `name`, `organisation` (free text, nullable), `created_at`, `updated_at`. No owner column: ownership is expressed through the Admin role in the link table, so a team survives its creator leaving.
- **`team_members`** (the link table): `id`, `team_id`, `user_id` (nullable), `email` (nullable), `role` (`'admin' | 'member'`), `status` (`'invited' | 'joined'`), `created_at`, `updated_at`.
  - `user_id` is an account user id (`user_…`). Null on a pending invite that hasn't connected yet.
  - `email` is the lowercased invite address. Unique per team. May be null only on the creator's row when the deployment's JWT carries no email claim.
  - One of `user_id` / `email` is always set.
  - **One row per person per team**: a unique index on `(team_id, user_id) WHERE user_id IS NOT NULL` refuses a second membership row for the same user.
  - `status` is the invite's state: `invited` (waiting for an answer), `joined` (a member), or one of the two **rejected** states, `declined` (the invitee said no, in the app or from the email) and `expired` (nobody answered within the invite's lifetime, see "Reminders and expiry"). Creator rows are born `joined`; invite rows are born `invited`.
  - A rejected row is a **record, not a membership**: it grants nothing (no team detail, no library, no accept), counts toward nothing, and stays on the member list only so an Admin can see the answer. It leaves the list when an Admin removes it, or when the same address is invited again (the old row is replaced by a fresh invite).
  - The baseline migration, `0001_livedesign_baseline.sql`, adds the invite's email lifecycle: `decline_token_hashes` (the SHA-256 hashes of the decline tokens its emails carry, space-separated, at most four: the invite and its three reminders; they live as long as the row, so a link keeps saying what became of the invite), `reminder1_sent_at` / `reminder2_sent_at` / `reminder3_sent_at` (each reminder's stamp, `0` = skipped), `reminder_attempts` (failed reminder sends in a row), and `clock_started_at` (when the invite's reminder and expiry clock started: its `created_at` for a new invite). A partial index on `clock_started_at WHERE status = 'invited'` serves the daily sweep. Pending invites that already existed when the migration ran start their clock at the deploy (the migration's own time), so they get the full reminder series and expire 28 days after the deploy: none is rejected on the first run, however old.

## Identity: signed-in only

Teams are keyed by account user ids and invites are keyed by email, so the whole feature requires a verified signed-in session:

- Every `/api/teams*` endpoint requires a verified account access token (`Authorization: Bearer`). The guest `X-Owner-Id` path gets `401 sign_in_required`. This does NOT violate [Auth + guest access](../014-identity/auth-and-guest-access.md)'s no-sign-in-wall rule: the canvas and everything else stays guest-accessible; only the Teams surface asks for an account.
- In the Explorer sidebar, guests see the sign-in nudge ("Sign in to access Teams") at the end of the Spaces group instead of team rows and New Team ([Explorer structure](explorer-structure.md)). Self-host deployments without sign-in ([Open source + distribution](../002-project-scope/open-source-and-business-model.md)) show neither.

### Email claim

Connect-on-signup needs the user's email so a pending invite can be matched to the person. The worker trusts **exactly one source**: the `email` claim on the account access token (`apps/api/src/auth/accounts.ts`), because it rides inside the JWKS-verified payload, and only when the token's `email_verified` claim is true (signing in by emailed code is what verifies it). The accounts Worker puts both claims on every access token it mints for livedesign; there is nothing to configure per deployment.

**Teams invite auto-connection requires this claim.** When the access token doesn't carry a verified one, `accountEmail` is null and the lazy connect step below is a no-op (the user still signs in and uses everything else; they just won't see invites auto-attach until their address is verified). This is a deliberate fail-closed default.

A client-supplied `X-Owner-Email` header used to be a fallback, but it was **removed** (a signed-in caller could forge another address and claim that address's pending invites — join the team and read its private library). Email is never taken from a client header; only from the verified claim. A guest (no signed-in session) has no email either way, so invites are signed-in only.

## Invites, connect-on-sign-in, and accept/decline

Membership is a two-step handshake: being invited does not make someone a member until they accept.

- An Admin invites by email address. That creates a `team_members` row: `role = 'member'`, `email = <lowercased address>`, `user_id = NULL`, **`status = 'invited'`**. When email is configured the invitee gets the team invite email ([Transactional email (Resend)](../014-identity/transactional-email.md)), with a **Decline invite** link (below); without email the inviter tells the person out of band.
- **Lazy email claim**: on every authenticated `GET /api/teams` and `GET /api/teams/invites`, the worker connects pending invites (`user_id = <sub> WHERE email = <caller's verified email> AND user_id IS NULL`) using the email resolved per the section above, so an invitee just opens the Invites page and sees invites sent to the address they're signed in with. Connecting fills in who the person is, it does **not** accept for them; `status` stays `invited`. A team the caller already belongs to is skipped: its invite row stays unclaimed rather than becoming a second membership for the same person.
- The invitee sees the invite in the Explorer's **Invites** section (below, with team name, organisation, and member count) and chooses:
  - **Accept** → `status` flips to `joined`; the team moves into their Teams list and their row in the team reads as a normal member.
  - **Decline** → `status` becomes `declined`; they were never a member. The row stays on the team's member list as **Rejected** until an Admin removes it. An Admin may re-invite the same address later, which replaces the rejected row with a fresh invite.
- Either response (accept or decline) emails the team's admins, opt-out per
  admin, when email is configured — see [Account settings & email notifications](../014-identity/profile-and-email-notifications.md).
  Leaving a team you already joined is not an invite response and sends nothing.
- An `invited` row grants no membership: `GET /api/teams` lists `joined` rows only, and `memberCount` counts `joined` rows only. The invitee may read the team's detail (to decide), accept, or decline — nothing else.
- Duplicate invite of an email already on the team as `invited` or `joined`: `409 conflict`. An address whose row is rejected (`declined` or `expired`) is invited afresh: the rejected row is deleted and a new `invited` row (new id, new tokens, its own reminder clock) takes its place in one batch.
- **Accept after a rejection**: there is nothing to accept. A rejected row is not a membership, so the accept route answers `404` like any invite that no longer exists, and the Invites section never lists it. Only a fresh invite from an Admin reopens the door.

## Declining from the email

Implementation detail for this section and the next lives in the [Team invites blueprint](blueprints/team-invites.md).

The invite email (and every reminder) carries a **Decline invite** link, so someone who does not want to join can say so without an account, and without signing in.

- **The token.** Each email carries its own unguessable decline token, `<member id>.<secret>`, where the secret is 32 random bytes (base64url). Only the SHA-256 hash of the secret is stored, in the row's `decline_token_hashes`; the token itself exists only in the email. It is **single-purpose**: it can decline that one invite and read that invite's team name and state, nothing else. It is not a session, not an identity, and cannot accept, join, or reach any other route.
- **Checking it.** The server splits the token, loads the row by member id, hashes the presented secret and compares it to each stored hash in constant time (`timingSafeEqual`). An unknown id (including a row an Admin removed or replaced with a fresh invite), a malformed token, a row with no hashes, or no matching hash all answer the same `404 invite_not_found`, so the endpoint never reveals whether an id exists.
- **The landing page** is `/join/decline?token=<token>` in the live app, outside the Explorer chrome like `/join`, and works the same signed in or out. It reads the token client-side, looks the invite up (`GET`), and shows the team name with a **Decline Invite** button. **Only the button declines** (a `POST`): mail-client link scanners and prefetchers that open the URL do nothing but read. The states it shows:
  - **Pending**: "Decline the invite to <team>?" with Decline Invite, and a note that accepting needs signing in with the invited address (an Open Invites link to `/explorer/invites`).
  - **Declined** (just now, or before): "Invite declined", the team's admins can see it, nothing else happens, and they can be invited again later.
  - **Expired**: "This invite has expired".
  - **Already joined**: "You're already in <team>", with an Open Explorer link; the token cannot undo a membership.
  - **Invalid** (unknown token, removed or replaced invite): "This invite link isn't valid".
- **Idempotent.** Declining an already-declined invite answers `200 { status: 'declined' }` again and changes nothing; an expired one answers `200 { status: 'expired' }`; a joined one answers `409 already_joined`. Only the request that flips `invited` to `declined` (guarded in the write) tells anyone.
- **What a decline does**: the row becomes `declined` and reminders stop. Its links keep working only to say it was declined. The team's admins get the same Timeline card and invite-response email (opt-out per admin) an in-app decline sends.
- **Rate limits.** Both the read and the decline sit outside the owner-keyed write limiter and are limited per network (`TEAM_INVITE_RATE_LIMITER`, 20 a minute per IPv4 /24 or IPv6 /56, keyed `invite-decline:<network>`), like the api's other unauthenticated doors. Absent binding: allowed (self-host). The 256-bit secret makes guessing hopeless either way; the limit bounds D1 reads.

## Reminders and expiry

An invite nobody answers is followed up three times, then closes on its own, so a team's member list never fills with invitations that will never be taken up.

- **Reminders.** The api worker's daily cron sends a reminder email to the invite address at **1 day**, **7 days** and **21 days** after the invite's clock started (`clock_started_at`: when it was sent), while the row is still `invited`. Each reminder carries a fresh decline token (its hash appended to `decline_token_hashes`), so every email's Decline link works until the invite closes. A daily cadence means "after 1 day" resolves to the first run on or after day 1.
- **One email per invite per run.** If the sweep falls behind (email was off, the cron missed a day), an invite gets only the latest reminder it is due, and the earlier ones it skipped are stamped `0`. The three windows are disjoint (`[1d, 7d)`, `[7d, 21d)`, `[21d, 28d)`), so no run sends two reminders for one invite.
- **Stops** the moment the row is not `invited`: accepted, declined (either way), withdrawn or removed by an Admin, or expired. Every reminder query reads `status = 'invited'`.
- **Bounded and capped.** Each stage takes at most 100 invites a run, oldest first. A failed send leaves the stamp unset for tomorrow and adds one to `reminder_attempts`; at 3 (`MAX_SEND_ATTEMPTS`, as the onboarding series) the invite leaves the reminder queries for good, and a success resets the count.
- **Expiry.** **28 days** after the clock started, a row still `invited` becomes `expired`: rejected, shown on the team page the same way as a decline; its decline links then only say it expired. Expiry runs in the same daily cron, at most 500 rows a run, oldest first, before the reminders, and runs **whether or not email is configured**, so every deployment follows one rule. Nobody is emailed about an expiry: the admins see it on the team page.

## Shareable invite link

A second way in, alongside per-address invites: a **shareable link** an admin actively turns on. Anyone signed in who opens it can join the team as a member. It's deliberately not on by default — the admin generates it — and it **expires after one week**.

- **Data**: one regenerable token lives on the team itself (`teams.invite_link_token` + `teams.invite_link_expires_at`, both nullable). NULL token = the link is off. This is distinct from the per-member `team_members` rows; it's a team-level credential.
- **Turn on / off (admin only)**: `POST /api/teams/:id/invite-link` mints a fresh token and sets the expiry to now + 7 days (regenerating while on rotates the token and resets the week); `DELETE /api/teams/:id/invite-link` turns it off. The team detail (`GET /api/teams/:id`) carries the current `inviteLink: { token, expiresAt } | null` **for admins in an interactive session only** (null for members, for every API token, and once expired): the token admits any account, so it is administration, which tokens never reach.
- **Resolve (open)**: `GET /api/teams/invite-link/:token` returns `{ team, memberCount, alreadyMember }` when the token is on and unexpired, else `404`. This one endpoint sits **above** the sign-in gate — a token holder must see _what_ they're joining before they sign in, and the token is the credential, so naming the team to whoever holds it is fine. `alreadyMember` is computed against the caller's verified id when present, else false, and is true only for a **joined** membership: someone whose email invite is still pending is offered **Join**, which accepts it.
- **Join (signed-in)**: `POST /api/teams/invite-link/:token/join` adds the caller as a **joined** member and returns `{ teamId, alreadyMember }`. Idempotent: an existing membership is a no-op, and a pending email invite for the caller is accepted in place rather than duplicated. Guests get `401` (teams are for accounts only); an invalid/expired token `404`s.
- **The landing page** is the top-level `/join?token=<token>` route (outside the Explorer chrome, see [Router app](../016-platform/router-app.md)), so the signed-out flow renders its own card instead of being bounced by the explorer's auth gate. It resolves the token, then shows: **Join / Decline** to a signed-in non-member (Join → the team page; Decline → back to their designs); "already a member" with an Open-team link; or, to a signed-out visitor, why an account is needed plus **Sign in** / **Create an account** links whose `redirect_url` carries the same `/join?token=…` URL, so auth returns them here to finish joining. An off / expired / unknown token shows an "invite link isn't valid" card.
- **Explorer UI**: the team detail page header gains an **"Invite by Link"** button (admins only, to the left of the overflow menu) opening a modal (`TeamInviteLinkDialog`) that turns the link on, copies the URL, shows the expiry, and turns it off.

## Roles and permissions

Two roles: `admin`, `member`. The creating user becomes the team's first Admin.

| Action                             | Admin | Member |
| ---------------------------------- | ----- | ------ |
| See team + member list             | ✓     | ✓      |
| Invite by email                    | ✓     |        |
| Turn the invite link on / off      | ✓     |        |
| Change a member's role             | ✓     |        |
| Edit Team (name, organisation)     | ✓     |        |
| Remove a member / cancel an invite | ✓     |        |
| Remove a rejected invite           | ✓     |        |
| Leave the team (remove own row)    | ✓\*   | ✓      |
| Delete the team                    | ✓     |        |

Share roles (Editor / Participant / Viewer) do not apply here: teams are managed from the Explorer by signed-in members, never from inside a shared design's session, so nothing on this page is reachable through a share link. The email's decline link is the one door that needs no account, and it can only decline that one invite.

\* **Last-admin guard**: the last remaining Admin cannot be demoted, removed, or leave; the server rejects with `409 last_admin`. Promote someone else first, or delete the team. Deleting the team removes all member rows.

## API

All under `/api/teams`, account Bearer required, handled by `apps/api/src/routes/teams.ts`:

- `GET /api/teams` — lazy-claims invites (above), then lists teams the caller has **joined**, each with `myRole` and `memberCount`.
- `GET /api/teams/invites` — lazy-claims, then lists the caller's pending invites (member id + team summary + joined-member count). The Explorer's Invites badge is this list's length.
- `POST /api/teams/:id/members/:memberId/accept` — own row only; flips `status` from `invited` to `joined`. Declining is the existing `DELETE` on the own member row, which marks an `invited` row `declined` rather than deleting it.
- `POST /api/teams` `{id, name, organisation?}` — creates the team plus the caller's Admin member row.
- `GET /api/teams/:id` — team + full member list + `myRole`. Members only.
- `PUT /api/teams/:id` `{name?, organisation?}` — Admin only.
- `DELETE /api/teams/:id` — Admin only; deletes member rows too.
- `POST /api/teams/:id/members` `{email}` — Admin only; creates the pending invite row.
- `PUT /api/teams/:id/members/:memberId` `{role}` — Admin only; last-admin guard.
- `DELETE /api/teams/:id/members/:memberId` — Admin, or the member's own row (leave, or decline while `invited`); last-admin guard. An Admin deleting a rejected row clears it from the list. Removes every row that user holds in the team, never just one of them. The guard counts joined admins who are other people, so a second row of the same user never stands in as the remaining admin.
- `POST /api/teams/:id/invite-link` / `DELETE /api/teams/:id/invite-link` — Admin only; turn the shareable invite link on (mint + 1-week expiry) / off (see "Shareable invite link").
- `GET /api/teams/invite-link/:token` — resolve a join token to its team; open (guest-readable).
- `GET /api/teams/invite-decline/:token` — open. `{ teamName, status }` for the invite a decline token names (`status`: `invited`, `declined`, `expired` or `joined`); `404 invite_not_found` otherwise. Read only, so a link scanner opening the page changes nothing.
- `POST /api/teams/invite-decline/:token` — open. Declines that invite: `200 { teamName, status }` (`declined`, or `expired` when it already had); `409 already_joined`; `404 invite_not_found`. Idempotent.
- `POST /api/teams/invite-link/:token/join` — signed-in; join via the link.

Wire DTOs (`Team`, `TeamListItem`, `TeamMember`, `TeamRole`) live in `@livedesign/api-schema`.

## Explorer UI

In the Explorer sidebar, each team is a root-level folder row in the **Spaces** group, after **My Work**: the two kinds of space read as the same noun ([Explorer structure](explorer-structure.md)).

- One row per team the user has joined; selecting it shows the team in the right pane, and it expands to the team's folders.
- An **Invites** row, shown while an invite is pending, with a count badge. Selecting it shows each pending invite as a card (team name, organisation, joined-member count) with **Accept** and **Decline** actions. Accepting selects the newly joined team; declining removes the card.
- **New Team**, the group's last row (signed-in only), opens a create modal (name + organisation); submitting creates the team with the user as Admin. A guest sees the sign-in nudge in its place.

The right-pane team view is **one calm card**, not a stack of panels:

- A header line with the organisation and member count, plus an overflow (⋯) menu holding the rare actions: Edit Team and Delete Team (admins), Leave Team (any member who isn't the last Admin).
- The member list: a deterministic-colour avatar per row, the person's **name** as the primary line — the caller's own row shows their account display name with a small "you" chip (never a bare "You"), other rows show their resolved display name or the invite email's local part prettified ("anna.smith" → "Anna Smith") — and the member's **email address** on a muted secondary line beneath the name (truncated for long addresses so the row stays tidy on mobile). Pending rows carry an amber **"Invited"** pill next to the name and render their avatar dimmed. Rejected rows (`declined` or `expired`) carry a rose **"Rejected"** pill, a dimmed avatar, and a secondary line that says which: "<email> · Declined" or "<email> · Expired" (no reply within 28 days). A rejected row has no role select (it holds no role worth changing), and for an Admin its Remove control is always visible rather than hover-only, because clearing it is the only thing left to do with it. The header's "N invited" counts `invited` rows only.
- Roles: admins get a quiet inline role select per row; non-admins see a read-only role pill. Remove actions appear on row hover only.
- The Remove action reads the row's `status`: an `invited` row has never been a member, so its confirm asks to **Withdraw Invite?** and says the person has not joined yet, rather than offering to remove them "from" a team they were never in. A rejected row's confirm asks **Remove from list?** and says the invite was declined (or expired) and that they can be invited again. `components/panels/team-removal.ts` owns that wording alongside the telemetry type, so the two can't disagree.
- **The last-admin rule shapes the affordances, not just the server**: the only Admin sees no Leave item, no remove control on their row, and a pinned "Admin" pill (with an explanatory hover card) instead of a role select. "Only Admin" counts **joined** admins, exactly as the server does (`components/panels/team-last-admin.ts`): an invited row promoted to admin neither keeps the last joined admin's Leave available nor gets pinned itself. The server's `409 last_admin` remains as the backstop for stale UIs.
- Admins also get a slim invite-by-email footer row. Placeholder copy: "Add your team by email address, they will receive an invite." (The invite lands in their in-app Invites section, and in their inbox when email is configured.)

The pane title row reads "Recent Designs" for the recent section (renamed from "Recent" in the same change as this spec).

**Creating a team from a placement picker.** The Explorer's Move dialog opens on the space
overview ([Save Locations](../006-design/save-locations.md)), and that overview carries a **New Team** tile after
the team cards for signed-in users: an inline name field that creates the
team and enters it, so "put this design in a new team" is one flow rather
than a detour through the sidebar's New Team form. The sidebar form stays
for the organisation field and invites.

## Telemetry

New category `Team` ([Telemetry + public transparency dashboard](../017-telemetry/telemetry.md)). Events: `Team/Created`, `Team/Deleted`, `Team/Changed` (edit name/organisation), `Team/Changed/Role` (role change), `Team/Added/Member` (invite sent), `Team/Joined` (invite accepted), `Team/Declined/Invite` (the recipient turned it down), `Team/Removed/Invite` (an Admin withdrew an invitation nobody accepted), `Team/Removed/Rejected` (an Admin cleared a declined or expired invite from the list), `Team/Removed/Member` (admin removes someone who had joined), `Team/Removed/Self` (leave). The email decline page sends `Team/Declined/Email` when its Decline Invite button succeeds, so declines from the inbox read apart from the Explorer's `Team/Declined/Invite`. Reminder emails count as `Email/Sent/TeamInviteReminder1` / `2` / `3`. No `type` value carries user content.

Declining and withdrawing are separate events because they are separate acts by separate people, and pooling them cost the accept rate: the earlier spelling gave `Removed/Invite` to the decline, which left an Admin's withdrawal falling into `Removed/Member` and put invitations nobody accepted into the count of people who left a team. See [Telemetry + public transparency dashboard](../017-telemetry/telemetry.md) for the funnel this forms.

## Out of scope (v1)

- Sharing designs with a team / team workspaces.
- Team avatars, descriptions beyond the organisation line.
- Looking up whether an invited email already has an account (would need a user lookup on the accounts Worker).
