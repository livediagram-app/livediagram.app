# Teams

Groups of signed-in people. Teams belong to the liveworkspace account, not to livedocuments: a team is the same in every liveworkspace app, and it is made, renamed, deleted and staffed on liveworkspace.app ([liveworkspace/docs/accounts.md](../../../../liveworkspace/docs/accounts.md) "Teams"). livedocuments keeps no copy of them. An account's teams come from its access token's `teams` claim, and a team made or joined since the token was minted is asked of accounts (`createTeamAccess` in `@liveworkspace/index-app`). The Explorer lists them, each with its shared library on the index ([Team Shared Documents](team-shared-documents.md)).

## Why

One team across every app means someone sets a team up once, on liveworkspace.app, and finds it in each app they use.

## Identity: signed-in only

Teams are keyed by account user ids, so the whole feature requires a verified signed-in session:

- Every `/api/teams*` endpoint requires a verified account access token or API token. A guest gets `401 sign_in_required`. This does NOT violate [Auth + guest access](../014-identity/auth-and-guest-access.md)'s no-sign-in-wall rule: the canvas and everything else stays guest-accessible; only the Teams surface asks for an account.
- In the Explorer sidebar, guests see the sign-in nudge ("Sign in to access Teams") at the end of the Spaces group instead of team rows ([Explorer structure](explorer-structure.md)). Deployments without sign-in ([Open source + distribution](../002-project-scope/open-source-and-business-model.md)) show neither.

## Roles

Two roles, `admin` and `member`, set on liveworkspace.app. In livedocuments the role decides nothing beyond what liveworkspace already enforces: every joined member can read the team, work in its library, mention and assign teammates.

## API

All under `/api/teams`, handled by `apps/api/src/routes/teams.ts`:

- `GET /api/teams` — the teams the caller's token names, each with `myRole`.
- `POST /api/teams` `{ name, organisation? }` — makes a team ([Making a team](#making-a-team)). A signed-in session only.
- `GET /api/teams/invites` — the invitations waiting for the caller on liveworkspace.app ([Invitations](#invitations)).
- `GET /api/teams/:id/library` — the team's folders and documents, from the index ([Team Shared Documents](team-shared-documents.md)).
- `GET /api/teams/:id/members` — the team's joined and invited people, for the assignee picker and @-mentions ([Assigned actions](../012-collaboration/assigned-actions.md), [Comment mentions](../012-collaboration/comment-mentions.md)). Never for an API token.

Administering a team (rename, delete, invite, change a role, remove, leave) happens on liveworkspace.app; livedocuments has no route for it. Wire DTOs (`TeamListItem`, `TeamMember`, `TeamRole`, `TeamInvite`) live in `@livedocuments/api-schema`.

## Making a team

The **New Team** tile in the Move dialog makes a team without leaving livedocuments, and files the document being moved into it. `POST /api/teams` (`apps/api/src/routes/team-create.ts`) asks liveworkspace to make it for the person signed in, vouching for them with the access token they sent (`createTeamFor` in `@liveworkspace/auth-client`); they become its admin. It is usable on the very next request: a team the caller's token does not name yet is asked of accounts. It is the same team on liveworkspace.app and in every app, and managed there.

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

Category `Team` ([Telemetry + public transparency dashboard](../017-telemetry/telemetry.md)). Moving documents in and out of a team sends `Team/Added/Document`. Making, editing and deleting teams, invites and roles happen on liveworkspace.app and are counted there.

## Out of scope

- Administering a team inside livedocuments, beyond making one.
- Team avatars and descriptions.
