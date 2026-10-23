# Teams

Groups of signed-in people. Teams belong to the liveworkspace account, not to livediagram: a team is the same in every liveworkspace app, and it is made, renamed, deleted and staffed on liveworkspace.app ([liveworkspace/docs/accounts.md](../../../../liveworkspace/docs/accounts.md) "Teams"). livediagram keeps no copy of them. An account's teams come from its access token's `teams` claim, and a team made or joined since the token was minted is asked of accounts (`createTeamAccess` in `@liveworkspace/index-app`). The Explorer lists them, each with its shared library on the index ([Team Shared Documents](team-shared-documents.md)).

## Why

Multi-user team permissions have been "still ahead" since [Build phase](../005-project-roadmap/prototype-scope.md). One team across every app means someone sets a team up once, on liveworkspace.app, and finds it in each app they use.

## Identity: signed-in only

Teams are keyed by account user ids, so the whole feature requires a verified signed-in session:

- Every `/api/teams*` endpoint requires a verified account access token or API token. A guest token gets `401 sign_in_required`. This does NOT violate [Auth + guest access](../014-identity/auth-and-guest-access.md)'s no-sign-in-wall rule: the canvas and everything else stays guest-accessible; only the Teams surface asks for an account.
- In the Explorer sidebar, guests see the sign-in nudge ("Sign in to access Teams") at the end of the Spaces group instead of team rows ([Explorer structure](explorer-structure.md)). Deployments without sign-in ([Open source + distribution](../002-project-scope/open-source-and-business-model.md)) show neither.

## Roles

Two roles, `admin` and `member`, set on liveworkspace.app. In livediagram the role decides nothing beyond what liveworkspace already enforces: every joined member can read the team, work in its library, mention and assign teammates.

Share roles (Editor / Participant / Viewer) do not apply here: a team's view is reached from the Explorer by signed-in members, never from inside a shared canvas's session.

## API

All under `/api/teams`, account Bearer or API token required, handled by `apps/api/src/routes/teams.ts`:

- `GET /api/teams` — teams the caller has joined, each with `myRole` and `memberCount`.
- `POST /api/teams` `{ name, organisation? }` — makes a team ([Making a team](#making-a-team)). A signed-in session only.
- `GET /api/teams/invites` — the invitations waiting for the caller on liveworkspace.app ([Invitations](#invitations)).
- `GET /api/teams/:id` — team + member list + `myRole` (`inviteLink` is always null). Members only.
- `GET /api/teams/:id/library` — the team's folders and documents ([Team Shared Documents](team-shared-documents.md)).
- `GET /api/teams/:id/access-check`, `POST /api/teams/:id/notify-action`, `POST /api/teams/:id/notify-mention` — as [Assigned actions](../012-collaboration/assigned-actions.md) and [Comment mentions](../012-collaboration/comment-mentions.md) describe; the two notices need a signed-in session.
- The routes that would administer a team (rename, delete, invite, change a role, remove, an invite link, accept, decline) answer **`410 { error: 'teams_moved', manageAt }`**, where `manageAt` is liveworkspace.app's teams page.

Wire DTOs (`Team`, `TeamListItem`, `TeamMember`, `TeamRole`, `TeamInvite`) live in `@livediagram/api-schema`.

## Making a team

The **New Team** tile in the Move dialog makes a team without leaving livediagram, and files the document being moved into it. `POST /api/teams` (`apps/api/src/routes/team-create.ts`) asks liveworkspace to make it for the person signed in, vouching for them with the access token they sent (`createTeamFor` in `@liveworkspace/auth-client`, `POST /api/account/internal/teams`); they become its admin. It is usable on the very next request: a team the caller's token does not name yet is asked of accounts. It is the same team on liveworkspace.app and in every app, and managed there.

- The name is trimmed and cut at 80 characters, as liveworkspace cuts it; an empty one is `400 name_required`. The organisation, likewise, or null.
- An API token or a workbench can't make one: `401 sign_in_required` without a signed-in session and its access token.
- liveworkspace's refusal is passed on (`409 team_limit_reached` at 50 teams). Without accounts configured, or with liveworkspace out of reach, it is `503`.

## Invitations

Invitations are made, reminded, expired and answered on liveworkspace.app ([liveworkspace/docs/accounts.md](../../../../liveworkspace/docs/accounts.md) "Invitations"); the Explorer shows the ones waiting for the person signed in, so they hear of an invitation where they work.

- The Explorer's **Invites** view lists them, newest first: the team's name, organisation and joined-member count, the role offered, who invited them and when, each linking to `/account/teams#invitations` on liveworkspace.app to answer it. The sidebar's Invites row shows while any wait, with their count as its badge. Once accepted, the team shows in the sidebar.
- `GET /api/teams/invites` (`apps/api/src/routes/team-invites.ts`) answers the same list for API clients, read from liveworkspace (`pendingInvitationsFor` in `@liveworkspace/auth-client`), remembered per isolate for 30 seconds, so a burst of calls costs at most one call to liveworkspace. Without accounts configured, or with liveworkspace out of reach, the list is empty rather than an error.
- Old invitation emails' links still land: `/explorer/invites` goes on to the invitations on liveworkspace.app, and `/join` and `/join/decline` say teams are run there and link there.

## Explorer UI

In the Explorer sidebar, each team is a root-level folder row in the **Spaces** group, after **My Work**: the two kinds of space read as the same noun ([Explorer structure](explorer-structure.md)).

- One row per team the user has joined; selecting it shows the team in the right pane, and it expands to the team's folders.
- **Manage Teams**, the group's last row (signed-in only), opens liveworkspace.app's teams page. A guest sees the sign-in nudge in its place.
- **Invites**, in the Spaces group with a count badge while any invitation waits ([Invitations](#invitations)).

## Telemetry

Category `Team` ([Telemetry + public transparency dashboard](../017-telemetry/telemetry.md)). Making a canvas straight into a team from `/new` sends `Team/Added/Document`. Making, editing and deleting teams, invites and roles happen on liveworkspace.app and are counted there.

## Out of scope

- Administering a team inside livediagram, beyond making one.
- Team avatars and descriptions.
