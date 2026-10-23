# Teams

Groups of signed-in people. Teams belong to the liveworkspace account, not to livedesign: a team is the same in every liveworkspace app, and it is made, renamed, deleted and staffed on liveworkspace.app ([liveworkspace/docs/accounts.md](../../../../liveworkspace/docs/accounts.md) "Teams"). livedesign keeps no copy of them: it shows the teams its people are in and gives each a shared library of designs ([Team Shared Designs](team-shared-designs.md)).

## Why

Multi-user team permissions have been "still ahead" since [Build phase](../005-project-roadmap/prototype-scope.md). One team across every app means someone sets a team up once, on liveworkspace.app, and finds it in each app they use.

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

Two roles, `admin` and `member`, set on liveworkspace.app. In livedesign the role decides nothing beyond what liveworkspace already enforces: every joined member can read the team, work in its library, mention and assign teammates. Admins see a **Manage on liveworkspace.app** link on the team page.

Share roles (Editor / Participant / Viewer) do not apply here: the team page is reached from the Explorer by signed-in members, never from inside a shared design's session.

## API

All under `/api/teams`, account Bearer or API token required, handled by `apps/api/src/routes/teams.ts`:

- `GET /api/teams` — teams the caller has joined, each with `myRole` and `memberCount`.
- `POST /api/teams` `{ name, organisation? }` — makes a team ([Making a team](#making-a-team)). A signed-in session only.
- `GET /api/teams/invites` — the invitations waiting for the caller on liveworkspace.app ([Invitations](#invitations)).
- `GET /api/teams/:id` — team + member list + `myRole` (`inviteLink` is always null). Members only.
- `GET /api/teams/:id/library` — the team's folders and designs ([Team Shared Designs](team-shared-designs.md)).
- `GET /api/teams/:id/access-check`, `POST /api/teams/:id/notify-action`, `POST /api/teams/:id/notify-mention` — as [Assigned actions](../012-collaboration/assigned-actions.md) and [Comment mentions](../012-collaboration/comment-mentions.md) describe; the two notices need a signed-in session.
- The routes that would administer a team (rename, delete, invite, change a role, remove, an invite link, accept, decline) answer **`410 { error: 'teams_moved', manageAt }`**, where `manageAt` is liveworkspace.app's teams page.

Wire DTOs (`Team`, `TeamListItem`, `TeamMember`, `TeamRole`, `TeamInvite`) live in `@livedesign/api-schema`.

## Making a team

The **New Team** tile in the Move dialog makes a team without leaving livedesign, and files the design being moved into it. `POST /api/teams` (`apps/api/src/routes/team-create.ts`) asks liveworkspace to make it for the person signed in, vouching for them with the access token they sent (`createTeamFor` in `@liveworkspace/auth-client`, `POST /api/account/internal/teams`); they become its admin. It is usable on the very next request: a team the caller's token does not name yet is asked of accounts. It is the same team on liveworkspace.app and in every app, and managed there. The editor's Explorer panel offers it in the shared Explorer's Move dialog (`onCreateTeam`, `apps/live/lib/explorer-new-team.ts`) to a signed-in person, never a guest; the made team joins the panel's rail at once, before their token names it.

- The name is trimmed and cut at 80 characters, as liveworkspace cuts it; an empty one is `400 name_required`. The organisation, likewise, or null.
- An API token or a workbench can't make one: `401 sign_in_required` without a signed-in session and its access token.
- liveworkspace's refusal is passed on (`409 team_limit_reached` at 50 teams), and nothing is mirrored. Without accounts configured, or with liveworkspace out of reach, it is `503`.

## Invitations

Invitations are made, reminded, expired and answered on liveworkspace.app ([liveworkspace/docs/accounts.md](../../../../liveworkspace/docs/accounts.md) "Invitations"); livedesign shows the ones waiting for the person signed in, so they hear of an invitation where they work.

- `GET /api/teams/invites` (`apps/api/src/routes/team-invites.ts`) reads them from liveworkspace (`pendingInvitationsFor` in `@liveworkspace/auth-client`, `POST /api/account/internal/invitations`): each with the team's name, organisation and joined-member count, the role offered, who invited them and when (`TeamInvite` in `@livedesign/api-schema`). An account with no verified address has none.
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

Category `Team` ([Telemetry + public transparency dashboard](../017-telemetry/telemetry.md)). Making a team from the New Team tile sends `Team/Created`. Moving designs in and out of a team sends `Team/Added/Design`, `Team/Moved/Design` and `Team/Removed/Design`. Editing and deleting teams, invites and roles happen on liveworkspace.app and are not counted here.

## Out of scope

- Administering a team inside livedesign, beyond making one.
- Team avatars and descriptions.
