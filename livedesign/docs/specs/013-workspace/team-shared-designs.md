# Team shared designs

Status: shipped, on liveworkspace's index and the shared Explorer ([`@liveworkspace/explorer`](../../../../packages/explorer/README.md))

Every [team](teams.md) has a shared library, a folder tree plus designs, that every **joined** member can see and
manage. A team folder is an index folder with a `teamId`, and a team design an index item with one; a design is in
exactly one place, a person's own tree or one team's library ([one-explorer-contracts.md](../../../../liveworkspace/docs/specs/004-index/one-explorer-contracts.md) "Folders, favourites, defaults").

## Access

Joined membership grants **edit** on every design in the team's library; invited (un-accepted) members get nothing.
The index decides: every request about a design carries the index's grant (`X-Index-Grant`), naming the caller's
level whether it came from ownership, the team or a share link ([API](../015-api/api.md)). Sharing a team design
(its links and share password) belongs to every joined member.

## What livedesign does

- **Lists a library for API clients.** `GET /api/teams/:id/library` answers `{ folders, designs }`, read from the
  index, for joined members only (`apps/api/src/routes/teams.ts`).
- **Creates into a team.** `POST /api/designs` with `teamId` (and optionally a `folderId` of that team) files the new
  design in the team's library in the one write that creates it
  ([Folders](folders.md#placement-on-create)); `/new?team=<id>&folder=<id>` asks for it from the Explorer's New
  Design. A caller who is not a joined member gets `team_forbidden`, which `/new` explains
  (`apps/live/app/new/create-failure.ts`).
- **Shows it in the editor.** A team design's title badge reads **Team** instead of Private; a shared one still
  reads Shared.
- Moving, renaming and deleting team folders and designs, and the library's views, are the shared Explorer's.

## Telemetry

`Team·Added·Design` (moved into a team), `Team·Removed·Design` (moved out) and `Team·Moved·Design` (re-foldered
within a team), reported through the Explorer host (`apps/live/lib/explorer-organise.ts`); team folder changes use
the `Folder` category with type `Team` ([Telemetry](../017-telemetry/telemetry.md)).
