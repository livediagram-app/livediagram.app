# 35 — Team shared diagrams

The payoff [spec/32](32-teams.md) deferred: every team gets a shared library — a folder tree plus diagrams — that all **joined** members can see and manage. It renders as a "Shared diagrams" section on the team detail page in the Explorer. The concept is the personal folder tree (spec/15), just shared.

## Data model

Migration `0022_team_library.sql` adds a nullable `team_id` to both tables:

- **`folders.team_id`** — non-null = a team folder. Personal reads/writes always filter `team_id IS NULL`, so the two trees can't bleed into each other. `owner_id` keeps the creator for audit, but authorisation is by team membership, not ownership.
- **`diagrams.team_id`** — non-null = the diagram lives in that team's library. Placement mirrors spec/15: `folder_id NULL` = the team's synthetic **Unsorted** (always present, not a row, can't be deleted), otherwise a folder of the same team.

A diagram is in exactly one place: personal tree or one team's library. Moving it into a team removes it from the owner's personal lists (`GET /api/diagrams` filters `team_id IS NULL`); moving it out returns it to its **owner's** personal Unsorted, regardless of who moved it. Ownership itself never changes — the owner can always delete their diagram, and only the owner can move it into (or between) teams.

## Access

Joined team membership grants **edit** on every diagram in the team's library, enforced at the same choke points share codes use:

- `canReadDiagram` / `canEditDiagram` accept the diagram's `teamId`: owner → share code → joined-member-of-team, in that order. All REST surfaces that gate on them (tabs, comments, change log, images) inherit the rule.
- The WebSocket upgrade resolves `role = 'edit'` for a claimed id that is a joined member of the diagram's team (same trust level as the existing owner-id match).
- `invited` (un-accepted) members get nothing, consistent with spec/32.
- Share links and the share password keep working on team diagrams unchanged — they're orthogonal grants.

## API

- `GET /api/teams/:id/library` — `{ folders, diagrams }` for the team. Joined members only.
- `POST /api/folders` body gains `teamId`: creates a team folder (caller must be a joined member; `parentId` must be a folder of the same team). `PUT` / `DELETE /api/folders/:id` authorise team folders by joined membership instead of ownership. Deleting a team folder promotes child folders to the team root and drops its diagrams into the team's Unsorted (same cascade shape as spec/15).
- `PUT /api/diagrams/:id/folder` body gains `teamId`:
  - **Owner, joined member of T**: `{teamId: T, folderId}` moves the diagram into T (folderId must be T's folder or null).
  - **Any joined member of the diagram's current team**: may re-folder it within the team, or `{teamId: null}` to remove it from the team (returns to the owner's personal Unsorted).
  - Folder/scope mismatches 404; a non-owner cannot move a diagram between teams or into anyone's personal folders.

## Explorer UI

- **Team detail page** gains a "Shared diagrams" card between the header and the member list: breadcrumb navigation through the team's folder tree, an Unsorted bucket at the root, "New folder" / "New subfolder", folder rename / move / delete, and per-diagram actions: open, "Move to folder…" (within the team), and "Remove from team". Rename / duplicate / delete stay with the diagram's owner in their personal surfaces.
- **Personal explorer**: the existing "Move to folder…" picker gains a Teams group — moving a diagram there sends it to that team's Unsorted (organise it further on the team page). Only the owner sees their own diagrams, so this is inherently owner-only.
- The sidebar's personal tree section is labelled **"My Work"** to contrast with team libraries.

## Telemetry

`Team/Added/Diagram` (moved into a team), `Team/Removed/Diagram` (moved out), `Team/Moved/Diagram` (re-foldered within a team). Team folder CRUD reuses the `Folder` category with type `Team` (`Folder/Created/Team` …).

## Out of scope

- Per-member or per-folder permissions inside a team (every joined member can manage everything).
- Realtime presence indicators on the team library list.
- Transferring diagram ownership to the team.
- Team-level share links.
