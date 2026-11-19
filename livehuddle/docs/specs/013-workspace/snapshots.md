# Snapshots

Status: built (Work Tracker 948)

Manual save points of the whole Space, built once for every app. The platform spec,
[Snapshots](../../../../liveworkspace/docs/specs/014-snapshots/snapshots.md), is the source of truth for what a
snapshot is, the five kept, Revert and its automatic snapshot, the generation fence, the roles, the dialog and the
API. This spec says only what is livehuddle's own. (Not the previews in `006-*`, which are drawings of a Space.)

## What a snapshot holds here

The Space as its own export file, the `livehuddle.document` envelope (`exportDocumentFile`, document-room/document-file.ts): every tab with its folder, and what else that file carries.

## What a revert puts back

- **Every tab**, with its id, order and folder, written as a save writes it (its revision moves forward); a tab made
  since is deleted, and one removed since comes back.
- **The slide deck** field the file still carries becomes the snapshot's.
- The Space's name stays; calls, attendance and avatars are not content and are untouched.

## Roles

As the platform spec's table, through this app's edit gate on the whole Space ([Share roles](share-roles.md)): an
Editor of the whole Space takes, reverts and deletes; a tab-scoped link, a Participant and a Viewer see nothing (404);
an API token is refused (403).

## In History

Snapshots live inside **History** in the footer's **Tools** menu ([The footer's Tools menu](../../../../liveworkspace/docs/specs/004-index/footer-tools-menu.md)
"History, with Snapshots in it"; owner, 2026-11-17), there for that Editor once the Space is stored on the server
(never Offline, a workbench frame or a Community visit): **Take Snapshot** over History's timeline and each
snapshot pinned on it, or the snapshots on their own for an Editor through a share link, naming the item
"Space" ([Snapshots](../../../../liveworkspace/docs/specs/014-snapshots/snapshots.md) "In History"). There is no
Snapshots row of its own.

## Where it is built

`/api/documents/<id>/snapshots`, answered inside the Space's Durable Object by `@liveworkspace/snapshots` through this app's door
(`livehuddle/apps/api/src/document-room/document-snapshots.ts`): its export, its content replace, its gate and the room's close.
