# Teams

Groups of signed-in people. Teams belong to the liveworkspace account, not to livediagram: a team is the same in every liveworkspace app, and it is made, renamed, deleted and staffed on liveworkspace.app ([liveworkspace/docs/accounts.md](../../../../liveworkspace/docs/accounts.md) "Teams"). livediagram keeps a copy of the teams its people are in, shows them, and gives each a shared library of documents ([Team Shared Documents](team-shared-documents.md)).

## Why

Multi-user team permissions have been "still ahead" since [Build phase](../005-project-roadmap/prototype-scope.md). One team across every app means someone sets a team up once, on liveworkspace.app, and finds it in each app they use.

## Data model

Two D1 tables, owned by the api worker, are a **mirror** of liveworkspace's teams. Nothing in livediagram writes them except the sync below.

- **`teams`**: `id` (the liveworkspace team id), `name`, `organisation` (always null now; liveworkspace teams have a name only), `created_at`, `updated_at`.
- **`team_members`**: `id` (the liveworkspace member row id), `team_id`, `user_id`, `email`, `role` (`'admin' | 'member'`), `status` (always `'joined'`), `created_at`, `updated_at`. Only joined members are mirrored: invitations live and are answered on liveworkspace.app.
- **`team_sync_state`**: one row holding the change-feed cursor and when it last ran.

Documents and folders a team holds are livediagram's own, tagged with the team's id.

## Keeping the mirror

The api worker follows liveworkspace's team change feed (`GET /api/account/internal/teams/changes`, client-credentials) in `apps/api/src/db/team-sync.ts`:

- **Every five minutes** (the `*/5 * * * *` cron), and **at once** when a caller's access token or API token carries a `teams` claim that differs from what this isolate last saw for them (`catchUpTeams`). The steady-state cost of that check is one Map lookup per request.
- One run per isolate at a time: a caller arriving mid-run waits for it. That run may have read the feed before the caller's change was on it (they made or joined a team a moment ago), so when the mirror still differs from the claim afterwards, `catchUpTeams` reads the feed once more. At most two runs per new claim, so a claim the feed never matches costs no more than that.
- A page of changes applies teams first, then members, then saves the cursor; at most 20 pages a run.
- A deleted team goes through `deleteTeam`: its documents go back to whoever made them and its folders are dropped.
- A member who joined is upserted (only if the team exists). A member who left, was removed or whose team went has their team work handed to an heir (`handTeamWorkToHeir`), is put out of the team's live rooms (`closeMemberTeamSessions`), and the row goes.
- If liveworkspace can't be reached, the mirror stays as it was and the next run catches up. Changes show within five minutes at worst.

## Identity: signed-in only

Teams are keyed by account user ids, so the whole feature requires a verified signed-in session:

- Every `/api/teams*` endpoint requires a verified account access token or API token. The guest `X-Owner-Id` path gets `401 sign_in_required`. This does NOT violate [Auth + guest access](../014-identity/auth-and-guest-access.md)'s no-sign-in-wall rule: the canvas and everything else stays guest-accessible; only the Teams surface asks for an account.
- In the Explorer sidebar, guests see the sign-in nudge ("Sign in to access Teams") at the end of the Spaces group instead of team rows ([Explorer structure](explorer-structure.md)). Deployments without sign-in ([Open source + distribution](../002-project-scope/open-source-and-business-model.md)) show neither.

## Roles

Two roles, `admin` and `member`, set on liveworkspace.app. In livediagram the role decides nothing beyond what liveworkspace already enforces: every joined member can read the team, work in its library, mention and assign teammates. Admins see a **Manage on liveworkspace.app** link on the team page.

Share roles (Editor / Participant / Viewer) do not apply here: the team page is reached from the Explorer by signed-in members, never from inside a shared document's session.

## API

All under `/api/teams`, account Bearer or API token required, handled by `apps/api/src/routes/teams.ts`:

