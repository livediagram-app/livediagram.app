# 32 — Teams

Groups of signed-in users, managed from the Explorer page. v1 is membership only: a team is a named group with roles. Sharing diagrams with a team (the payoff) is a follow-up spec built on top of this one.

## Why

Multi-user team permissions have been "still ahead" since spec/02. This is the foundational slice: who is in a team, and who may manage it.

## Data model

Two D1 tables, owned by the api worker (migration `0019_teams.sql`):

- **`teams`**: `id`, `name`, `organisation` (free text, nullable), `created_at`, `updated_at`. No owner column: ownership is expressed through the Admin role in the link table, so a team survives its creator leaving.
- **`team_members`** (the link table): `id`, `team_id`, `user_id` (nullable), `email` (nullable), `role` (`'admin' | 'member'`), `status` (`'invited' | 'joined'`, migration `0021`), `created_at`, `updated_at`. (Migration `0023` added an `invite_token` column for a shareable-link flow that was later dropped in favour of email matching; the column is retained but unused.)
  - `user_id` is a Clerk user id. Null on a pending invite that hasn't connected yet.
  - `email` is the lowercased invite address. Unique per team. May be null only on the creator's row when the deployment's JWT carries no email claim.
  - One of `user_id` / `email` is always set.
  - `status` is the accept/decline handshake state. Creator rows are born `joined`; invite rows are born `invited`. Rows that pre-date migration 0021 were backfilled `joined` (they joined under the old auto-join rules) except never-connected invites, which stayed `invited`.

## Identity: signed-in only

Teams are keyed by Clerk user ids and invites are keyed by email, so the whole feature requires a verified Clerk session:

- Every `/api/teams*` endpoint requires a verified Clerk Bearer token. The guest `X-Owner-Id` path gets `401 sign_in_required`. This does NOT violate spec/04's no-sign-in-wall rule: the canvas and everything else stays guest-accessible; only the Teams surface asks for an account.
- In the Explorer, guests see the Teams section with a "sign in to use teams" link instead of team rows. Clerk-disabled self-host deployments (spec/03) hide the section entirely.

### Email claim

Connect-on-signup needs the user's email so a pending invite can be matched to the person. The worker resolves it from two sources, in order:

1. **The verified `email` claim on the Clerk session token** (`apps/api/src/auth/clerk.ts`). Adding it is optional: Clerk dashboard → Sessions → Customize session token → `{"email": "{{user.primary_email_address}}"}`. It has to be the session token, not a named JWT template — the frontend authenticates with `getToken()` (no template), so a named template is never requested. When present this is the trusted path.
2. **The `X-Owner-Email` request header** — the frontend forwards the signed-in user's Clerk-verified `primaryEmailAddress` on every authenticated request (`setEmailProvider`). The worker falls back to it when the token carries no claim, so invites connect with **zero Clerk-dashboard config** out of the box.

The header is consulted **only** for invite matching, never for ownership / write auth (those stay JWT-`sub` based). The trade-off: a signed-in user could hand-craft a request with someone else's address and surface / accept a team invite addressed to it. The session-token claim (path 1) closes that gap for deployments that want it; path 2 keeps the common case working without setup. A guest (no Clerk session) has no email either way, so invites are signed-in only.

## Invites, connect-on-sign-in, and accept/decline

Membership is a two-step handshake: being invited does not make someone a member until they accept.

