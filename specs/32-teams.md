# 32 — Teams

Groups of signed-in users, managed from the Explorer page. v1 is membership only: a team is a named group with roles. Sharing diagrams with a team (the payoff) is a follow-up spec built on top of this one.

## Why

Multi-user team permissions have been "still ahead" since spec/02. This is the foundational slice: who is in a team, and who may manage it.

## Data model

Two D1 tables, owned by the api worker (migration `0019_teams.sql`):

- **`teams`**: `id`, `name`, `organisation` (free text, nullable), `created_at`, `updated_at`. No owner column: ownership is expressed through the Admin role in the link table, so a team survives its creator leaving.
- **`team_members`** (the link table): `id`, `team_id`, `user_id` (nullable), `email` (nullable), `role` (`'admin' | 'member'`), `created_at`, `updated_at`.
  - `user_id` is a Clerk user id. Null on a pending invite that hasn't connected yet.
  - `email` is the lowercased invite address. Unique per team. May be null only on the creator's row when the deployment's JWT carries no email claim.
  - One of `user_id` / `email` is always set.

## Identity: signed-in only

Teams are keyed by Clerk user ids and invites are keyed by email, so the whole feature requires a verified Clerk session:

- Every `/api/teams*` endpoint requires a verified Clerk Bearer token. The guest `X-Owner-Id` path gets `401 sign_in_required`. This does NOT violate spec/04's no-sign-in-wall rule: the canvas and everything else stays guest-accessible; only the Teams surface asks for an account.
- In the Explorer, guests see the Teams section with a "sign in to use teams" link instead of team rows. Clerk-disabled self-host deployments (spec/03) hide the section entirely.

### Email claim

Connect-on-signup needs the user's email **server-side and verified**. The worker reads an optional `email` claim from the verified Clerk JWT (`apps/api/src/auth/clerk.ts`); it never trusts a client-supplied email. The hosted deployment's Clerk JWT template must include `"email": "{{user.primary_email_address}}"`. When the claim is absent (default Clerk token, or self-host that hasn't configured it) everything still works except invite auto-connection, and the creator's member row stores no email.

## Invites and connect-on-sign-in

- An Admin invites by email address. That immediately creates a `team_members` row: `role = 'member'`, `email = <lowercased address>`, `user_id = NULL`. **No email is sent in v1** (Resend hasn't shipped); the inviter tells the person out of band. A pending invite renders as the email with an "Invited" badge.
- **Lazy claim**: on every authenticated `GET /api/teams`, the worker first connects pending invites: `UPDATE team_members SET user_id = <sub> WHERE email = <jwt email> AND user_id IS NULL`. So an invitee sees the team the first time they open the Explorer signed in with that address, whether they signed up before or after the invite.
- Duplicate invite of an email already on the team: `409 conflict`.

## Roles and permissions

Two roles: `admin`, `member`. The creating user becomes the team's first Admin.

| Action                             | Admin | Member |
| ---------------------------------- | ----- | ------ |
| See team + member list             | ✓     | ✓      |
| Invite by email                    | ✓     |        |
| Change a member's role             | ✓     |        |
| Edit team (name, organisation)     | ✓     |        |
| Remove a member / cancel an invite | ✓     |        |
| Leave the team (remove own row)    | ✓\*   | ✓      |
| Delete the team                    | ✓     |        |

\* **Last-admin guard**: the last remaining Admin cannot be demoted, removed, or leave; the server rejects with `409 last_admin`. Promote someone else first, or delete the team. Deleting the team removes all member rows.

## API

All under `/api/teams`, Clerk Bearer required, handled by `apps/api/src/routes/teams.ts`:

- `GET /api/teams` — lazy-claims invites (above), then lists teams the caller belongs to, each with `myRole` and `memberCount`.
- `POST /api/teams` `{id, name, organisation?}` — creates the team plus the caller's Admin member row.
- `GET /api/teams/:id` — team + full member list + `myRole`. Members only.
- `PUT /api/teams/:id` `{name?, organisation?}` — Admin only.
- `DELETE /api/teams/:id` — Admin only; deletes member rows too.
- `POST /api/teams/:id/members` `{email}` — Admin only; creates the pending invite row.
- `PUT /api/teams/:id/members/:memberId` `{role}` — Admin only; last-admin guard.
- `DELETE /api/teams/:id/members/:memberId` — Admin, or the member's own row (leave); last-admin guard.

Wire DTOs (`Team`, `TeamListItem`, `TeamMember`, `TeamRole`) live in `@livediagram/api-schema`.

## Explorer UI

In the Explorer sidebar, a **Teams** section sits under the Folders section (above Library):

- One row per team the user is in; selecting it shows the team in the right pane.
- A "New team" affordance opens a create modal (name + organisation); submitting creates the team with the user as Admin.
- The right-pane team view shows the organisation line and the member list (name = email, "You" on the caller's row, "Invited" badge while pending). Admins additionally get: the invite-by-email field, a role select per member, remove-member actions, Edit team, and Delete team (confirm dialog). Non-admins get Leave team.

The pane title row reads "Recent Diagrams" for the recent section (renamed from "Recent" in the same change as this spec).

## Telemetry

New category `Team` (spec/22). Events: `Team/Created`, `Team/Deleted`, `Team/Changed` (edit name/organisation), `Team/Changed/Role` (role change), `Team/Added/Member` (invite), `Team/Removed/Member` (admin removes someone), `Team/Removed/Self` (leave). No `type` value carries user content.

## Out of scope (v1)

- Sharing diagrams with a team / team workspaces.
- Invite emails (Resend) and invite accept/decline; invites are immediate memberships.
- Team avatars, descriptions beyond the organisation line.
- Looking up whether an invited email already has an account (needs the Clerk Management API).