- `GET /api/teams` — teams the caller has joined, each with `myRole` and `memberCount`.
- `GET /api/teams/invites` — the invitations waiting for the caller on liveworkspace.app ([Invitations](#invitations)).
- `GET /api/teams/:id` — team + member list + `myRole` (`inviteLink` is always null). Members only.
- `GET /api/teams/:id/library` — the team's folders and documents ([Team Shared Documents](team-shared-documents.md)).
- `GET /api/teams/:id/access-check`, `POST /api/teams/:id/notify-action`, `POST /api/teams/:id/notify-mention` — as [Assigned actions](../012-collaboration/assigned-actions.md) and [Comment mentions](../012-collaboration/comment-mentions.md) describe; the two notices need a signed-in session.
- Every route that used to administer a team (create, rename, delete, invite, change a role, remove, the invite link, accept, decline) answers **`410 { error: 'teams_moved', manageAt }`**, where `manageAt` is liveworkspace.app's teams page.

Wire DTOs (`Team`, `TeamListItem`, `TeamMember`, `TeamRole`, `TeamInvite`) live in `@livediagram/api-schema`.

## Invitations

Invitations are made, reminded, expired and answered on liveworkspace.app ([liveworkspace/docs/accounts.md](../../../../liveworkspace/docs/accounts.md) "Invitations"); livediagram shows the ones waiting for the person signed in, so they hear of an invitation where they work.

- `GET /api/teams/invites` (`apps/api/src/routes/team-invites.ts`) reads them from liveworkspace (`pendingInvitationsFor` in `@liveworkspace/auth-client`, `POST /api/account/internal/invitations`): each with the team's name, organisation and joined-member count, the role offered, who invited them and when (`TeamInvite` in `@livediagram/api-schema`). An account with no verified address has none.
- The answer is remembered per isolate for 30 seconds, and calls for the same account at once share one request, so the Explorer's load (one `GET /api/teams/invites`, beside `GET /api/teams`) costs at most one call to liveworkspace. An invitation answered on liveworkspace.app leaves the list within that.
- Without accounts configured, or with liveworkspace out of reach, the list is empty rather than an error.
- The Explorer's **Invites** view lists them, newest first, each with **Answer on liveworkspace.app**, which opens `/account/teams#invitations` there. The sidebar's Invites row shows while any wait, with their count as its badge. Once accepted, the team reaches the mirror through the token's claim or the feed ([Keeping the mirror](#keeping-the-mirror)) and shows in the sidebar.

## Explorer UI

In the Explorer sidebar, each team is a root-level folder row in the **Spaces** group, after **My Work**: the two kinds of space read as the same noun ([Explorer structure](explorer-structure.md)).

- One row per team the user has joined; selecting it shows the team in the right pane, and it expands to the team's folders.
- **Manage Teams**, the group's last row (signed-in only), opens liveworkspace.app's teams page. A guest sees the sign-in nudge in its place.
- **Invites** (`/explorer/invites`), in the Spaces group with a count badge while any invitation waits: the invitations, each linking to liveworkspace.app to answer it ([Invitations](#invitations)).
- `/join` and `/join/decline` (old links from invitation emails) say teams are run on liveworkspace.app and link there.

The right-pane team view is **one calm card**:

- A header line with the member count ("You're an admin" for admins), and for admins **Manage on liveworkspace.app** with the Roles and Invites help link.
- The member list: a deterministic-colour avatar per row, the person's **name** as the primary line — the caller's own row shows their account display name with a small "you" chip, other rows show their name or the email's local part prettified ("anna.smith" → "Anna Smith") — the **email address** on a muted secondary line, and a read-only role pill.
- The team's shared library and timeline below.

## Telemetry

Category `Team` ([Telemetry + public transparency dashboard](../017-telemetry/telemetry.md)). Moving documents in and out of a team sends `Team/Added/Document`, `Team/Moved/Document` and `Team/Removed/Document`. Creating, editing and deleting teams, invites and roles happen on liveworkspace.app and are not counted here.

## Out of scope

- Administering a team inside livediagram.
- Team avatars and descriptions.
