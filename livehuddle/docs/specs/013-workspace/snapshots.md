# Snapshots

Status: built (Work Tracker 948)

Manual save points of the whole Space, built once for every app. The platform spec,
[Snapshots](../../../../liveworkspace/docs/specs/013-snapshots/snapshots.md), is the source of truth for what a
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

## In the editor

The **Snapshots** button sits in the footer's tool cluster, just before Settings, drawn for that Editor once the Space is
stored on the server (never in This Browser, a workbench frame or a Community visit). Its dialog is the shared one,
naming the item "Space".

## Where it is built

`/api/documents/<id>/snapshots`, answered inside the Space's Durable Object by `@liveworkspace/snapshots` through this app's door
(`livehuddle/apps/api/src/document-room/document-snapshots.ts`): its export, its content replace, its gate and the room's close.
