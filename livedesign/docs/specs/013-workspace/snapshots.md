# Snapshots

Status: built (Work Tracker 948)

Manual save points of the whole design, built once for every app. The platform spec,
[Snapshots](../../../../liveworkspace/docs/specs/014-snapshots/snapshots.md), is the source of truth for what a
snapshot is, the five kept, Revert and its automatic snapshot, the generation fence, the roles, the dialog and the
API. This spec says only what is livedesign's own. (Not the previews in `006-*`, which are drawings of a design.)

## What a snapshot holds here

The design as its own export file, the `livedesign.design` envelope (`exportDesignFile`, design-room/design-file.ts): every tab with its folder, and what else that file carries.

## What a revert puts back

- **Every tab**, with its id, order and folder, written as a save writes it (its revision moves forward); a tab made
  since is deleted, and one removed since comes back.
- **The component library** becomes the snapshot's, so every instance on a restored tab finds its component.
- The design's name stays.

## Roles

As the platform spec's table, through this app's edit gate on the whole design ([Share roles](share-roles.md)): an
Editor of the whole design takes, reverts and deletes; a tab-scoped link, a Participant and a Viewer see nothing (404);
an API token is refused (403).

## In History

Snapshots live inside **History** in the footer's **Tools** menu ([The footer's Tools menu](../../../../liveworkspace/docs/specs/004-index/footer-tools-menu.md)
"History, with Snapshots in it"; owner, 2026-11-17), there for that Editor once the design is stored on the server
(never Offline, a workbench frame or a Community visit): **Take Snapshot** over History's timeline and each
snapshot pinned on it, or the snapshots on their own for an Editor through a share link, naming the item
"design" ([Snapshots](../../../../liveworkspace/docs/specs/014-snapshots/snapshots.md) "In History"). There is no
Snapshots row of its own.

## Where it is built

`/api/designs/<id>/snapshots`, answered inside the design's Durable Object by `@liveworkspace/snapshots` through this app's door
(`livedesign/apps/api/src/design-room/design-snapshots.ts`): its export, its content replace, its gate and the room's close.
