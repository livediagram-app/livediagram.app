# Team shared designs

The payoff [Teams](teams.md) deferred: every team gets a shared library — a folder tree plus designs — that all **joined** members can see and manage. It renders as a "Team designs" section on the team detail page in the Explorer. The concept is the personal folder tree ([Folders](folders.md)), just shared.

## Data model

A team's library is liveworkspace's index's ([one-explorer-contracts.md](../../../../liveworkspace/docs/one-explorer-contracts.md)):

- **A team folder** is an index folder with a `teamId`. The personal tree and each team's tree are kept apart, so
  the two can't bleed into each other. The creator is kept for audit, but authorisation is by team membership, not
  ownership.
- **A team design** is an index item with a `teamId`. Its `folderId` null is the root of the team's library (listed
  beside its root folders, not a row, can't be deleted), otherwise a folder of the same team.

A design is in exactly one place: personal tree or one team's library. Moving it into a team removes it from the
owner's personal lists. A team design is managed by **every joined member**, not just its creator, so any joined
member may move it.

## Access

Joined team membership grants **edit** on every design in the team's library. The index decides it: every request
about a design carries the index's grant on it (`X-Index-Grant`), and the grant names the caller's level whether it
came from ownership, the team or a share link ([API app](../015-api/api.md)).

- **Owning a team design grants nothing on its own**: its owner is a joined member while they are in the team, and
  once they leave or are removed the design must not stay open to them.
- `invited` (un-accepted) members get nothing, consistent with [Teams](teams.md).
- **Sharing belongs to every joined member.** Share links and the share password are managed by the owner or any
  joined member of the design's team, through the index.
- Share links otherwise work on team designs unchanged — they're orthogonal grants.

## API

- `GET /api/teams/:id/library` — `{ folders, designs }` for the team, read from the index. Joined members only.
- `POST /api/designs` creates a design straight into a team library when its body carries `teamId` (and optionally
  a `folderId` of that team), in the one write that creates it ([Folders → Placement on create](folders.md#placement-on-create)).
  The caller must be a joined member.
- Making, moving and deleting team folders, and moving a design into, between or out of teams, are the index's
  routes, called by the shared Explorer. Moving a team design out into a member's personal library makes that member
  its owner.

## Explorer UI

- **Team detail page** gains a "Team designs" card between the header and the member list: breadcrumb navigation through the team's folder tree, the team's root designs listed beside its root folders, a brand-filled **"New design"** action (in the "Create" menu alongside "New folder"; hands off to `/new?team=<id>&folder=<currentFolderId?>`, which creates the design straight into the team folder being browsed, in one write, never via the personal root), "New folder" / "New subfolder", folder rename / move / delete, and per-design actions available to **every joined member**: open, Rename, Duplicate (the copy is created beside the original, in the same team folder, by one create), "Change Folder" (within the team), and **Delete** (with a confirm). There is no "Remove from team" action. Breadcrumb crumbs keep the folder's own casing; only the root "Team designs" crumb uses the uppercase section-label style.
- **Move to folder picker**: one ownership-aware modal for every design (personal or team), built on the **shared placement browser** ([Folders](folders.md) + [Offline Mode](../006-design/offline-mode.md)): a space overview first (My Work + each team), or, for a design already in a folder, that folder's level ([Save locations](../006-design/save-locations.md), "It opens where its selection is"), then that space's folder drill-down with a "here" card at every level and an inline New Folder tile. Picking a destination routes by scope: a personal folder files the design personally (moving a team design out transfers it to the mover, per the rules above), a team root/folder files it into that team. **Every design-move surface offers every space** — the /explorer page, the team page's own library, and the editor's floating Explorer panel (the panel's Current Design row includes team designs) — so a team design is never trapped: My Work and the other teams are one Back away on the space overview. Only **folder** moves stay scoped (a folder can't change scope: personal folders re-parent within the personal tree, team folders within their team). The team page supports a `&folder=<id>` deep-link param (read at mount) so search results and links can open a specific team folder. Whatever the team page changes (a folder made, renamed, moved or deleted, a design re-filed, renamed, copied or deleted, a folder made from its picker in My Work or another team) reaches the Explorer's own lists at once: the sidebar, the search panel and every other move picker show it without a reload.
- **Sidebar**: **My Work** and each team are root-level folder rows in the Spaces group ([Explorer structure](explorer-structure.md)), rendered as the same collapsible folder tree (a team expands to reveal its folders; My Work lists its root folders). The editor's Explorer team rows and its Current Design card give a team-library design a per-row **Delete** to any joined member (the api authorises owner-or-member delete). Fuller team-row management (rename, move, the full menu) stays on the /explorer + team pages. Because team rows aren't in the personal list the panel can't optimistically prune, the panel hides a just-deleted team row locally until the team-library sweep re-fetches.
- The personal space is named **My Work** (October 2026). It was "My Work", then "Personal Space", then "My Designs", and is "My Work" again in every app; the help article moved from `explorer/my-work` to `explorer/personal-space`, which keeps its path, and the old URL redirects there.
- **Editor header badge**: a design in a team library shows a brand-tinted **"Team"** title badge instead of "Private" (every joined member can open it, so "Private" would be a lie). Share links still win: a shared team design reads "Shared" as normal.
- **Recent designs** spans the personal library, every joined team's shared designs (swept lazily, one library fetch per team, via `useTeamLibrariesSweep`), AND designs shared with you ("Shared with you"), interleaved by recency and capped. Team rows show a brand-tinted **"Team"** visibility badge and a team menu (available to every joined member): Rename, Duplicate, "Change Folder" (the unified picker), "Open Team" (deep-links to the folder), and Delete. There is no "Remove from team". Shared-with-you rows show the **"Shared"** badge, the sharer as owner, open via the share link, and a "Dismiss" action. Recent and Shared-with-you show a desktop-only **Owner** column: "You" for personal rows, the team name for team rows, the sharer's display name for shared rows.

## Telemetry

`Team/Added/Design` (moved into a team), `Team/Removed/Design` (moved out), `Team/Moved/Design` (re-foldered within a team). Team folder CRUD reuses the `Folder` category with type `Team` (`Folder/Created/Team` …).

## Out of scope

- Per-member or per-folder permissions inside a team (every joined member can manage everything).
- Realtime presence indicators on the team library list.
- Team-level share links.

(Note: moving a team design out into a member's personal library does transfer ownership to that member — see the data model above. Ownership is never transferred _to_ a team as a collective entity; the design always has a single owner row.)