- An Admin invites by email address. That creates a `team_members` row: `role = 'member'`, `email = <lowercased address>`, `user_id = NULL`, **`status = 'invited'`**. **No email is sent in v1** (Resend hasn't shipped); the inviter tells the person out of band.
- **Lazy email claim**: on every authenticated `GET /api/teams` and `GET /api/teams/invites`, the worker connects pending invites (`user_id = <sub> WHERE email = <caller's verified email> AND user_id IS NULL`) using the email resolved per the section above, so an invitee just opens the Invites page and sees invites sent to the address they're signed in with. Connecting fills in who the person is, it does **not** accept for them; `status` stays `invited`.
- The invitee sees the invite in the Explorer's **Invites** section (below, with team name, organisation, and member count) and chooses:
  - **Accept** → `status` flips to `joined`; the team moves into their Teams list and their row in the team reads as a normal member.
  - **Decline** → the member row is deleted; they were never a member. An Admin may re-invite the same address later.
- An `invited` row grants no membership: `GET /api/teams` lists `joined` rows only, and `memberCount` counts `joined` rows only. The invitee may read the team's detail (to decide), accept, or decline — nothing else.
- Duplicate invite of an email already on the team (any status): `409 conflict`.

## Shareable invite link

A second way in, alongside per-address invites: a **shareable link** an admin actively turns on. Anyone signed in who opens it can join the team as a member. It's deliberately not on by default — the admin generates it — and it **expires after one week**.

- **Data**: one regenerable token lives on the team itself (migration `0025`: `teams.invite_link_token` + `teams.invite_link_expires_at`, both nullable). NULL token = the link is off. This is distinct from the per-member `team_members` rows; it's a team-level credential. (The unused per-member `invite_token` column from migration `0023` is unrelated and stays dormant.)
- **Turn on / off (admin only)**: `POST /api/teams/:id/invite-link` mints a fresh token and sets the expiry to now + 7 days (regenerating while on rotates the token and resets the week); `DELETE /api/teams/:id/invite-link` turns it off. The team detail (`GET /api/teams/:id`) carries the current `inviteLink: { token, expiresAt } | null` **for admins only** (null for members, and null once expired).
- **Resolve (open)**: `GET /api/teams/invite-link/:token` returns `{ team, memberCount, alreadyMember }` when the token is on and unexpired, else `404`. This one endpoint sits **above** the sign-in gate — a token holder must see _what_ they're joining before they sign in, and the token is the credential, so naming the team to whoever holds it is fine. `alreadyMember` is computed against the caller's verified id when present, else false.
- **Join (signed-in)**: `POST /api/teams/invite-link/:token/join` adds the caller as a **joined** member and returns `{ teamId, alreadyMember }`. Idempotent: an existing membership is a no-op, and a pending email invite for the caller is accepted in place rather than duplicated. Guests get `401` (teams are Clerk-only); an invalid/expired token `404`s.
- **The landing page** is the top-level `/join?token=<token>` route (outside the Explorer chrome, see [spec/08](08-router-app.md)), so the signed-out flow renders its own card instead of being bounced by the explorer's auth gate. It resolves the token, then shows: **Join / Decline** to a signed-in non-member (Join → the team page; Decline → back to their diagrams); "already a member" with an Open-team link; or, to a signed-out visitor, why an account is needed plus **Sign in** / **Create an account** links whose `redirect_url` carries the same `/join?token=…` URL, so auth returns them here to finish joining. An off / expired / unknown token shows an "invite link isn't valid" card.
- **Explorer UI**: the team detail page's admin invite footer gains an **"Invite by link"** button (with a green "On" dot when active) opening a modal (`TeamInviteLinkDialog`) that turns the link on, copies the URL, shows the expiry, and turns it off.

## Roles and permissions

Two roles: `admin`, `member`. The creating user becomes the team's first Admin.

| Action                             | Admin | Member |
| ---------------------------------- | ----- | ------ |
| See team + member list             | ✓     | ✓      |
| Invite by email                    | ✓     |        |
| Turn the invite link on / off      | ✓     |        |
| Change a member's role             | ✓     |        |
| Edit team (name, organisation)     | ✓     |        |
| Remove a member / cancel an invite | ✓     |        |
| Leave the team (remove own row)    | ✓\*   | ✓      |
| Delete the team                    | ✓     |        |

\* **Last-admin guard**: the last remaining Admin cannot be demoted, removed, or leave; the server rejects with `409 last_admin`. Promote someone else first, or delete the team. Deleting the team removes all member rows.

## API

All under `/api/teams`, Clerk Bearer required, handled by `apps/api/src/routes/teams.ts`:

- `GET /api/teams` — lazy-claims invites (above), then lists teams the caller has **joined**, each with `myRole` and `memberCount`.
- `GET /api/teams/invites` — lazy-claims, then lists the caller's pending invites (member id + team summary + joined-member count). The Explorer's Invites badge is this list's length.
- `POST /api/teams/:id/members/:memberId/accept` — own row only; flips `status` from `invited` to `joined`. Declining is the existing `DELETE` on the own member row.
- `POST /api/teams` `{id, name, organisation?}` — creates the team plus the caller's Admin member row.
- `GET /api/teams/:id` — team + full member list + `myRole`. Members only.
- `PUT /api/teams/:id` `{name?, organisation?}` — Admin only.
- `DELETE /api/teams/:id` — Admin only; deletes member rows too.
- `POST /api/teams/:id/members` `{email}` — Admin only; creates the pending invite row.
- `PUT /api/teams/:id/members/:memberId` `{role}` — Admin only; last-admin guard.
- `DELETE /api/teams/:id/members/:memberId` — Admin, or the member's own row (leave); last-admin guard.
- `POST /api/teams/:id/invite-link` / `DELETE /api/teams/:id/invite-link` — Admin only; turn the shareable invite link on (mint + 1-week expiry) / off (see "Shareable invite link").
- `GET /api/teams/invite-link/:token` — resolve a join token to its team; the one open (guest-readable) team endpoint.
- `POST /api/teams/invite-link/:token/join` — signed-in; join via the link.

Wire DTOs (`Team`, `TeamListItem`, `TeamMember`, `TeamRole`) live in `@livediagram/api-schema`.

## Explorer UI

In the Explorer sidebar, a **Teams** section sits under the Folders section (above Library):

- One row per team the user has joined; selecting it shows the team in the right pane.
- A "New team" affordance opens a create modal (name + organisation); submitting creates the team with the user as Admin.
- An **Invites** row directly under "New team", carrying a count badge when invites are pending. Selecting it shows each pending invite as a card (team name, organisation, joined-member count) with **Accept** and **Decline** actions. Accepting selects the newly joined team; declining removes the card.

The right-pane team view is **one calm card**, not a stack of panels:

- A header line with the organisation and member count, plus an overflow (⋯) menu holding the rare actions: Edit team and Delete team (admins), Leave team (any member who isn't the last Admin).
- The member list: a deterministic-colour avatar per row, the person's **name** as the primary line — the caller's own row shows their account display name with a small "you" chip (never a bare "You"), other rows show their resolved display name or the invite email's local part prettified ("anna.smith" → "Anna Smith") — and the member's **email address** on a muted secondary line beneath the name (truncated for long addresses so the row stays tidy on mobile). Pending rows carry an amber **"Invited"** pill next to the name and render their avatar dimmed.
- Roles: admins get a quiet inline role select per row; non-admins see a read-only role pill. Remove actions appear on row hover only.
- **The last-admin rule shapes the affordances, not just the server**: the only Admin sees no Leave item, no remove control on their row, and a pinned "Admin" pill (with an explanatory tooltip) instead of a role select. The server's `409 last_admin` remains as the backstop for stale UIs.
- Admins also get a slim invite-by-email footer row. Placeholder copy: "Add your team by email address, they will receive an invite." (The invite lands in their in-app Invites section; no transactional email until Resend ships.)

The pane title row reads "Recent Diagrams" for the recent section (renamed from "Recent" in the same change as this spec).

## Telemetry

New category `Team` (spec/22). Events: `Team/Created`, `Team/Deleted`, `Team/Changed` (edit name/organisation), `Team/Changed/Role` (role change), `Team/Added/Member` (invite), `Team/Joined` (invite accepted), `Team/Removed/Invite` (invite declined), `Team/Removed/Member` (admin removes someone), `Team/Removed/Self` (leave). No `type` value carries user content.

## Out of scope (v1)

- Sharing diagrams with a team / team workspaces.
- Invite emails (Resend) and invite accept/decline; invites are immediate memberships.
- Team avatars, descriptions beyond the organisation line.
- Looking up whether an invited email already has an account (needs the Clerk Management API).
