# 35 — Team shared diagrams

The payoff [spec/32](32-teams.md) deferred: every team gets a shared library — a folder tree plus diagrams — that all **joined** members can see and manage. It renders as a "Shared diagrams" section on the team detail page in the Explorer. The concept is the personal folder tree (spec/15), just shared.

## Data model

Migration `0022_team_library.sql` adds a nullable `team_id` to both tables:

- **`folders.team_id`** — non-null = a team folder. Personal reads/writes always filter `team_id IS NULL`, so the two trees can't bleed into each other. `owner_id` keeps the creator for audit, but authorisation is by team membership, not ownership.
- **`diagrams.team_id`** — non-null = the diagram lives in that team's library. Placement mirrors spec/15: `folder_id NULL` = the team's synthetic **Unsorted** (always present, not a row, can't be deleted), otherwise a folder of the same team.

A diagram is in exactly one place: personal tree or one team's library. Moving it into a team removes it from the owner's personal lists (`GET /api/diagrams` filters `team_id IS NULL`). A team diagram is managed by **every joined member**, not just its creator, so any joined member may move it: re-folder it within the team, move it to another team they belong to, or move it out into **their own** personal library. Moving it out transfers **ownership to the mover** (folders are owner-scoped, so the diagram follows them into the mover's tree); the owner moving it out keeps ownership. The owner can always delete their diagram in their personal surfaces.

## Access

Joined team membership grants **edit** on every diagram in the team's library, enforced at the same choke points share codes use:

- `canReadDiagram` / `canEditDiagram` accept the diagram's `teamId`: owner → share code → joined-member-of-team, in that order. All REST surfaces that gate on them (tabs, comments, change log, images) inherit the rule.
- The WebSocket upgrade resolves `role = 'edit'` for a claimed id that is a joined member of the diagram's team (same trust level as the existing owner-id match).
- `invited` (un-accepted) members get nothing, consistent with spec/32.
- Share links and the share password keep working on team diagrams unchanged — they're orthogonal grants.

## API

- `GET /api/teams/:id/library` — `{ folders, diagrams }` for the team. Joined members only.
- `POST /api/folders` body gains `teamId`: creates a team folder (caller must be a joined member; `parentId` must be a folder of the same team). `PUT` / `DELETE /api/folders/:id` authorise team folders by joined membership instead of ownership. Deleting a team folder promotes child folders to the team root and drops its diagrams into the team's Unsorted (same cascade shape as spec/15).
- `PUT /api/diagrams/:id/folder` body gains `teamId`. Authorisation is by membership (a team diagram belongs to every joined member):
  - **Into a team / between teams** (`{teamId: T, folderId}`): the caller must be a joined member of T. A personal diagram can only be filed into a team by its owner; a team diagram can be moved on by any joined member of its current team. `folderId` must be T's folder or null.
  - **Within the current team**: any joined member may re-folder it.
  - **Out of a team** (`{teamId: null, folderId}`): any joined member may move it into their own personal library; `folderId` must be the **caller's** personal folder (or null for their Unsorted), and ownership transfers to the caller. When the owner moves it out, ownership is unchanged.
  - A purely personal move (no team on either side) stays owner-only. Folder/scope mismatches 404.

## Explorer UI

- **Team detail page** gains a "Shared diagrams" card between the header and the member list: breadcrumb navigation through the team's folder tree, an Unsorted bucket at the root, a brand-filled **"New diagram"** button (left of "New folder"; hands off to `/live/new?team=<id>&folder=<currentFolderId?>`, which applies the team + folder placement right after the create, so the fresh diagram lands in the team folder being browsed rather than the personal Unsorted), "New folder" / "New subfolder", folder rename / move / delete, and per-diagram actions: open, "Move to folder…" (within the team), and "Remove from team". Rename / duplicate / delete stay with the diagram's owner in their personal surfaces. Breadcrumb crumbs keep the folder's own casing; only the root "Shared diagrams" crumb uses the uppercase section-label style.
- **Move to folder picker**: one ownership-aware modal for every diagram (personal or team). It renders destinations as an **indented, collapsible tree** — "All diagrams" with the personal folder tree nested beneath, then each team root with its own folder tree nested beneath (no "A / B" breadcrumb strings, no repeated team name). Picking a destination routes by scope: a personal folder files the diagram personally (moving a team diagram out transfers it to the mover, per the rules above), a team root/folder files it into that team. The team page supports a `&folder=<id>` deep-link param (read at mount) so search results and links can open a specific team folder.
- **Sidebar**: the personal "My Work" tree and each team in the Teams section render as the same collapsible folder tree (a team expands to reveal its folders). There is no separate "All diagrams" row — My Work lists Unsorted and the root folders directly.
- The sidebar's personal tree section is labelled **"My Work"** to contrast with team libraries.
- **Editor header badge**: a diagram in a team library shows a brand-tinted **"Team"** title badge instead of "Private" (every joined member can open it, so "Private" would be a lie). Share links still win: a shared team diagram reads "Shared" as normal.
- **Recent diagrams** spans the personal library, every joined team's shared diagrams (swept lazily, one library fetch per team, via `useTeamLibrariesSweep`), AND diagrams shared with you ("Shared with me"), interleaved by recency and capped. The sidebar "Recent diagrams" row carries a count badge like "Shared with me". Team rows show a brand-tinted **"Team"** visibility badge and a team menu: "Move to folder…" (the unified picker), "Open team page" (deep-links to the folder), and "Remove from team". Shared-with-me rows show the **"Shared"** badge, the sharer as owner, open via the share link, and a "Dismiss" action. Personal rows keep rename / duplicate / delete / move. Recent and Shared-with-me show a desktop-only **Owner** column: "You" for personal rows, the team name for team rows, the sharer's display name for shared rows.

## Telemetry

`Team/Added/Diagram` (moved into a team), `Team/Removed/Diagram` (moved out), `Team/Moved/Diagram` (re-foldered within a team). Team folder CRUD reuses the `Folder` category with type `Team` (`Folder/Created/Team` …).

## Out of scope

- Per-member or per-folder permissions inside a team (every joined member can manage everything).
- Realtime presence indicators on the team library list.
- Team-level share links.

(Note: moving a team diagram out into a member's personal library does transfer ownership to that member — see the data model above. Ownership is never transferred _to_ a team as a collective entity; the diagram always has a single owner row.)
