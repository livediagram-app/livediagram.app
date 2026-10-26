# Teams

Groups of signed-in people. Teams belong to the liveworkspace account, not to livedesign: a team is the same in every liveworkspace app, and it is made, renamed, deleted and staffed in the Explorer, on `livedesign.app/explorer`, on liveworkspace.app and in the editor's Explorer panel ([liveworkspace/docs/specs/004-index/one-explorer.md](../../../../liveworkspace/docs/specs/004-index/one-explorer.md) "Teams are run in the Explorer", which holds the journeys). livedesign keeps no copy of them: it shows the teams its people are in and gives each a shared library of designs ([Team Shared Designs](team-shared-designs.md)).

## Why

Multi-user team permissions have been "still ahead" since [Build phase](../005-project-roadmap/prototype-scope.md). One team across every app means someone sets a team up once, in the Explorer, and finds it in each app they use.

## Where teams come from

livedesign keeps no table of teams. An account's teams come from its access token's `teams` claim, and from
liveworkspace for a team made or joined since the token was minted (`createTeamAccess` in
`@liveworkspace/index-app`). A team's people, for the assignee picker and @-mentions, are asked of liveworkspace
when needed. Designs and folders a team holds are the index's, in the team's own tree
([Team Shared Designs](team-shared-designs.md)).

## Identity: signed-in only

Teams are keyed by account user ids, so the whole feature requires a verified signed-in session:

- Every `/api/teams*` endpoint requires a verified account access token or API token. A guest token gets `401 sign_in_required`. This does NOT violate [Auth + guest access](../014-identity/auth-and-guest-access.md)'s no-sign-in-wall rule: the canvas and everything else stays guest-accessible; only the Teams surface asks for an account.
- In the Explorer sidebar, guests see the sign-in nudge ("Sign in to access Teams") at the end of the Spaces group instead of team rows ([Explorer structure](explorer-structure.md)). Deployments without sign-in ([Open source + distribution](../002-project-scope/open-source-and-business-model.md)) show neither.

## Roles

Two roles, `admin` and `member`, set on the team's card in the Explorer. In livedesign the role decides nothing beyond what liveworkspace already enforces: every joined member can read the team, work in its library, mention and assign teammates.

Share roles (Editor / Participant / Viewer) do not apply here: the team page is reached from the Explorer by signed-in members, never from inside a shared design's session.

## API

All under `/api/teams`, account Bearer or API token required, handled by `apps/api/src/routes/teams.ts`:

