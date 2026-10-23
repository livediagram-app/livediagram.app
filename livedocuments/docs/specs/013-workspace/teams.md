# Teams

Groups of signed-in people. Teams belong to the liveworkspace account, not to livedocuments: a team is the same in every liveworkspace app, and it is made, renamed, deleted and staffed on liveworkspace.app ([liveworkspace/docs/accounts.md](../../../../liveworkspace/docs/accounts.md) "Teams"). livedocuments keeps a copy of the teams its people are in, shows them, and gives each a shared library of documents ([Team Shared Documents](team-shared-documents.md)).

## Why

Multi-user team permissions have been "still ahead" since [Build phase](../005-project-roadmap/prototype-scope.md). One team across every app means someone sets a team up once, on liveworkspace.app, and finds it in each app they use.

## Data model

Two D1 tables, owned by the api worker, are a **mirror** of liveworkspace's teams. Nothing in livedocuments writes them except the sync below, and a team made from livedocuments going in at once ([Making a team](#making-a-team)).

- **`teams`**: `id` (the liveworkspace team id), `name`, `organisation` (always null now; liveworkspace teams have a name only), `created_at`, `updated_at`.
- **`team_members`**: `id` (the liveworkspace member row id), `team_id`, `user_id`, `email`, `role` (`'admin' | 'member'`), `status` (always `'joined'`), `created_at`, `updated_at`. Only joined members are mirrored: invitations live and are answered on liveworkspace.app.
- **`team_sync_state`**: one row holding the change-feed cursor and when it last ran.

Documents and folders a team holds are livedocuments's own, tagged with the team's id.

## Keeping the mirror

The api worker follows liveworkspace's team change feed (`GET /api/account/internal/teams/changes`, client-credentials) in `apps/api/src/db/team-sync.ts`:

- **Every five minutes** (the `*/5 * * * *` cron), and **at once** when a caller's access token or API token carries a `teams` claim that differs from what this isolate last saw for them (`catchUpTeams`). The steady-state cost of that check is one Map lookup per request.
- A page of changes applies teams first, then members, then saves the cursor; at most 20 pages a run.
- A deleted team goes through `deleteTeam`: its documents go back to whoever made them and its folders are dropped.
- A member who joined is upserted (only if the team exists). A member who left, was removed or whose team went has their team work handed to an heir (`handTeamWorkToHeir`), is put out of the team's live rooms (`closeMemberTeamSessions`), and the row goes.
- If liveworkspace can't be reached, the mirror stays as it was and the next run catches up. Changes show within five minutes at worst.

## Identity: signed-in only

Teams are keyed by account user ids, so the whole feature requires a verified signed-in session:

- Every `/api/teams*` endpoint requires a verified account access token or API token. The guest `X-Owner-Id` path gets `401 sign_in_required`. This does NOT violate [Auth + guest access](../014-identity/auth-and-guest-access.md)'s no-sign-in-wall rule: the canvas and everything else stays guest-accessible; only the Teams surface asks for an account.
- In the Explorer sidebar, guests see the sign-in nudge ("Sign in to access Teams") at the end of the Spaces group instead of team rows ([Explorer structure](explorer-structure.md)). Deployments without sign-in ([Open source + distribution](../002-project-scope/open-source-and-business-model.md)) show neither.

## Roles

Two roles, `admin` and `member`, set on liveworkspace.app. In livedocuments the role decides nothing beyond what liveworkspace already enforces: every joined member can read the team, work in its library, mention and assign teammates. Admins see a **Manage on liveworkspace.app** link on the team page.

Share roles (Editor / Participant / Viewer) do not apply here: the team page is reached from the Explorer by signed-in members, never from inside a shared document's session.

## API

All under `/api/teams`, account Bearer or API token required, handled by `apps/api/src/routes/teams.ts`:

- `GET /api/teams` — teams the caller has joined, each with `myRole` and `memberCount`.
- `POST /api/teams` `{ name, organisation? }` — makes a team ([Making a team](#making-a-team)). A signed-in session only.
- `GET /api/teams/invites` — always `[]`: invitations are answered on liveworkspace.app.
- `GET /api/teams/:id` — team + member list + `myRole` (`inviteLink` is always null). Members only.
- `GET /api/teams/:id/library` — the team's folders and documents ([Team Shared Documents](team-shared-documents.md)).
- `GET /api/teams/:id/access-check`, `POST /api/teams/:id/notify-action`, `POST /api/teams/:id/notify-mention` — as [Assigned actions](../012-collaboration/assigned-actions.md) and [Comment mentions](../012-collaboration/comment-mentions.md) describe; the two notices need a signed-in session.
- The routes that would administer a team (rename, delete, invite, change a role, remove, an invite link, accept, decline) answer **`410 { error: 'teams_moved', manageAt }`**, where `manageAt` is liveworkspace.app's teams page.

Wire DTOs (`Team`, `TeamListItem`, `TeamMember`, `TeamRole`) live in `@livedocuments/api-schema`.

## Making a team

The **New Team** tile in the Move dialog makes a team without leaving livedocuments, and files the document being moved into it. `POST /api/teams` (`apps/api/src/routes/team-create.ts`) asks liveworkspace to make it for the person signed in, vouching for them with the access token they sent (`createTeamFor` in `@liveworkspace/auth-client`, `POST /api/account/internal/teams`); they become its admin. The answer goes into the mirror at once (`mirrorCreatedTeam`), with the same ids the change feed brings later, so a document can be filed into the team on the very next request. It is the same team on liveworkspace.app and in every app, and managed there.

- The name is trimmed and cut at 80 characters, as liveworkspace cuts it; an empty one is `400 name_required`. The organisation, likewise, or null.
- An API token or a workbench can't make one: `401 sign_in_required` without a signed-in session and its access token.
- liveworkspace's refusal is passed on (`409 team_limit_reached` at 50 teams), and nothing is mirrored. Without accounts configured, or with liveworkspace out of reach, it is `503`.

## Explorer UI

In the Explorer sidebar, each team is a root-level folder row in the **Spaces** group, after **My Work**: the two kinds of space read as the same noun ([Explorer structure](explorer-structure.md)).

- One row per team the user has joined; selecting it shows the team in the right pane, and it expands to the team's folders.
- **Manage Teams**, the group's last row (signed-in only), opens liveworkspace.app's teams page. A guest sees the sign-in nudge in its place.
- `/explorer/invites`, `/join` and `/join/decline` (old links from invitation emails) say teams are run on liveworkspace.app and link there.

The right-pane team view is **one calm card**:

- A header line with the member count ("You're an admin" for admins), and for admins **Manage on liveworkspace.app** with the Roles and Invites help link.
- The member list: a deterministic-colour avatar per row, the person's **name** as the primary line — the caller's own row shows their account display name with a small "you" chip, other rows show their name or the email's local part prettified ("anna.smith" → "Anna Smith") — the **email address** on a muted secondary line, and a read-only role pill.
- The team's shared library and timeline below.

## Telemetry

Category `Team` ([Telemetry + public transparency dashboard](../017-telemetry/telemetry.md)). Making a team from the New Team tile sends `Team/Created`. Moving documents in and out of a team sends `Team/Added/Document`, `Team/Moved/Document` and `Team/Removed/Document`. Editing and deleting teams, invites and roles happen on liveworkspace.app and are not counted here.

## Out of scope

- Administering a team inside livedocuments, beyond making one.
- Team avatars and descriptions.
