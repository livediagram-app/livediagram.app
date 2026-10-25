# Teams

Groups of signed-in people. Teams belong to the liveworkspace account, not to livedocuments: a team is the same in every liveworkspace app, and it is made, renamed, deleted and staffed in the Explorer, on `livedocuments.app/explorer`, on liveworkspace.app and in the editor's Explorer panel ([liveworkspace/docs/one-explorer.md](../../../../liveworkspace/docs/one-explorer.md) "Teams are run in the Explorer", which holds the journeys). livedocuments keeps no copy of them. An account's teams come from its access token's `teams` claim, and a team made or joined since the token was minted is asked of accounts (`createTeamAccess` in `@liveworkspace/index-app`). The Explorer lists them, each with its shared library on the index ([Team Shared Documents](team-shared-documents.md)).

## Why

One team across every app means someone sets a team up once, in the Explorer, and finds it in each app they use.

## Identity: signed-in only

Teams are keyed by account user ids, so the whole feature requires a verified signed-in session:

- Every `/api/teams*` endpoint requires a verified account access token or API token. A guest gets `401 sign_in_required`. This does NOT violate [Auth + guest access](../014-identity/auth-and-guest-access.md)'s no-sign-in-wall rule: the canvas and everything else stays guest-accessible; only the Teams surface asks for an account.
- In the Explorer sidebar, guests see the sign-in nudge ("Sign in to access Teams") at the end of the Spaces group instead of team rows ([Explorer structure](explorer-structure.md)). Deployments without sign-in ([Open source + distribution](../002-project-scope/open-source-and-business-model.md)) show neither.

## Roles

Two roles, `admin` and `member`, set on the team's card in the Explorer. In livedocuments the role decides nothing beyond what liveworkspace already enforces: every joined member can read the team, work in its library, mention and assign teammates.

## API

All under `/api/teams`, handled by `apps/api/src/routes/teams.ts`:

- `GET /api/teams` — the teams the caller's token names, each with `myRole`.
- `POST /api/teams` `{ name, organisation? }` — makes a team ([Making a team](#making-a-team)). A signed-in session only.
- `GET /api/teams/invites` — the invitations waiting for the caller on liveworkspace.app ([Invitations](#invitations)).
- `GET /api/teams/:id/library` — the team's folders and documents, from the index ([Team Shared Documents](team-shared-documents.md)).
- `GET /api/teams/:id/members` — the team's joined and invited people, for the assignee picker and @-mentions ([Assigned actions](../012-collaboration/assigned-actions.md), [Comment mentions](../012-collaboration/comment-mentions.md)). Never for an API token.

Administering a team (rename, delete, invite, change a role, remove, leave) happens in the Explorer, against liveworkspace's account API through the router's `/api/workspace/account/…`; livedocuments' API has no route for it. Wire DTOs (`TeamListItem`, `TeamMember`, `TeamRole`, `TeamInvite`) live in `@livedocuments/api-schema`.

## Making a team

API clients make a team with `POST /api/teams` (`apps/api/src/routes/team-create.ts`) asks liveworkspace to make it for the person signed in, vouching for them with the access token they sent (`createTeamFor` in `@liveworkspace/auth-client`); they become its admin. It is usable on the very next request: a team the caller's token does not name yet is asked of accounts. It is the same team in every app, and run in the Explorer. The Explorer itself (the page, and the editor's panel through its `teamsHost`, `../packages/workbench/src/lib/explorer-teams-host.ts`) makes teams with liveworkspace's account API directly: New Team under Spaces, and the Move dialog's New Team tile, to a signed-in person, never a guest; a made team joins the panel's rail at once, before their token names it.

- The name is trimmed and cut at 80 characters, as liveworkspace cuts it; an empty one is `400 name_required`. The organisation, likewise, or null.
- An API token or a workbench can't make one: `401 sign_in_required` without a signed-in session and its access token.
- liveworkspace's refusal is passed on (`409 team_limit_reached` at 50 teams). Without accounts configured, or with liveworkspace out of reach, it is `503`.

## Invitations

Invitations are made, reminded and expired by liveworkspace ([liveworkspace/docs/accounts.md](../../../../liveworkspace/docs/accounts.md) "Invitations"), and answered in the Explorer, so people hear of an invitation where they work.

- The Explorer's **Invites** view lists them, newest first: the team's name, organisation and joined-member count, the role offered, who invited them and when, each with **Accept** (which opens the team) and **Decline**. The sidebar's Invites row shows while any wait, with their count as its badge.
- `GET /api/teams/invites` (`apps/api/src/routes/team-invites.ts`) answers the same list for API clients, read from liveworkspace (`pendingInvitationsFor` in `@liveworkspace/auth-client`), remembered per isolate for 30 seconds, so a burst of calls costs at most one call to liveworkspace. Without accounts configured, or with liveworkspace out of reach, the list is empty rather than an error.
- Old invitation emails' links still land: `/explorer/invites` is the Invites view again, and `/join` and `/join/decline` (livedocuments' own, from before teams moved) say teams are run in the Explorer and link to its Invites.

## Explorer UI

The shared Explorer's ([packages/explorer/README.md](../../../../packages/explorer/README.md) "Teams"). In the sidebar, each team is a root-level row in the **Spaces** group, after **My Work**: the two kinds of space read as the same noun ([Explorer structure](explorer-structure.md)).

- One row per team the person has joined; selecting it shows the team's card over its library, and it expands to the team's folders.
- **New Team**, the group's last row (signed-in only), opens the team dialog (name, optional organisation) and opens the team made. A guest sees the sign-in nudge in its place.
- **Invites**, in the Spaces group with a count badge while any invitation waits ([Invitations](#invitations)).
- The **team card** runs the team in place: members and roles, invite by email or by link, remove, Edit Team, Leave Team and Delete Team, by role. In the editor's Explorer panel the team's pane opens the same card from its **Members** button, and the rail has New Team under Spaces.

## Telemetry

Category `Team` ([Telemetry + public transparency dashboard](../017-telemetry/telemetry.md)). Moving documents in and out of a team sends `Team/Added/Document`. Making, editing and deleting teams, invites and roles are counted by liveworkspace's accounts Worker, under the app the person signed up through.

## Out of scope

- Team avatars and descriptions.