- `GET /api/teams` — teams the caller has joined, from their token's `teams` claim, each with `myRole` (`memberCount` is always 0; the people are `/members`'s).
- `POST /api/teams` `{ name, organisation? }` — makes a team ([Making a team](#making-a-team)). A signed-in session only.
- `GET /api/teams/invites` — the invitations waiting for the caller on liveworkspace.app ([Invitations](#invitations)).
- `GET /api/teams/:id/members` — the team's joined and invited people, asked of liveworkspace, for the assignee picker and @-mentions. Members only, and never an API token; a team the caller is not in is `404 team_not_found`.
- `GET /api/teams/:id/library` — the team's folders and designs, read from the index ([Team Shared Designs](team-shared-designs.md)). Members only.
- The assignment and mention emails are the design's, not the team's: `POST /api/designs/:id/notify-action`, and mentions from the comment post and tab save, as [Assigned actions](../012-collaboration/assigned-actions.md) and [Comment mentions](../012-collaboration/comment-mentions.md) describe.
- Administering a team (rename, delete, invite, change a role, remove, an invite link, accept, decline) happens in the Explorer, against liveworkspace's account API through the router's `/api/workspace/account/…`; this API has no routes for it.

Wire DTOs (`Team`, `TeamListItem`, `TeamMember`, `TeamRole`, `TeamInvite`) live in `@livedesign/api-schema`.

## Making a team

API clients make a team with `POST /api/teams` (`apps/api/src/routes/team-create.ts`) asks liveworkspace to make it for the person signed in, vouching for them with the access token they sent (`createTeamFor` in `@liveworkspace/auth-client`, `POST /api/account/internal/teams`); they become its admin. It is usable on the very next request: a team the caller's token does not name yet is asked of accounts. It is the same team in every app, and run in the Explorer. The Explorer itself (the page, and the editor's panel through its `teamsHost`, `../packages/workbench/src/lib/explorer-teams-host.ts`) makes teams with liveworkspace's account API directly: New Team under Spaces, and the Move dialog's New Team tile, to a signed-in person, never a guest; a made team joins the panel's rail at once, before their token names it.

- The name is trimmed and cut at 80 characters, as liveworkspace cuts it; an empty one is `400 name_required`. The organisation, likewise, or null.
- An API token or a workbench can't make one: `401 sign_in_required` without a signed-in session and its access token.
- liveworkspace's refusal is passed on (`409 team_limit_reached` at 50 teams), and nothing is mirrored. Without accounts configured, or with liveworkspace out of reach, it is `503`.

## Invitations

Invitations are made, reminded and expired by liveworkspace ([liveworkspace/docs/specs/003-accounts/accounts.md](../../../../liveworkspace/docs/specs/003-accounts/accounts.md) "Invitations"), and answered in the Explorer, so people hear of an invitation where they work.

- `GET /api/teams/invites` (`apps/api/src/routes/team-invites.ts`) reads them from liveworkspace (`pendingInvitationsFor` in `@liveworkspace/auth-client`, `POST /api/account/internal/invitations`): each with the team's name, organisation and joined-member count, the role offered, who invited them and when (`TeamInvite` in `@livedesign/api-schema`). An account with no verified address has none.
- The answer is remembered per isolate for 30 seconds, and calls for the same account at once share one request, so the Explorer's load (one `GET /api/teams/invites`, beside `GET /api/teams`) costs at most one call to liveworkspace. An invitation answered in the Explorer leaves this list within that.
- Without accounts configured, or with liveworkspace out of reach, the list is empty rather than an error.
- The Explorer's **Invites** view lists them, newest first, each with **Accept** (which opens the team) and **Decline**. The sidebar's Invites row shows while any wait, with their count as its badge. Once accepted, the team reaches livedesign through the next token's claim, or is asked of liveworkspace before then ([Where teams come from](#where-teams-come-from)), and shows in the sidebar at once.

## Explorer UI

The shared Explorer's ([packages/explorer/README.md](../../../../packages/explorer/README.md) "Teams"). In the sidebar, each team is a root-level row in the **Spaces** group, after **My Work**: the two kinds of space read as the same noun ([Explorer structure](explorer-structure.md)).

- One row per team the person has joined; selecting it shows the team's card over its library, and it expands to the team's folders.
- **New Team**, the group's last row (signed-in only), opens the team dialog (name, optional organisation) and opens the team made. A guest sees the sign-in nudge in its place.
- **Invites** (`/explorer/invites`), in the Spaces group with a count badge while any invitation waits: the invitations, each with Accept and Decline ([Invitations](#invitations)).
- `/join` and `/join/decline` (old links from livedesign's own invitation emails) say teams are run in the Explorer and link to its Invites.

The right-pane team view is **one calm card**, which runs the team in place:

- A header line with the organisation, the joined members and the invitations waiting; for admins **Invite by Link**; and the ⋯ menu: Edit Team and Delete Team (admins), Leave Team (anyone but the only admin while others remain).
- The member list: an avatar per row, the person's **name** as the primary line — the caller's own row with a small "you" chip, other rows their name or the email's local part prettified ("anna.smith" → "Anna Smith") — the **email address** on a muted secondary line, Invited, Declined or Expired where it applies, and the role: a select for admins (the only admin's own row pinned), a pill otherwise, with an × for admins to remove, withdraw or clear.
- For admins, an invite footer: an address and Member or Admin.
- The team's shared library below.

In the editor's Explorer panel the team's pane opens the same card from its **Members** button, and the rail has New Team under Spaces.

## Telemetry

Category `Team` ([Telemetry + public transparency dashboard](../017-telemetry/telemetry.md)). Making a team is counted as `Team/Created` by liveworkspace's accounts Worker. Moving designs in and out of a team sends `Team/Added/Design`, `Team/Moved/Design` and `Team/Removed/Design`. Editing and deleting teams, invites and roles are counted by the accounts Worker too, under the app the person signed up through.

## Out of scope

- Team avatars and descriptions.
